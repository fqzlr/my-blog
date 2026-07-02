import { getInstallationTokenServer } from "../src/workers/github-auth.js";

export const config = {
	runtime: "edge",
};

const GH_API = "https://api.github.com";
const PENDING_FILE = "data/pending-friends.json";

function genId() {
	const ts = Date.now();
	const rand = Math.random().toString(36).substring(2, 8);
	return `fa-${ts}-${rand}`;
}

function isValidUrl(str) {
	try {
		const u = new URL(str);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

async function ghRequest(method, path, token, body = null) {
	const url = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
	const opts = {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "Blog-FriendApply",
		},
	};
	if (body) {
		opts.headers = { ...opts.headers, "Content-Type": "application/json" };
		opts.body = JSON.stringify(body);
	}
	return fetch(url, opts);
}

export default async function handler(request) {
	if (request.method !== "POST") {
		return new Response(JSON.stringify({ error: "Method not allowed" }), {
			status: 405,
			headers: { "Content-Type": "application/json" },
		});
	}

	const env = {
		PUBLIC_GITHUB_APP_ID: process.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || "",
		PUBLIC_GITHUB_OWNER: process.env.PUBLIC_GITHUB_OWNER || "",
		PUBLIC_GITHUB_REPO: process.env.PUBLIC_GITHUB_REPO || "",
	};

	// 检查服务端认证是否可用
	if (
		!env.PUBLIC_GITHUB_APP_ID ||
		!env.GH_PRIVATE_KEY ||
		env.PUBLIC_GITHUB_APP_ID === "your_app_id_here" ||
		env.GH_PRIVATE_KEY.includes("your_pem_private_key") ||
		env.GH_PRIVATE_KEY.includes("...")
	) {
		return new Response(
			JSON.stringify({ error: "Friend apply service is not configured: 请在 Vercel 环境变量中配置真实的 GitHub App 凭证" }),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	// 解析请求体
	let body;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { title, siteurl, imgurl, desc, tags } = body;

	// 验证必填字段
	if (!title || typeof title !== "string" || title.trim().length === 0) {
		return new Response(JSON.stringify({ error: "站点名称不能为空" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!siteurl || typeof siteurl !== "string" || !isValidUrl(siteurl)) {
		return new Response(JSON.stringify({ error: "请填写有效的站点链接" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!imgurl || typeof imgurl !== "string") {
		return new Response(JSON.stringify({ error: "请填写头像链接" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}
	if (!desc || typeof desc !== "string") {
		return new Response(JSON.stringify({ error: "请填写站点描述" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 长度限制
	if (title.length > 100) return new Response(JSON.stringify({ error: "站点名称过长" }), { status: 400, headers: { "Content-Type": "application/json" } });
	if (siteurl.length > 500) return new Response(JSON.stringify({ error: "链接过长" }), { status: 400, headers: { "Content-Type": "application/json" } });
	if (imgurl.length > 500) return new Response(JSON.stringify({ error: "头像链接过长" }), { status: 400, headers: { "Content-Type": "application/json" } });
	if (desc.length > 500) return new Response(JSON.stringify({ error: "描述过长" }), { status: 400, headers: { "Content-Type": "application/json" } });

	const cleanTags = Array.isArray(tags)
		? tags.filter((t) => typeof t === "string" && t.length <= 20).slice(0, 3)
		: ["Blog"];

	// 获取 GitHub Token
	let token;
	try {
		token = await getInstallationTokenServer(env);
	} catch (e) {
		console.error("[friend-apply] Token generation failed:", e);
		token = null;
	}
	if (!token) {
		return new Response(
			JSON.stringify({ error: "GitHub 认证失败，请检查 Vercel 环境变量中的 GitHub App 配置" }),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	const owner = env.PUBLIC_GITHUB_OWNER || "fqzlr";
	const repo = env.PUBLIC_GITHUB_REPO || "my-blog";
	const branch = "master";

	// 读取现有的 pending-friends.json
	let pendingFriends = [];
	let fileSha = null;

	const getResp = await ghRequest(
		"GET",
		`repos/${owner}/${repo}/contents/${PENDING_FILE}?ref=${branch}`,
		token,
	);

	if (getResp.status === 200) {
		const data = await getResp.json();
		fileSha = data.sha;
		try {
			const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
			pendingFriends = JSON.parse(content);
			if (!Array.isArray(pendingFriends)) pendingFriends = [];
		} catch {
			pendingFriends = [];
		}
	} else if (getResp.status !== 404) {
		return new Response(JSON.stringify({ error: "读取申请列表失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 检查是否已有相同 URL 的待审核申请
	const normalizedUrl = siteurl.replace(/\/+$/, "").toLowerCase();
	const duplicate = pendingFriends.some(
		(f) => f.siteurl.replace(/\/+$/, "").toLowerCase() === normalizedUrl,
	);
	if (duplicate) {
		return new Response(JSON.stringify({ error: "该站点已提交过申请，请勿重复提交" }), {
			status: 409,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 添加新申请
	const newApply = {
		id: genId(),
		title: title.trim(),
		siteurl: siteurl.trim(),
		imgurl: imgurl.trim(),
		desc: desc.trim(),
		tags: cleanTags,
		appliedAt: new Date().toISOString(),
	};
	pendingFriends.push(newApply);

	// 提交到 GitHub
	const content = JSON.stringify(pendingFriends, null, 2);
	const encoded = btoa(unescape(encodeURIComponent(content)));

	const putBody = {
		message: `chore: friend apply from ${title.trim()}`,
		content: encoded,
		branch,
	};
	if (fileSha) putBody.sha = fileSha;

	const putResp = await ghRequest(
		"PUT",
		`repos/${owner}/${repo}/contents/${PENDING_FILE}`,
		token,
		putBody,
	);

	if (!putResp.ok) {
		const errText = await putResp.text().catch(() => "");
		console.error("[friend-apply] PUT failed:", putResp.status, errText);
		if (putResp.status === 409) {
			return new Response(JSON.stringify({ error: "提交冲突，请稍后重试" }), {
				status: 409,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(JSON.stringify({ error: "提交申请失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(
		JSON.stringify({ ok: true, message: "申请已提交，等待站长审核", id: newApply.id }),
		{ status: 201, headers: { "Content-Type": "application/json" } },
	);
}
