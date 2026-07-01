import { handleGithubProxy } from "../src/workers/github-proxy.js";

export const config = {
	runtime: "edge",
};

export default async function handler(request) {
	// Vercel Edge: 通过 process.env 传递环境变量给代理
	const env = {
		GH_APP_ID: process.env.PUBLIC_GITHUB_APP_ID || "",
		GH_PRIVATE_KEY: process.env.GH_PRIVATE_KEY || "",
		GH_USER: process.env.PUBLIC_GITHUB_OWNER || "",
		GH_REPO: process.env.PUBLIC_GITHUB_REPO || "",
		VERCEL_ENV: process.env.VERCEL_ENV || "development",
		VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF || "master",
	};
	return handleGithubProxy(request, env);
}
