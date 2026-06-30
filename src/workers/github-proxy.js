/**
 * GitHub API 代理 - 支持服务端 GitHub App 认证
 * 如果配置了 GH_APP_ID + GH_PRIVATE_KEY 环境变量，自动为请求添加认证
 * 客户端无需导入 PEM 私钥
 * 同时支持 Cloudflare Workers 和 Vercel Edge Functions
 */

const GH_API = "https://api.github.com";

function corsHeaders(extra = {}) {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
		"Access-Control-Max-Age": "86400",
		...extra,
	};
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			...corsHeaders(),
		},
	});
}

// ============ 服务端 GitHub App 认证 ============

let cachedToken = null;
let cachedTokenExpiry = 0;

/** PEM 转 ArrayBuffer (PKCS#1 → PKCS#8 包装) */
function pemToArrayBuffer(pem) {
	const b64 = pem
		.replace(/-----BEGIN[^-]+-----/g, "")
		.replace(/-----END[^-]+-----/g, "")
		.replace(/\s/g, "");
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes.buffer;
}

/** PKCS#1 → PKCS#8 */
function pkcs1ToPkcs8(pkcs1Der) {
	const ALGO_OID = new Uint8Array([
		0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00,
	]);
	const VERSION = new Uint8Array([0x02, 0x01, 0x00]);
	const pkcs1Len = pkcs1Der.byteLength;
	// OCTET STRING header size
	const octetHeader = pkcs1Len < 128 ? 2 : (pkcs1Len < 256 ? 3 : 4);
	const octetTotal = octetHeader + pkcs1Len;
	const innerLen = VERSION.length + ALGO_OID.length + octetTotal;
	// Build outer SEQUENCE with proper length encoding
	function derLen(dataLen) {
		if (dataLen < 128) return new Uint8Array([dataLen]);
		if (dataLen < 256) return new Uint8Array([0x81, dataLen]);
		return new Uint8Array([0x82, (dataLen >> 8) & 0xff, dataLen & 0xff]);
	}
	const outerLenBytes = derLen(innerLen);
	const buf = new ArrayBuffer(1 + outerLenBytes.length + innerLen);
	const view = new Uint8Array(buf);
	let pos = 0;
	view[pos++] = 0x30;
	view.set(outerLenBytes, pos); pos += outerLenBytes.length;
	view.set(VERSION, pos); pos += VERSION.length;
	view.set(ALGO_OID, pos); pos += ALGO_OID.length;
	view[pos++] = 0x04;
	if (pkcs1Len < 128) { view[pos++] = pkcs1Len; }
	else if (pkcs1Len < 256) { view[pos++] = 0x81; view[pos++] = pkcs1Len; }
	else { view[pos++] = 0x82; view[pos++] = (pkcs1Len >> 8) & 0xff; view[pos++] = pkcs1Len & 0xff; }
	view.set(new Uint8Array(pkcs1Der), pos);
	return buf;
}

/** 用环境变量签名 JWT */
async function signJwtServer(appId, privateKeyPem) {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = { iat: now - 60, exp: now + 600, iss: appId };
	const b64url = (obj) =>
		btoa(JSON.stringify(obj)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	const data = `${b64url(header)}.${b64url(payload)}`;

	let der = pemToArrayBuffer(privateKeyPem);
	// 尝试作为 PKCS#1 导入（需要转 PKCS#8）
	let key;
	try {
		const pkcs8 = pkcs1ToPkcs8(der);
		key = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
	} catch {
		// 可能已经是 PKCS#8
		key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
	}

	const sigBuf = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(data));
	const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
		.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return `${data}.${sig}`;
}

/** 获取 Installation Token（服务端） */
async function getInstallationTokenServer(env) {
	const now = Date.now();
	if (cachedToken && now < cachedTokenExpiry) return cachedToken;

	const appId = env.GH_APP_ID;
	const privateKey = env.GH_PRIVATE_KEY;
	if (!appId || !privateKey) return null;

	try {
		const jwt = await signJwtServer(appId, privateKey);
		const authHeaders = {
			Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};

		// 获取 installation ID
		const ghUser = env.GH_USER || "fqzlr";
		const ghRepo = env.GH_REPO || "my-blog";
		let installationId = null;

		const instResp = await fetch(`${GH_API}/app/installations`, { headers: authHeaders });
		if (instResp.ok) {
			const installations = await instResp.json();
			for (const inst of installations) {
				if (inst.account && inst.account.login === ghUser) {
					installationId = inst.id;
					break;
				}
			}
			if (!installationId && installations.length > 0) {
				installationId = installations[0].id;
			}
		}
		if (!installationId) {
			const instResp2 = await fetch(`${GH_API}/repos/${ghUser}/${ghRepo}/installation`, { headers: authHeaders });
			if (instResp2.ok) {
				const data = await instResp2.json();
				installationId = data.id;
			}
		}
		if (!installationId) return null;

		// 获取 token
		const tokenResp = await fetch(`${GH_API}/app/installations/${installationId}/access_tokens`, {
			method: "POST",
			headers: { ...authHeaders, "Content-Type": "application/json" },
			body: "{}",
		});
		if (!tokenResp.ok) return null;
		const data = await tokenResp.json();
		cachedToken = data.token;
		cachedTokenExpiry = new Date(data.expires_at).getTime() - 60_000;
		return cachedToken;
	} catch (e) {
		console.error("Server auth failed:", e);
		return null;
	}
}

