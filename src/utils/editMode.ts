/**
 * 在线编辑模式 - 核心工具库
 * 前端导入 GitHub App 私钥认证：
 * 1. 用户在浏览器导入 .pem 私钥文件并输入 App ID
 * 2. 浏览器端使用 Web Crypto API 进行 JWT 签名
 * 3. 通过 /api/github 代理转发请求（解决CORS问题）
 * 4. 私钥仅保存在浏览器内存/localStorage中，不上传服务器
 */

import { repoConfig } from "@/config/editConfig";

const PROXY_URL = "/api/github";
const STORAGE_APP_ID = "gh_app_id";
const STORAGE_PRIVATE_KEY = "gh_private_key";
const STORAGE_DRAFTS = "gh_drafts";
const STORAGE_DRAFT_META = "gh_draft_meta";

let cachedInstallationToken: string | null = null;
let tokenExpiresAt = 0;

function strToBuf(str: string): ArrayBuffer {
	return new TextEncoder().encode(str);
}

function b64urlEncode(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = "";
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): ArrayBuffer {
	const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
	const pad = b64.length % 4;
	const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
	const binary = atob(padded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes.buffer;
}

function pkcs1ToPkcs8(pkcs1Der: ArrayBuffer): ArrayBuffer {
	const bytes = new Uint8Array(pkcs1Der);
	const rsaOid = new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01, 0x05, 0x00]);
	const algorithmIdentifier = new Uint8Array(2 + rsaOid.length);
	algorithmIdentifier[0] = 0x30;
	algorithmIdentifier[1] = rsaOid.length;
	algorithmIdentifier.set(rsaOid, 2);

	function wrapDer(tag: number, data: Uint8Array): Uint8Array {
		const len = data.length;
		let lenBytes: Uint8Array;
		if (len < 128) {
			lenBytes = new Uint8Array([len]);
		} else if (len < 256) {
			lenBytes = new Uint8Array([0x81, len]);
		} else {
			lenBytes = new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
		}
		const result = new Uint8Array(1 + lenBytes.length + len);
		result[0] = tag;
		result.set(lenBytes, 1);
		result.set(data, 1 + lenBytes.length);
		return result;
	}

	const wrappedKey = wrapDer(0x04, bytes);
	const inner = new Uint8Array(algorithmIdentifier.length + wrappedKey.length);
	inner.set(algorithmIdentifier, 0);
	inner.set(wrappedKey, algorithmIdentifier.length);
	const pkcs8 = wrapDer(0x30, inner);
	return pkcs8.buffer;
}

function pemToDer(pem: string): ArrayBuffer {
	const cleaned = pem
		.replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, "")
		.replace(/-----END (RSA )?PRIVATE KEY-----/, "")
		.replace(/\s+/g, "");
	return b64urlDecode(cleaned);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
	let der = pemToDer(pem);
	const header = new Uint8Array(der, 0, 2);
	let keyData: ArrayBuffer;
	if (header[0] === 0x30 && header[1] === 0x82) {
		const versionOctet = new Uint8Array(der, 3, 1)[0];
		if (versionOctet === 0x01 || versionOctet === 0x00) {
			const seqLen = (new Uint8Array(der, 1, 2)[0] << 8) | new Uint8Array(der, 2, 2)[0];
			const nextByte = new Uint8Array(der, 4, 1)[0];
			if (nextByte === 0x02) {
				keyData = pkcs1ToPkcs8(der);
			} else {
				keyData = der;
			}
		} else {
			keyData = der;
		}
	} else {
		keyData = der;
	}
	return crypto.subtle.importKey(
		"pkcs8",
		keyData,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
}

async function signJwt(appId: string, privateKeyPem: string): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const header = { alg: "RS256", typ: "JWT" };
	const payload = { iat: now - 60, exp: now + 8 * 60, iss: appId };
	const enc = (obj: unknown) => b64urlEncode(strToBuf(JSON.stringify(obj)));
	const signingInput = `${enc(header)}.${enc(payload)}`;
	const key = await importPrivateKey(privateKeyPem);
	const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, strToBuf(signingInput));
	return `${signingInput}.${b64urlEncode(signature)}`;
}

async function rawProxy(
	method: string,
	apiPath: string,
	body: unknown,
	headers: Record<string, string>,
): Promise<Response> {
	return fetch(PROXY_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: apiPath, method, headers, body }),
	});
}

