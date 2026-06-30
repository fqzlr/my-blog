import { handleGithubProxy } from "../src/workers/github-proxy.js";

export const config = {
	runtime: "edge",
};

export default async function handler(request) {
	// Vercel Edge: 通过 process.env 传递环境变量给代理
	const env = {
		GH_APP_ID: process.env.GH_APP_ID || "",
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || "",
		GH_USER: process.env.GH_USER || "",
		GH_REPO: process.env.GH_REPO || "",
		GH_TOKEN: process.env.GH_TOKEN || "",
	};
	return handleGithubProxy(request, env);
}
