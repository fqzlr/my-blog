/**
 * 鍦ㄧ嚎缂栬緫妯″紡 - 鏍稿績宸ュ叿搴�
 * 鍓嶇�瀵煎叆 GitHub App 绉侀挜璁よ瘉锛�
 * 1. 鐢ㄦ埛鍦ㄦ祻瑙堝櫒瀵煎叆 .pem 绉侀挜鏂囦欢骞惰緭鍏� App ID
 * 2. 娴忚�鍣ㄧ�浣跨敤 Web Crypto API 杩涜� JWT 绛惧悕
 * 3. 閫氳繃 /api/github 浠ｇ悊杞�彂璇锋眰锛堣В鍐矯ORS闂��锛�
 * 4. 绉侀挜浠呬繚瀛樺湪娴忚�鍣ㄥ唴瀛�/localStorage涓�紝涓嶄笂浼犳湇鍔″櫒
 */

import { repoConfig } from "@/config/editConfig";

const PROXY_URL = "/api/github";
const STORAGE_APP_ID = "gh_app_id";
const STORAGE_PRIVATE_KEY = "gh_private_key";
const STORAGE_DRAFTS = "gh_drafts";
const STORAGE_DRAFT_META = "gh_draft_meta";

let cachedInstallationToken: string | null = null;
let tokenExpiresAt = 0;
let serverAuthAvailable = false;
let proxyAppIdAvailable = false;

export function isServerAuth(): boolean {
	return serverAuthAvailable;
}

export function isProxyAppIdAvailable(): boolean {
	return proxyAppIdAvailable;
}

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

	// INTEGER version (0)
	const versionInt = new Uint8Array([0x02, 0x01, 0x00]);

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
	const inner = new Uint8Array(versionInt.length + algorithmIdentifier.length + wrappedKey.length);
	inner.set(versionInt, 0);
	inner.set(algorithmIdentifier, versionInt.length);
	inner.set(wrappedKey, versionInt.length + algorithmIdentifier.length);
	const pkcs8 = wrapDer(0x30, inner);
	return pkcs8.buffer as ArrayBuffer;
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
		// Long-form length encoding: der[2..3] = length, der[4] = first content byte
		// PKCS#1: der[4] = 0x02 (INTEGER version tag)
		// PKCS#8: der[4] = 0x02 (INTEGER version tag) — both have it, need deeper check
		// PKCS#1 version INTEGER is at offset 4, then modulus INTEGER at offset 4+3=7
		// PKCS#8 version INTEGER is at offset 4, then AlgorithmIdentifier SEQUENCE (0x30) at offset 4+3=7
		const afterVersion = new Uint8Array(der, 7, 1)[0];
		if (afterVersion === 0x02) {
			// PKCS#1: after version INTEGER comes another INTEGER (modulus)
			keyData = pkcs1ToPkcs8(der);
		} else {
			// PKCS#8: after version INTEGER comes SEQUENCE (AlgorithmIdentifier)
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
		throw new Error(`鑾峰彇 Installation 鍒楄〃澶辫触 (${resp.status}): ${text}`);
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
		throw new Error("鏈�壘鍒� GitHub App Installation锛岃�纭�� App 宸插畨瑁呭埌鐩�爣浠撳簱");
	}
	const tokenResp = await rawProxy(
		"POST",
		`app/installations/${installationId}/access_tokens`,
		{},
		authHeaders,
	);
	if (!tokenResp.ok) {
		const text = await tokenResp.text().catch(() => "");
		throw new Error(`鑾峰彇 Installation Token 澶辫触 (${tokenResp.status}): ${text}`);
	}
	const data = await tokenResp.json();
	return {
		token: data.token,
		expiresAt: new Date(data.expires_at).getTime() - 60_000,
	};
}

export async function getAuthToken(): Promise<string | null> {
	// 如果服务端代理可认证，返回 null（代理会自动添加 token）
	if (serverAuthAvailable) return null;
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
		console.error("鑾峰彇 GitHub Token 澶辫触:", e);
		clearStoredCredentials();
		return null;
	}
}

export function invalidateToken(): void {
	cachedInstallationToken = null;
	tokenExpiresAt = 0;
}

// ============ 鍑�嵁绠＄悊 ============

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
	// 如果有服务端代理认证，始终返回有效
	if (serverAuthAvailable) return true;
	return !!getStoredAppId() && !!getStoredPrivateKey();
}

export function hasValidToken(): boolean {
	return cachedInstallationToken !== null && Date.now() < tokenExpiresAt;
}

export async function validateCredentials(appId?: string, pem?: string): Promise<{ ok: boolean; error?: string }> {
	const useAppId = appId || getStoredAppId();
	const usePem = pem || getStoredPrivateKey();
	if (!useAppId || !usePem) {
		return { ok: false, error: "璇峰厛瀵煎叆 GitHub App 绉侀挜鏂囦欢骞跺～鍐� App ID" };
	}
	try {
		const jwt = await signJwt(useAppId, usePem);
		const { token } = await getInstallationToken(jwt);
		cachedInstallationToken = token;
		return { ok: true };
	} catch (e: any) {
		return { ok: false, error: e?.message || "楠岃瘉澶辫触锛岃�妫€鏌� App ID 鍜岀�閽ユ槸鍚︽�纭�" };
	}
}