async function getInstallationToken(jwt: string): Promise<{ token: string; expiresAt: number }> {
	const authHeaders = {
		Authorization: `Bearer ${jwt}`,
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	const resp = await rawProxy("GET", "app/installations", undefined, authHeaders);
	if (!resp.ok) {
		const text = await resp.text().catch(() => "");
		throw new Error(`获取 Installation 列表失败 (${resp.status}): ${text}`);
	}
	const installations = await resp.json();
	let installationId: number | null = null;
	const ghUser = repoConfig.owner;
	const ghRepo = repoConfig.repo;
	for (const inst of installations) {
		if (inst.account && (inst.account.login === ghUser)) {
			installationId = inst.id;
			break;
		}
	}
	if (!installationId && Array.isArray(installations) && installations.length > 0) {
		installationId = installations[0].id;
	}
	if (!installationId) {
		const resp2 = await rawProxy(
			"GET",
			`repos/${ghUser}/${ghRepo}/installation`,
			undefined,
			authHeaders,
		);
		if (resp2.ok) {
			const data = await resp2.json();
			installationId = data.id;
		}
	}
	if (!installationId) {
		throw new Error("未找到 GitHub App Installation，请确认 App 已安装到目标仓库");
	}
	const tokenResp = await rawProxy(
		"POST",
		`app/installations/${installationId}/access_tokens`,
		{},
		authHeaders,
	);
	if (!tokenResp.ok) {
		const text = await tokenResp.text().catch(() => "");
		throw new Error(`获取 Installation Token 失败 (${tokenResp.status}): ${text}`);
	}
	const data = await tokenResp.json();
	return {
		token: data.token,
		expiresAt: new Date(data.expires_at).getTime() - 60_000,
	};
}

export async function getAuthToken(): Promise<string | null> {
	const appId = getStoredAppId();
	const privateKey = getStoredPrivateKey();
	if (!appId || !privateKey) return null;
	const now = Date.now();
	if (cachedInstallationToken && now < tokenExpiresAt) {
		return cachedInstallationToken;
	}
	try {
		const jwt = await signJwt(appId, privateKey);
		const { token, expiresAt } = await getInstallationToken(jwt);
		cachedInstallationToken = token;
		tokenExpiresAt = expiresAt;
		return token;
	} catch (e) {
		console.error("获取 GitHub Token 失败:", e);
		clearStoredCredentials();
		return null;
	}
}

export function invalidateToken(): void {
	cachedInstallationToken = null;
	tokenExpiresAt = 0;
}

// ============ 凭据管理 ============

export function getStoredAppId(): string {
	try {
		const configId = repoConfig.appId;
		if (configId) return configId;
		return localStorage.getItem(STORAGE_APP_ID) || "";
	} catch {
		return repoConfig.appId || "";
	}
}

export function setStoredAppId(appId: string): void {
	try {
		localStorage.setItem(STORAGE_APP_ID, appId);
	} catch {}
}

export function getStoredPrivateKey(): string {
	try {
		return localStorage.getItem(STORAGE_PRIVATE_KEY) || "";
	} catch {
		return "";
	}
}

export function setStoredPrivateKey(pem: string): void {
	try {
		localStorage.setItem(STORAGE_PRIVATE_KEY, pem);
	} catch {}
}

export function clearStoredCredentials(): void {
	try {
		localStorage.removeItem(STORAGE_APP_ID);
		localStorage.removeItem(STORAGE_PRIVATE_KEY);
	} catch {}
	cachedInstallationToken = null;
	tokenExpiresAt = 0;
}

export function hasValidCredentials(): boolean {
	return !!getStoredAppId() && !!getStoredPrivateKey();
}

export function hasValidToken(): boolean {
	return cachedInstallationToken !== null && Date.now() < tokenExpiresAt;
}

export async function validateCredentials(appId?: string, pem?: string): Promise<{ ok: boolean; error?: string }> {
	const useAppId = appId || getStoredAppId();
	const usePem = pem || getStoredPrivateKey();
	if (!useAppId || !usePem) {
		return { ok: false, error: "请先导入 GitHub App 私钥文件并填写 App ID" };
	}
	try {
		const jwt = await signJwt(useAppId, usePem);
		const { token } = await getInstallationToken(jwt);
		cachedInstallationToken = token;
		return { ok: true };
	} catch (e: any) {
		return { ok: false, error: e?.message || "验证失败，请检查 App ID 和私钥是否正确" };
	}
}

// ============ 代理请求封装（CORS透传，带auth header） ============

async function proxyRequest(
	method: string,
	apiPath: string,
	body?: unknown,
	extraHeaders?: Record<string, string>,
): Promise<Response> {
	const token = await getAuthToken();
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
	};
	if (token) headers.Authorization = `Bearer ${token}`;
	if (extraHeaders) Object.assign(headers, extraHeaders);
	return rawProxy(method, apiPath, body, headers);
}

