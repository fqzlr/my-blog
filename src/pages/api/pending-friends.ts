import { getInstallationTokenServer } from "@/workers/github-auth.js";

const GH_API = "https://api.github.com";
const PENDING_FILE = "data/pending-friends.json";

async function ghRequest(method: string, path: string, token: string, body: any = null) {
	const url = path.startsWith("http") ? path : `${GH_API}/${path.replace(/^\//, "")}`;
	const opts: RequestInit = {
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

export async function GET({ request }: { request: Request }) {
	const env = {
		PUBLIC_GITHUB_APP_ID: import.meta.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: import.meta.env.GH_PRIVATE_KEY || "",
		PUBLIC_GITHUB_OWNER: import.meta.env.PUBLIC_GITHUB_OWNER || "",
		PUBLIC_GITHUB_REPO: import.meta.env.PUBLIC_GITHUB_REPO || "",
	};

	// 检查服务端认证是否可用
	if (!env.PUBLIC_GITHUB_APP_ID || !env.GH_PRIVATE_KEY) {
		return new Response(
			JSON.stringify({ error: "Friend apply service is not configured" }),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	// 获取 GitHub Token
	const token = await getInstallationTokenServer(env);
	if (!token) {
		return new Response(JSON.stringify({ error: "服务暂时不可用，请稍后再试" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}

	const owner = env.PUBLIC_GITHUB_OWNER || "fqzlr";
	const repo = env.PUBLIC_GITHUB_REPO || "my-blog";
	const branch = "master";

	// 读取现有的 pending-friends.json
	let pendingFriends: any[] = [];

	const getResp = await ghRequest(
		"GET",
		`repos/${owner}/${repo}/contents/${PENDING_FILE}?ref=${branch}`,
		token,
	);

	if (getResp.status === 200) {
		const data = await getResp.json();
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

	return new Response(JSON.stringify({ pendingFriends }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

export async function PUT({ request }: { request: Request }) {
	const env = {
		PUBLIC_GITHUB_APP_ID: import.meta.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: import.meta.env.GH_PRIVATE_KEY || "",
		PUBLIC_GITHUB_OWNER: import.meta.env.PUBLIC_GITHUB_OWNER || "",
		PUBLIC_GITHUB_REPO: import.meta.env.PUBLIC_GITHUB_REPO || "",
	};

	// 检查服务端认证是否可用
	if (!env.PUBLIC_GITHUB_APP_ID || !env.GH_PRIVATE_KEY) {
		return new Response(
			JSON.stringify({ error: "Friend apply service is not configured" }),
			{ status: 503, headers: { "Content-Type": "application/json" } },
		);
	}

	// 解析请求体
	let body: any;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify({ error: "Invalid JSON" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	const { content, message } = body;

	if (!content || typeof content !== "string") {
		return new Response(JSON.stringify({ error: "缺少内容" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	// 获取 GitHub Token
	const token = await getInstallationTokenServer(env);
	if (!token) {
		return new Response(JSON.stringify({ error: "服务暂时不可用，请稍后再试" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}

	const owner = env.PUBLIC_GITHUB_OWNER || "fqzlr";
	const repo = env.PUBLIC_GITHUB_REPO || "my-blog";
	const branch = "master";

	// 先获取当前文件的 SHA
	const getResp = await ghRequest(
		"GET",
		`repos/${owner}/${repo}/contents/${PENDING_FILE}?ref=${branch}`,
		token,
	);

	let fileSha: string | null = null;
	if (getResp.status === 200) {
		const data = await getResp.json();
		fileSha = data.sha;
	}

	// 更新文件
	const putBody: any = {
		message: message || "chore: update pending friends",
		content: content,
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
		console.error("[pending-friends] PUT failed:", putResp.status, errText);
		if (putResp.status === 409) {
			return new Response(JSON.stringify({ error: "提交冲突，请稍后重试" }), {
				status: 409,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(JSON.stringify({ error: "更新申请列表失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