/**
 * 处理 GitHub API 代理请求
 * 前端 POST body: { path, method, headers, body }
 */
export async function handleGithubProxy(request, env) {
	if (request.method === "OPTIONS") {
		return new Response(null, { status: 204, headers: corsHeaders() });
	}

	// GET /api/github → 状态检查
	if (request.method === "GET") {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		const hasServerAuth = !!(env && env.GH_APP_ID && env.GH_PRIVATE_KEY);
		const hasAppId = !!(env && env.GH_APP_ID);
		if (!path) {
			return jsonResponse({
				ok: true,
				status: "proxy-ready",
				serverAuth: hasServerAuth,
				hasAppId,
				appId: hasAppId ? env.GH_APP_ID : "",
				message: hasServerAuth
					? "GitHub proxy with server-side auth is running."
					: hasAppId
						? "GitHub proxy is running. App ID available. Import PEM key to authenticate."
						: "GitHub proxy is running. Import your .pem key to authenticate.",
			});
		}
		// GET with path → 转发 API 请求
		// 如果客户端已提供 Authorization，直接透传；否则尝试服务端认证
		const clientAuth = request.headers.get("Authorization") || request.headers.get("authorization");
		const clientAuthObj = {};
		if (clientAuth) {
			clientAuthObj.Authorization = clientAuth;
		}
		let extraHeaders = { ...clientAuthObj };
		if (!clientAuth && env && env.GH_APP_ID && env.GH_PRIVATE_KEY) {
			const serverToken = await getInstallationTokenServer(env);
			if (serverToken) {
				extraHeaders = { Authorization: `Bearer ${serverToken}` };
			}
		}
		return forwardRequest("GET", path, null, extraHeaders);
	}

	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		let body;
		try { body = await request.json(); } catch {
			return jsonResponse({ error: "Invalid JSON body" }, 400);
		}
		const { path, method, headers = {}, body: reqBody } = body;
		if (!path || typeof path !== "string") {
			return jsonResponse({ error: "Missing 'path' field in request body" }, 400);
		}
		const httpMethod = (method || request.method).toUpperCase();

		// 如果客户端没有 Authorization，且服务端有完整凭据，使用服务端认证
		const hasClientAuth = headers.Authorization || headers.authorization;
		if (!hasClientAuth && env && env.GH_APP_ID && env.GH_PRIVATE_KEY) {
			const serverToken = await getInstallationTokenServer(env);
			if (serverToken) {
				headers.Authorization = `Bearer ${serverToken}`;
			}
		}

		return forwardRequest(httpMethod, path, reqBody, headers);
	}

	return jsonResponse({ error: "Method not allowed" }, 405);
}

async function forwardRequest(method, path, reqBody, clientHeaders) {
	try {
		const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;

		const headers = {
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor-Proxy",
		};

		if (clientHeaders && typeof clientHeaders === "object") {
			for (const [key, value] of Object.entries(clientHeaders)) {
				const lower = key.toLowerCase();
				if (lower === "host" || lower === "content-length") continue;
				if (typeof value === "string") {
					headers[key] = value;
				}
			}
		}

		const fetchOpts = { method, headers };
		if (reqBody !== undefined && method !== "GET") {
			headers["Content-Type"] = headers["Content-Type"] || "application/json";
			fetchOpts.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
		}

		const resp = await fetch(targetUrl, fetchOpts);
		const text = await resp.text();

		const responseHeaders = {
			"Content-Type": resp.headers.get("Content-Type") || "application/json",
			...corsHeaders(),
		};

		return new Response(text, { status: resp.status, headers: responseHeaders });
	} catch (e) {
		return jsonResponse({ error: "Proxy request failed", message: e?.message || String(e) }, 502);
	}
}
