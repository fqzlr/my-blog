/**
 * Astro API Route - GitHub API 代理
 * 透传客户端 JWT 认证到 GitHub API
 */

import type { APIRoute } from "astro";

const GH_API = "https://api.github.com";

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const path = url.searchParams.get("path");

  // GET /api/github → 状态检查
  if (!path) {
    const hasAppId = !!import.meta.env.GH_APP_ID;
    return new Response(
      JSON.stringify({
        ok: true,
        status: "proxy-ready",
        serverAuth: false, // Astro/Vercel 不做服务端签名
        hasAppId,
        appId: hasAppId ? import.meta.env.GH_APP_ID : "",
        message: hasAppId
          ? "GitHub proxy is running. App ID available. Import PEM key to authenticate."
          : "GitHub proxy is running. Import your .pem key to authenticate.",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
        },
      }
    );
  }

  // GET with path → 转发 API 请求（透传客户端 Authorization）
  const clientAuth = request.headers.get("Authorization") || request.headers.get("authorization");
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Blog-Editor-Proxy-Astro",
  };
  if (clientAuth) {
    headers.Authorization = clientAuth;
  }

  const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
  const resp = await fetch(targetUrl, { method: "GET", headers });
  const text = await resp.text();

  return new Response(text, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
    },
  });
};

export const POST: APIRoute = async ({ request }) => {
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { path, method, headers = {}, body: reqBody } = body;
  if (!path || typeof path !== "string") {
    return new Response(JSON.stringify({ error: "Missing 'path' field in request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const httpMethod = (method || "POST").toUpperCase();

  // 构建请求头
  const reqHeaders: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "Blog-Editor-Proxy-Astro",
  };

  // 透传客户端 Authorization
  const hasClientAuth = headers.Authorization || headers.authorization;
  if (hasClientAuth) {
    reqHeaders.Authorization = hasClientAuth;
  }

  // 添加其他客户端头
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase();
    if (lower === "host" || lower === "content-length") continue;
    if (typeof value === "string") {
      reqHeaders[key] = value;
    }
  }

  const targetUrl = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
  const fetchOpts: RequestInit = {
    method: httpMethod,
    headers: reqHeaders,
  };

  if (reqBody !== undefined && httpMethod !== "GET") {
    reqHeaders["Content-Type"] = reqHeaders["Content-Type"] || "application/json";
    fetchOpts.body = typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody);
  }

  const resp = await fetch(targetUrl, fetchOpts);
  const text = await resp.text();

  return new Response(text, {
    status: resp.status,
    headers: {
      "Content-Type": resp.headers.get("Content-Type") || "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
    },
  });
};

export const OPTIONS: APIRoute = () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept, X-GitHub-Api-Version, User-Agent",
      "Access-Control-Max-Age": "86400",
    },
  });
};
