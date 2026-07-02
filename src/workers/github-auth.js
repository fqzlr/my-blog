/**
 * GitHub App 服务端认证工具
 * 供 Vercel Edge Function 使用（api/github.js, api/friend-apply.js 等）
 */

const GH_API = "https://api.github.com";

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
		0x30, 0x0d, 0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01,
		0x01, 0x05, 0x00,
	]);
	const VERSION = new Uint8Array([0x02, 0x01, 0x00]);
	const pkcs1Len = pkcs1Der.byteLength;
	const octetHeader = pkcs1Len < 128 ? 2 : pkcs1Len < 256 ? 3 : 4;
	const octetTotal = octetHeader + pkcs1Len;
	const innerLen = VERSION.length + ALGO_OID.length + octetTotal;
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
	view.set(outerLenBytes, pos);
	pos += outerLenBytes.length;
	view.set(VERSION, pos);
	pos += VERSION.length;
	view.set(ALGO_OID, pos);
	pos += ALGO_OID.length;
	view[pos++] = 0x04;
	if (pkcs1Len < 128) {
		view[pos++] = pkcs1Len;
	} else if (pkcs1Len < 256) {
		view[pos++] = 0x81;
		view[pos++] = pkcs1Len;
	} else {
		view[pos++] = 0x82;
		view[pos++] = (pkcs1Len >> 8) & 0xff;
		view[pos++] = pkcs1Len & 0xff;
	}
	view.set(new Uint8Array(pkcs1Der), pos);
	return buf;
}

/** 用环境变量签名 JWT */
async function signJwtServer(appId, privateKeyPem) {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = { iat: now - 60, exp: now + 600, iss: appId };
	const b64url = (obj) =>
		btoa(JSON.stringify(obj))
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/, "");
	const data = `${b64url(header)}.${b64url(payload)}`;

	let der = pemToArrayBuffer(privateKeyPem);
	let key;
	try {
		const pkcs8 = pkcs1ToPkcs8(der);
		key = await crypto.subtle.importKey(
			"pkcs8",
			pkcs8,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["sign"],
		);
	} catch {
		key = await crypto.subtle.importKey(
			"pkcs8",
			der,
			{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
			false,
			["sign"],
		);
	}

	const sigBuf = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(data),
	);
	const sig = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
	return `${data}.${sig}`;
}

/** 获取 Installation Token（服务端） */
export async function getInstallationTokenServer(env) {
	const now = Date.now();
	if (cachedToken && now < cachedTokenExpiry) return cachedToken;

	const appId = env.PUBLIC_GITHUB_APP_ID;
	const privateKey = env.GH_PRIVATE_KEY;
	if (!appId || !privateKey) return null;

	try {
		const jwt = await signJwtServer(appId, privateKey);
		const authHeaders = {
			Authorization: `Bearer ${jwt}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
		};

		const ghUser = env.PUBLIC_GITHUB_OWNER || "fqzlr";
		const ghRepo = env.PUBLIC_GITHUB_REPO || "my-blog";
		let installationId = null;

		const instResp = await fetch(`${GH_API}/app/installations`, {
			headers: authHeaders,
		});
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
			const instResp2 = await fetch(
				`${GH_API}/repos/${ghUser}/${ghRepo}/installation`,
				{ headers: authHeaders },
			);
			if (instResp2.ok) {
				const data = await instResp2.json();
				installationId = data.id;
			}
		}
		if (!installationId) return null;

		const tokenResp = await fetch(
			`${GH_API}/app/installations/${installationId}/access_tokens`,
			{
				method: "POST",
				headers: { ...authHeaders, "Content-Type": "application/json" },
				body: "{}",
			},
		);
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
