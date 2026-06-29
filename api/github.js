import { handleGithubProxy } from "../src/workers/github-proxy.js";

export const config = {
	runtime: "edge",
};

export default async function handler(request) {
	return handleGithubProxy(request, process.env);
}
