import { getInstallationTokenServer } from "../../src/workers/github-auth.js";

export const config = {
	runtime: "edge",
};

const GH_API = "https://api.github.com";
const FRIENDS_CONFIG_FILE = "src/config/friendsConfig.ts";

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

function getEnv() {
	return {
		PUBLIC_GITHUB_APP_ID: process.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || "",
		PUBLIC_GITHUB_OWNER: process.env.PUBLIC_GITHUB_OWNER || "",
		PUBLIC_GITHUB_REPO: process.env.PUBLIC_GITHUB_REPO || "",
	};
}

function checkConfig(env) {
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
	return null;
}

async function getToken(env) {
	try {
		return await getInstallationTokenServer(env);
	} catch (e) {
		console.error("[config/friends] Token generation failed:", e);
		return null;
	}
}

function parseFriendsFromTS(content) {
	const friendsMatch = content.match(/export const friendsConfig: FriendLink\[\] = \[([\s\S]*?)\];/);
	if (!friendsMatch) return [];

	const friendsStr = friendsMatch[1];
	const friendRegex = /\{\s*title:\s*"([^"]*)",\s*imgurl:\s*"([^"]*)",\s*desc:\s*"([^"]*)",\s*siteurl:\s*"([^"]*)",\s*tags:\s*\[([^\]]*)\],\s*weight:\s*(\d+),\s*enabled:\s*(true|false)\s*\}/g;

	const friends = [];
	let match;
	while ((match = friendRegex.exec(friendsStr)) !== null) {
		const tags = match[5]
			.split(",")
			.map((t) => t.trim().replace(/"/g, ""))
			.filter((t) => t);
		friends.push({
			title: match[1],
			imgurl: match[2],
			desc: match[3],
			siteurl: match[4],
			tags,
			weight: Number.parseInt(match[6], 10),
			enabled: match[7] === "true",
		});
	}
	return friends;
}

export default async function handler(request) {
	const env = getEnv();
	const configError = checkConfig(env);
	if (configError) return configError;

	const token = await getToken(env);
	if (!token) {
		return new Response(JSON.stringify({ error: "GitHub 认证失败" }), {
			status: 503,
			headers: { "Content-Type": "application/json" },
		});
	}

	const owner = env.PUBLIC_GITHUB_OWNER || "fqzlr";
	const repo = env.PUBLIC_GITHUB_REPO || "my-blog";
	const branch = "master";

	if (request.method === "GET") {
		// 读取 friendsConfig.ts 并解析友链列表
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
			const friends = parseFriendsFromTS(content);
			return new Response(JSON.stringify({ friends }), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			});
		} catch (e) {
			return new Response(JSON.stringify({ error: "解析配置文件失败" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}

	if (request.method === "PUT") {
		// 更新 friendsConfig.ts
		let body;
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

		// 先获取当前文件的 SHA
		const getResp = await ghRequest(
			"GET",
			`repos/${owner}/${repo}/contents/${FRIENDS_CONFIG_FILE}?ref=${branch}`,
			token,
		);

		let fileSha = null;
		if (getResp.status === 200) {
			const data = await getResp.json();
			fileSha = data.sha;
		}

		// 更新文件
		const encoded = btoa(unescape(encodeURIComponent(content)));
		const putBody = {
			message: message || "chore: update friends config",
			content: encoded,
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
			console.error("[config/friends] PUT failed:", putResp.status, errText);
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

	return new Response(JSON.stringify({ error: "Method not allowed" }), {
		status: 405,
		headers: { "Content-Type": "application/json" },
	});
}