export async function githubApi(
	method: string,
	apiPath: string,
	body?: unknown,
): Promise<Response> {
	return proxyRequest(method, apiPath, body);
}

// ============ 兼容旧API ============

export function getStoredToken(): string {
	return cachedInstallationToken || "";
}

export function setStoredToken(_token: string): void {}

export function clearStoredToken(): void {
	invalidateToken();
}

export async function validateToken(_token?: string): Promise<boolean> {
	const result = await validateCredentials();
	return result.ok;
}

export async function checkProxyConfigured(): Promise<boolean> {
	return hasValidCredentials();
}

export function invalidateProxyCheck(): void {
	invalidateToken();
}

// ============ 文件读取工具 ============

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

// ============ Gist API 封装 ============

export async function readGistFile(
	gistId: string,
	fileName: string,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("GET", `gists/${gistId}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		const file = data.files?.[fileName];
		return file?.content || null;
	} catch {
		return null;
	}
}

export async function writeGistFile(
	gistId: string,
	fileName: string,
	content: string,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("PATCH", `gists/${gistId}`, {
			files: { [fileName]: { content } },
		});
		if (!resp.ok) invalidateToken();
		return resp.ok;
	} catch {
		invalidateToken();
		return false;
	}
}

export async function createGist(
	description: string,
	fileName: string,
	content: string,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("POST", "gists", {
			description,
			public: false,
			files: { [fileName]: { content } },
		});
		if (!resp.ok) return null;
		const data = await resp.json();
		return data.id || null;
	} catch {
		return null;
	}
}

// ============ GitHub Repo 文件操作 ============

export interface RepoConfig {
	owner: string;
	repo: string;
	branch: string;
}

function repoPath(config: RepoConfig, path: string): string {
	return `repos/${config.owner}/${config.repo}/contents/${path}`;
}

export async function getRepoFile(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<{ content: string; sha: string } | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
		return { content, sha: data.sha };
	} catch {
		return null;
	}
}

export async function updateRepoFile(
	path: string,
	content: string,
	sha: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: encodedContent,
			sha,
			branch: config.branch,
		});
		if (!resp.ok) invalidateToken();
		return resp.ok;
	} catch {
		invalidateToken();
		return false;
	}
}

export async function createRepoFile(
	path: string,
	content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const encodedContent = btoa(unescape(encodeURIComponent(content)));
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: encodedContent,
			branch: config.branch,
		});
		if (!resp.ok) invalidateToken();
		return resp.ok;
	} catch {
		invalidateToken();
		return false;
	}
}

export async function deleteRepoFile(
	path: string,
	sha: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("DELETE", repoPath(config, path), {
			message,
			sha,
			branch: config.branch,
		});
		if (!resp.ok) invalidateToken();
		return resp.ok;
	} catch {
		invalidateToken();
		return false;
	}
}

// ============ 图片上传（Base64 通过 Contents API） ============

export async function uploadImageToRepo(
	imagePath: string,
	base64Content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<string | null> {
	try {
		const existing = await getRepoFile(imagePath, config);
		let resp;
		if (existing) {
			resp = await proxyRequest("PUT", repoPath(config, imagePath), {
				message,
				content: base64Content,
				sha: existing.sha,
				branch: config.branch,
			});
		} else {
			resp = await proxyRequest("PUT", repoPath(config, imagePath), {
				message,
				content: base64Content,
				branch: config.branch,
			});
		}
		if (!resp.ok) {
			invalidateToken();
			const text = await resp.text().catch(() => "");
			throw new Error(`上传失败 (${resp.status}): ${text}`);
		}
		return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${imagePath}`;
	} catch (e) {
		console.error("图片上传失败:", e);
		return null;
	}
}

// ============ Toast 通知 ============

export function showToast(
	message: string,
	type: "success" | "error" | "info" | "warning" = "info",
) {
	if (typeof window === "undefined") return;
	const event = new CustomEvent("edit-mode:toast", {
		detail: { message, type },
	});
	window.dispatchEvent(event);
}

