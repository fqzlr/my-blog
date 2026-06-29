/**
 * GitHub API 代理 - 使用 Web Crypto API 进行 JWT 签名
 * 支持 Cloudflare Workers 和 Node.js (Vercel) 环境
 * 自动处理 PKCS#1 到 PKCS#8 的私钥格式转换
 */

const GH_API = "https://api.github.com";
const TOKEN_CACHE_TTL = 50 * 60 * 1000;

let cachedToken = null;
let cachedTokenExpires = 0;

function bufToB64(buf) {
	let binary = "";
	const bytes = new Uint8Array(buf);
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function b64ToBuf(b64) {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function b64urlEncode(buf) {
	return bufToB64(buf)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function b64urlDecode(str) {
	str = str.replace(/-/g, "+").replace(/_/g, "/");
	while (str.length % 4) str += "=";
	return b64ToBuf(str);
}

function strToBuf(str) {
	return new TextEncoder().encode(str);
}

// ASN.1 DER encoding helpers
function derLen(len) {
	if (len < 128) return new Uint8Array([len]);
	const bytes = [];
	let temp = len;
	while (temp > 0) {
		bytes.unshift(temp & 0xff);
		temp >>= 8;
	}
	return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derSeq(...parts) {
	const body = concatBufs(...parts);
	return concatBufs(new Uint8Array([0x30]), derLen(body.length), body);
}

function derInt(val) {
	if (typeof val === "number") {
		const bytes = [];
		let v = val;
		if (v === 0) {
			bytes.push(0);
		} else {
			while (v > 0) {
				bytes.unshift(v & 0xff);
				v >>= 8;
			}
			if (bytes[0] & 0x80) bytes.unshift(0);
		}
		return concatBufs(new Uint8Array([0x02]), derLen(bytes.length), new Uint8Array(bytes));
	}
	return concatBufs(new Uint8Array([0x02]), derLen(val.length), val);
}

function derOctetStr(data) {
	return concatBufs(new Uint8Array([0x04]), derLen(data.length), data);
}

function derOid(oidStr) {
	const parts = oidStr.split(".").map(Number);
	const bytes = [40 * parts[0] + parts[1]];
	for (let i = 2; i < parts.length; i++) {
		let v = parts[i];
		if (v < 128) {
			bytes.push(v);
		} else {
			const enc = [];
			enc.unshift(v & 0x7f);
			v >>= 7;
			while (v > 0) {
				enc.unshift(0x80 | (v & 0x7f));
				v >>= 7;
			}
			bytes.push(...enc);
		}
	}
	return concatBufs(new Uint8Array([0x06]), derLen(bytes.length), new Uint8Array(bytes));
}

function derNull() {
	return new Uint8Array([0x05, 0x00]);
}

function concatBufs(...arrays) {
	let total = 0;
	for (const a of arrays) total += a.length;
	const result = new Uint8Array(total);
	let offset = 0;
	for (const a of arrays) {
		result.set(a, offset);
		offset += a.length;
	}
	return result;
}

/**
 * Convert PKCS#1 RSA private key (BEGIN RSA PRIVATE KEY) to PKCS#8 (BEGIN PRIVATE KEY)
 * PKCS#1: SEQUENCE { version INTEGER, modulus INTEGER, ... }
 * PKCS#8: SEQUENCE { version INTEGER(0), algorithm SEQUENCE { oid rsaEncryption, NULL }, privateKey OCTET STRING containing PKCS#1 }
 */
function pkcs1ToPkcs8(pkcs1Der) {
	const rsaEncryptionOid = "1.2.840.113549.1.1.1";
	const version0 = derInt(0);
	const algId = derSeq(derOid(rsaEncryptionOid), derNull());
	const wrappedKey = derOctetStr(pkcs1Der);
	return derSeq(version0, algId, wrappedKey);
}

function pemToDer(pem) {
	const isPkcs1 = pem.includes("BEGIN RSA PRIVATE KEY");
	const isPkcs8 = pem.includes("BEGIN PRIVATE KEY") && !pem.includes("BEGIN RSA");
	let base64 = pem
		.replace(/-----BEGIN [A-Z ]+PRIVATE KEY-----/, "")
		.replace(/-----END [A-Z ]+PRIVATE KEY-----/, "")
		.replace(/\s+/g, "");
	const der = b64ToBuf(base64);
	if (isPkcs1) {
		return { der: pkcs1ToPkcs8(der), format: "pkcs8" };
	}
	return { der, format: isPkcs8 ? "pkcs8" : "unknown" };
}

async function importPrivateKey(pem) {
	const { der } = pemToDer(pem);
	return crypto.subtle.importKey(
		"pkcs8",
		der,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function signJwt(appId, privateKeyPem) {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = { iat: now - 60, exp: now + 8 * 60, iss: String(appId) };

	const enc = (obj) => b64urlEncode(strToBuf(JSON.stringify(obj)));
	const signingInput = `${enc(header)}.${enc(payload)}`;

	const key = await importPrivateKey(privateKeyPem);
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		strToBuf(signingInput),
	);

	return `${signingInput}.${b64urlEncode(signature)}`;
}

async function getInstallationToken(env) {
	const now = Date.now();
	if (cachedToken && now < cachedTokenExpires) {
		return cachedToken;
	}

	const appId = env.GH_APP_ID || (typeof process !== "undefined" ? process.env.GH_APP_ID : "");
	const privateKey = env.GH_PRIVATE_KEY || (typeof process !== "undefined" ? process.env.GH_PRIVATE_KEY : "");

	if (!appId || !privateKey) {
		throw new Error("GitHub App credentials not configured");
	}

	const owner = env.GH_USER || (typeof process !== "undefined" ? process.env.GH_USER : "") || "fqzlr";
	const repo = env.GH_REPO || (typeof process !== "undefined" ? process.env.GH_REPO : "") || "my-blog";

	const jwt = await signJwt(appId, privateKey);

	const instUrl = `${GH_API}/repos/${owner}/${repo}/installation`;
	const instResp = await fetch(instUrl, {
		headers: {
			Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor-Proxy",
		},
	});
	if (!instResp.ok) {
		const text = await instResp.text().catch(() => "");
		throw new Error(`Failed to get installation (${instResp.status}): ${text}`);
	}
	const instData = await instResp.json();
	const installationId = instData.id;

	const tokenUrl = `${GH_API}/app/installations/${installationId}/access_tokens`;
	const tokenResp = await fetch(tokenUrl, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor-Proxy",
		},
	});
	if (!tokenResp.ok) {
		const text = await tokenResp.text().catch(() => "");
		throw new Error(`Failed to get token (${tokenResp.status}): ${text}`);
	}
	const tokenData = await tokenResp.json();
	cachedToken = tokenData.token;
	cachedTokenExpires = new Date(tokenData.expires_at).getTime() - 60000;
	return cachedToken;
}

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			"Content-Type": "application/json",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		},
	});
}