// ============ 浠ｇ悊璇锋眰灏佽�锛圕ORS閫忎紶锛屽甫auth header锛� ============

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

// ============ 鍏煎�鏃�PI ============

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
	try {
		const resp = await fetch(PROXY_URL);
		if (!resp.ok) return false;
		const data = await resp.json();
		if (data.serverAuth) {
			serverAuthAvailable = true;
			return true;
		}
		// 服务端有 App ID 但没有 PEM，客户端只需导入 PEM
		if (data.hasAppId && data.appId) {
			proxyAppIdAvailable = true;
			// 将服务端 App ID 存入 localStorage，供客户端 JWT 签名使用
			if (!getStoredAppId()) {
				setStoredAppId(data.appId);
			}
		}
		return hasValidCredentials();
	} catch {
		return false;
	}
}

export function invalidateProxyCheck(): void {
	invalidateToken();
}

// ============ 鏂囦欢璇诲彇宸ュ叿 ============

export function readFileAsText(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result || ""));
		reader.onerror = reject;
		reader.readAsText(file);
	});
}

// ============ Gist API 灏佽� ============

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

// ============ GitHub Repo 鏂囦欢鎿嶄綔 ============

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

// ============ 鍥剧墖涓婁紶锛圔ase64 閫氳繃 Contents API锛� ============

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
			throw new Error(`涓婁紶澶辫触 (${resp.status}): ${text}`);
		}
		return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${imagePath}`;
	} catch (e) {
		console.error("鍥剧墖涓婁紶澶辫触:", e);
		return null;
	}
}

/** 获取仓库文件元信息（SHA、大小），不解码内容，适合二进制文件 */
export async function getRepoFileMeta(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<{ sha: string; size: number } | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		return { sha: data.sha, size: data.size || 0 };
	} catch {
		return null;
	}
}

/** 批量获取目录中所有文件的元信息 */
export async function listRepoFiles(
	dirPath: string,
	config: RepoConfig = repoConfig,
): Promise<Array<{ name: string; path: string; sha: string; size: number }>> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, dirPath)}?ref=${config.branch}`);
		if (!resp.ok) return [];
		const items = await resp.json();
		if (!Array.isArray(items)) return [];
		return items
			.filter((i: any) => i.type === "file")
			.map((i: any) => ({ name: i.name, path: i.path, sha: i.sha, size: i.size || 0 }));
	} catch {
		return [];
	}
}

/** 获取文件原始 base64 内容（不解码，适合二进制文件如图片） */
export async function getRepoFileBase64(
	path: string,
	config: RepoConfig = repoConfig,
): Promise<string | null> {
	try {
		const resp = await proxyRequest("GET", `${repoPath(config, path)}?ref=${config.branch}`);
		if (!resp.ok) return null;
		const data = await resp.json();
		return data.content.replace(/\n/g, "");
	} catch {
		return null;
	}
}

/** 创建仓库文件，内容已经是 base64 编码（用于二进制文件如图片） */
export async function createRepoFileRawBase64(
	path: string,
	base64Content: string,
	message: string,
	config: RepoConfig = repoConfig,
): Promise<boolean> {
	try {
		const resp = await proxyRequest("PUT", repoPath(config, path), {
			message,
			content: base64Content,
			branch: config.branch,
		});
		if (!resp.ok) invalidateToken();
		return resp.ok;
	} catch {
		invalidateToken();
		return false;
	}
}

// ============ Toast 閫氱煡 ============

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

// ============ 娣辨嫹璐濆伐鍏� ============

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

// ============ 鑽夌ǹ鏆傚瓨涓庢壒閲忔彁浜� ============

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

/** 获取指定页面的最新草稿数据（简化 API） */
export function getDraft<T = any>(pageKey: string): T | null {
	const drafts = getDraftsByPage(pageKey);
	if (drafts.length === 0) return null;
	return drafts[drafts.length - 1].payload as T;
}

/** 删除指定页面的所有草稿（简化 API） */
export function deleteDraft(pageKey: string): void {
	clearDraftsByPage(pageKey);
}

type SubmitHandler = (change: DraftChange, token: string) => Promise<boolean>;

const submitHandlers = new Map<string, SubmitHandler>();

export function registerSubmitHandler(pageKey: string, handler: SubmitHandler): void {
	submitHandlers.set(pageKey, handler);
}

export async function submitAllDrafts(): Promise<{ success: number; failed: number; errors: string[] }> {
	const token = await getAuthToken();
	if (!token) {
		return { success: 0, failed: 0, errors: ["鏈��璇侊紝璇峰厛瀵煎叆绉侀挜"] };
	}
	const drafts = getAllDrafts();
	const success: string[] = [];
	const errors: string[] = [];
	const toRemove: string[] = [];
	for (const draft of drafts) {
		const handler = submitHandlers.get(draft.pageKey);
		if (!handler) {
			errors.push(`${draft.pageName}: 鏆備笉鏀�寔鎻愪氦`);
			continue;
		}
		try {
			const ok = await handler(draft, token);
			if (ok) {
				success.push(draft.id);
				toRemove.push(draft.id);
			} else {
				errors.push(`${draft.description}: 鎻愪氦澶辫触`);
			}
		} catch (e: any) {
			errors.push(`${draft.description}: ${e?.message || "鏈�煡閿欒�"}`);
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

// ============ Gist 类型编辑器草稿辅助 ============