// ============ 深拷贝工具 ============

export function deepClone<T>(obj: T): T {
	return JSON.parse(JSON.stringify(obj));
}

export function genId(prefix: string = "id"): string {
	return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ensureIconify(): void {
	if (typeof window === "undefined") return;
	if ((window as any)._iconifyLoaded) return;
	(window as any)._iconifyLoaded = true;
	const script = document.createElement("script");
	script.src = "https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js";
	script.async = true;
	document.head.appendChild(script);
}

// ============ 草稿暂存与批量提交 ============

export interface DraftChange {
	id: string;
	pageKey: string;
	pageName: string;
	description: string;
	operation: "create" | "update" | "delete";
	timestamp: number;
	payload: Record<string, any>;
}

interface DraftStore {
	changes: DraftChange[];
}

function readDraftStore(): DraftStore {
	try {
		const raw = localStorage.getItem(STORAGE_DRAFTS);
		if (!raw) return { changes: [] };
		return JSON.parse(raw);
	} catch {
		return { changes: [] };
	}
}

function writeDraftStore(store: DraftStore): void {
	try {
		localStorage.setItem(STORAGE_DRAFTS, JSON.stringify(store));
		dispatchDraftsChanged();
	} catch {}
}

function dispatchDraftsChanged(): void {
	if (typeof window === "undefined") return;
	const evt = new CustomEvent("edit-mode:drafts-changed", {
		detail: { count: getDraftCount() },
	});
	window.dispatchEvent(evt);
}

export function getDraftCount(): number {
	return readDraftStore().changes.length;
}

export function getAllDrafts(): DraftChange[] {
	return readDraftStore().changes;
}

export function getDraftsByPage(pageKey: string): DraftChange[] {
	return readDraftStore().changes.filter(c => c.pageKey === pageKey);
}

export function saveDraft(change: Omit<DraftChange, "id" | "timestamp">): DraftChange {
	const store = readDraftStore();
	const newChange: DraftChange = {
		...change,
		id: `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		timestamp: Date.now(),
	};
	store.changes.push(newChange);
	writeDraftStore(store);
	return newChange;
}

export function removeDraft(id: string): void {
	const store = readDraftStore();
	store.changes = store.changes.filter(c => c.id !== id);
	writeDraftStore(store);
}

export function clearAllDrafts(): void {
	writeDraftStore({ changes: [] });
}

export function clearDraftsByPage(pageKey: string): void {
	const store = readDraftStore();
	store.changes = store.changes.filter(c => c.pageKey !== pageKey);
	writeDraftStore(store);
}

type SubmitHandler = (change: DraftChange, token: string) => Promise<boolean>;

const submitHandlers = new Map<string, SubmitHandler>();

export function registerSubmitHandler(pageKey: string, handler: SubmitHandler): void {
	submitHandlers.set(pageKey, handler);
}

export async function submitAllDrafts(): Promise<{ success: number; failed: number; errors: string[] }> {
	const token = await getAuthToken();
	if (!token) {
		return { success: 0, failed: 0, errors: ["未认证，请先导入私钥"] };
	}
	const drafts = getAllDrafts();
	const success: string[] = [];
	const errors: string[] = [];
	const toRemove: string[] = [];
	for (const draft of drafts) {
		const handler = submitHandlers.get(draft.pageKey);
		if (!handler) {
			errors.push(`${draft.pageName}: 暂不支持提交`);
			continue;
		}
		try {
			const ok = await handler(draft, token);
			if (ok) {
				success.push(draft.id);
				toRemove.push(draft.id);
			} else {
				errors.push(`${draft.description}: 提交失败`);
			}
		} catch (e: any) {
			errors.push(`${draft.description}: ${e?.message || "未知错误"}`);
		}
	}
	if (toRemove.length > 0) {
		const store = readDraftStore();
		store.changes = store.changes.filter(c => !toRemove.includes(c.id));
		writeDraftStore(store);
	}
	return { success: success.length, failed: errors.length, errors };
}

export function onDraftsChanged(callback: (count: number) => void): () => void {
	const handler = (e: Event) => {
		const detail = (e as CustomEvent).detail;
		callback(detail?.count ?? 0);
	};
	window.addEventListener("edit-mode:drafts-changed", handler);
	return () => window.removeEventListener("edit-mode:drafts-changed", handler);
}
