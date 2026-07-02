/**
 * GitHub API 代理 - 支持服务端 GitHub App 认证
 * 如果配置了 PUBLIC_GITHUB_APP_ID + GH_PRIVATE_KEY 环境变量，自动为请求添加认证
 * 客户端无需导入 PEM 私钥
 * 同时支持 Cloudflare Workers 和 Vercel Edge Functions
 */

import { getInstallationTokenServer } from "./github-auth.js";

const GH_API = "https://api.github.com";

function corsHeaders(extra = {}) {
	return {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
		"Access-Control-Allow-Headers":
			"Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
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

// ============ 服务端 GitHub App 认证（已迁移至 github-auth.js） ============

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
		const hasServerAuth = !!(
			env &&
			env.PUBLIC_GITHUB_APP_ID &&
			env.GH_PRIVATE_KEY
		);
		const hasAppId = !!(env && env.PUBLIC_GITHUB_APP_ID);
		if (!path) {
			return jsonResponse({
				ok: true,
				status: "proxy-ready",
				serverAuth: hasServerAuth,
				hasAppId,
				appId: hasAppId ? env.PUBLIC_GITHUB_APP_ID : "",
				message: hasServerAuth
					? "GitHub proxy with server-side auth is running."
					: hasAppId
						? "GitHub proxy is running. App ID available. Import PEM key to authenticate."
						: "GitHub proxy is running. Import your .pem key to authenticate.",
			});
		}
		// GET with path → 转发 API 请求
		// 如果客户端已提供 Authorization，直接透传；否则尝试服务端认证
		const clientAuth =
			request.headers.get("Authorization") ||
			request.headers.get("authorization");
		const clientAuthObj = {};
		if (clientAuth) {
			clientAuthObj.Authorization = clientAuth;
		}
		let extraHeaders = { ...clientAuthObj };
		if (!clientAuth && env && env.PUBLIC_GITHUB_APP_ID && env.GH_PRIVATE_KEY) {
			const serverToken = await getInstallationTokenServer(env);
			if (serverToken) {
				extraHeaders = { Authorization: `Bearer ${serverToken}` };
			}
		}
		return forwardRequest("GET", path, null, extraHeaders);
	}

	if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) {
		let body;
		try {
			body = await request.json();
		} catch {
			return jsonResponse({ error: "Invalid JSON body" }, 400);
		}
		const { path, method, headers = {}, body: reqBody } = body;
		if (!path || typeof path !== "string") {
			return jsonResponse(
				{ error: "Missing 'path' field in request body" },
				400,
			);
		}
		const httpMethod = (method || request.method).toUpperCase();

		// ======= 预览环境保护：禁止非生产环境写入 master 分支 =======
		if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") {
			const targetBranch = reqBody?.branch || "";
			const deployBranch = env.VERCEL_GIT_COMMIT_REF || "";
			// 如果写入目标是 master，或者没有指定分支（回退到 master），则拒绝
			if (
				targetBranch === "master" ||
				(!targetBranch && deployBranch !== "master")
			) {
				console.warn(
					`[PROXY GUARD] Blocked write to master from ${env.VERCEL_ENV} environment (deploy branch: ${deployBranch})`,
				);
				return jsonResponse(
					{
						error: "Preview environment cannot write to master branch",
						blocked: true,
						deployBranch,
						targetBranch: targetBranch || "master (default)",
					},
					403,
				);
			}
		}

		// 如果客户端没有 Authorization，且服务端有完整凭据，使用服务端认证
		const hasClientAuth = headers.Authorization || headers.authorization;
		if (
			!hasClientAuth &&
			env &&
			env.PUBLIC_GITHUB_APP_ID &&
			env.GH_PRIVATE_KEY
		) {
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
		const targetUrl = path.startsWith("http")
			? path
			: `${GH_API}/${path.replace(/^\//, "")}`;

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
			fetchOpts.body =
				typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
		}

		const resp = await fetch(targetUrl, fetchOpts);
		const text = await resp.text();

		const responseHeaders = {
			"Content-Type": resp.headers.get("Content-Type") || "application/json",
			...corsHeaders(),
		};

		return new Response(text, {
			status: resp.status,
			headers: responseHeaders,
		});
	} catch (e) {
		return jsonResponse(
			{ error: "Proxy request failed", message: e?.message || String(e) },
			502,
		);
	}
}
