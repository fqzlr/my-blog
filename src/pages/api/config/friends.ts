import { getInstallationTokenServer } from "@/workers/github-auth.js";

const GH_API = "https://api.github.com";
const FRIENDS_CONFIG_FILE = "src/config/friendsConfig.ts";

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
			JSON.stringify({ error: "Friend config service is not configured" }),
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

	// 读取现有的 friendsConfig.ts
	const getResp = await ghRequest(
		"GET",
		`repos/${owner}/${repo}/contents/${FRIENDS_CONFIG_FILE}?ref=${branch}`,
		token,
	);

	if (getResp.status !== 200) {
		return new Response(JSON.stringify({ error: "读取配置文件失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	const data = await getResp.json();
	try {
		const content = decodeURIComponent(escape(atob(data.content.replace(/\n/g, ""))));
		
		// 解析友链数组
		const friendsMatch = content.match(/export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\];/);
		if (!friendsMatch) {
			return new Response(JSON.stringify({ error: "无法解析友链配置" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}

		// 简单解析友链对象（这是一个简化的解析器）
		const friendsArrayStr = friendsMatch[1];
		const friends: any[] = [];
		
		// 使用正则表达式提取每个友链对象
		const friendRegex = /\{\s*title:\s*"([^"]*)",\s*imgurl:\s*"([^"]*)",\s*desc:\s*"([^"]*)",\s*siteurl:\s*"([^"]*)",\s*tags:\s*\[([^\]]*)\],\s*weight:\s*(\d+),\s*enabled:\s*(true|false)\s*\}/g;
		let match;
		
		while ((match = friendRegex.exec(friendsArrayStr)) !== null) {
			const tagsStr = match[5];
			const tags = tagsStr.split(",").map(t => t.trim().replace(/"/g, "")).filter(Boolean);
			
			friends.push({
				title: match[1],
				imgurl: match[2],
				desc: match[3],
				siteurl: match[4],
				tags: tags,
				weight: parseInt(match[6]),
				enabled: match[7] === "true",
			});
		}

		return new Response(JSON.stringify({ friends, sha: data.sha }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	} catch (error) {
		console.error("解析友链配置失败:", error);
		return new Response(JSON.stringify({ error: "解析配置文件失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
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
			JSON.stringify({ error: "Friend config service is not configured" }),
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

	const { content } = body;

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
		`repos/${owner}/${repo}/contents/${FRIENDS_CONFIG_FILE}?ref=${branch}`,
		token,
	);

	let fileSha: string | null = null;
	if (getResp.status === 200) {
		const data = await getResp.json();
		fileSha = data.sha;
	}

	// 编码内容
	const encodedContent = btoa(unescape(encodeURIComponent(content)));

	// 更新文件
	const putBody: any = {
		message: "chore: update friends config via review",
		content: encodedContent,
		branch,
	};
	if (fileSha) putBody.sha = fileSha;

	const putResp = await ghRequest(
		"PUT",
		`repos/${owner}/${repo}/contents/${FRIENDS_CONFIG_FILE}`,
		token,
		putBody,
	);

	if (!putResp.ok) {
		const errText = await putResp.text().catch(() => "");
		console.error("[friends-config] PUT failed:", putResp.status, errText);
		if (putResp.status === 409) {
			return new Response(JSON.stringify({ error: "提交冲突，请稍后重试" }), {
				status: 409,
				headers: { "Content-Type": "application/json" },
			});
		}
		return new Response(JSON.stringify({ error: "更新配置文件失败" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}

	return new Response(JSON.stringify({ ok: true }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}