/**
 * 处理 GitHub API 代理请求
 * @param {Request} request - 原始请求
 * @param {object} env - 环境变量对象（Cloudflare: env, Vercel: process.env）
 * @returns {Promise<Response>}
 */
export async function handleGithubProxy(request, env = {}) {
	if (request.method === "OPTIONS") {
		return new Response(null, {
			status: 204,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
				"Access-Control-Allow-Headers": "Content-Type",
				"Access-Control-Max-Age": "86400",
			},
		});
	}

	const appId = env.GH_APP_ID || (typeof process !== "undefined" ? process.env.GH_APP_ID : "");
	const privateKey = env.GH_PRIVATE_KEY || (typeof process !== "undefined" ? process.env.GH_PRIVATE_KEY : "");

	if (!appId || !privateKey) {
		return jsonResponse(
			{
				configured: false,
				error: "GitHub App not configured",
				message:
					"Set GH_APP_ID and GH_PRIVATE_KEY environment variables",
			},
			503,
		);
	}

	if (request.method === "GET") {
		const url = new URL(request.url);
		const path = url.searchParams.get("path");
		if (!path) {
			return jsonResponse({
				configured: true,
				status: "ok",
				message: "GitHub API proxy running",
			});
		}
		return proxyRequest("GET", path, undefined, env);
	}

	if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH" || request.method === "DELETE") {
		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Invalid JSON body" }, 400);
		}
		const { path, method, body: reqBody } = body;
		if (!path || typeof path !== "string") {
			return jsonResponse({ error: "Missing 'path' field" }, 400);
		}
		const httpMethod = (method || request.method).toUpperCase();
		return proxyRequest(httpMethod, path, reqBody, env);
	}

	return jsonResponse({ error: "Method not allowed" }, 405);
}

async function proxyRequest(method, path, reqBody, env) {
	try {
		const token = await getInstallationToken(env);

		const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;

		const headers = {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-Editor-Proxy",
		};

		const fetchOpts = { method, headers };
		if (reqBody !== undefined && method !== "GET") {
			headers["Content-Type"] = "application/json";
			fetchOpts.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
		}

		const resp = await fetch(targetUrl, fetchOpts);
		const text = await resp.text();

		if (!resp.ok) {
			cachedToken = null;
		}

		return new Response(text, {
			status: resp.status,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
		});
	} catch (e) {
		cachedToken = null;
		return jsonResponse(
			{ error: "Proxy request failed", message: e.message },
			502,
		);
	}
}
