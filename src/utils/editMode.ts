/**
 * 在线编辑模式 - 核心工具库
 * 使用服务端代理进行 GitHub API 认证：
 * 1. 私钥和 App ID 存储在服务器环境变量（Vercel/Cloudflare）
 * 2. 所有 GitHub API 请求通过 /api/github 代理转发
 * 3. 代理服务器自动处理 JWT 签名和安装令牌刷新
 */

import { repoConfig } from "@/config/editConfig";

const PROXY_URL = "/api/github";

let proxyConfigured: boolean | null = null;

export async function checkProxyConfigured(): Promise<boolean> {
	if (proxyConfigured !== null) return proxyConfigured;
	try {
		const resp = await fetch(PROXY_URL, { method: "GET" });
		const data = await resp.json();
		proxyConfigured = data.configured === true;
		return proxyConfigured;
	} catch {
		proxyConfigured = false;
		return false;
	}
}

export function invalidateProxyCheck(): void {
	proxyConfigured = null;
}

// ============ 兼容旧的凭据管理 API（不再需要本地存储） ============

export function getStoredAppId(): string {
	return "";
}

export function setStoredAppId(_appId: string): void {
	// no-op: 凭据已在服务端配置
}

export function getStoredPrivateKey(): string {
	return "";
}

export function setStoredPrivateKey(_pem: string): void {
	// no-op: 凭据已在服务端配置
}

export function clearStoredCredentials(): void {
	invalidateProxyCheck();
}

export function hasValidCredentials(): boolean {
	return proxyConfigured === true;
}

export function hasValidToken(): boolean {
	return proxyConfigured === true;
}

export function getStoredToken(): string {
	return "";
}

export function setStoredToken(_token: string): void {
	// no-op
}

export function clearStoredToken(): void {
	invalidateProxyCheck();
}

export async function validateCredentials(_appId?: string, _pem?: string): Promise<{ ok: boolean; error?: string }> {
	const ok = await checkProxyConfigured();
	if (ok) return { ok: true };
	return {
		ok: false,
		error: "后端 GitHub 代理未配置，请在部署平台设置 GH_APP_ID 和 GH_PRIVATE_KEY 环境变量",
	};
}

// ============ 代理请求封装 ============

async function proxyRequest(
	method: string,
	apiPath: string,
	body?: unknown,
): Promise<Response> {
	const resp = await fetch(PROXY_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ path: apiPath, method, body }),
	});
	return resp;
}

export async function githubApi(
	method: string,
	apiPath: string,
	body?: unknown,
): Promise<Response> {
	return proxyRequest(method, apiPath, body);
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
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
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
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
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
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
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
		if (!resp.ok) invalidateProxyCheck();
		return resp.ok;
	} catch {
		invalidateProxyCheck();
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
			invalidateProxyCheck();
			const text = await resp.text().catch(() => "");
			throw new Error(`上传失败 (${resp.status}): ${text}`);
		}
		return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${imagePath}`;
	} catch (e) {
		console.error("图片上传失败:", e);
		return null;
	}
}

export async function validateToken(_token?: string): Promise<boolean> {
	return checkProxyConfigured();
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
