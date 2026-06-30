/**
 * GitHub API 测试端点
 * 用于验证 GitHub App 认证是否正常工作
 */

import { repoConfig } from "@/config/editConfig";
import { getRepoFile } from "@/utils/editMode";

export async function GET() {
	try {
		// 尝试读取 moments.json 文件
		const result = await getRepoFile("public/moments.json", repoConfig);
		
		if (result) {
			return new Response(JSON.stringify({
				success: true,
				message: "GitHub API 连接成功！",
				fileExists: true,
				contentLength: result.content.length,
				sha: result.sha.substring(0, 8) + "...",
				config: {
					owner: repoConfig.owner,
					repo: repoConfig.repo,
					branch: repoConfig.branch,
					hasAppId: !!repoConfig.appId
				}
			}, null, 2), {
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		} else {
			return new Response(JSON.stringify({
				success: true,
				message: "GitHub API 连接成功，但文件不存在（首次提交时会创建）",
				fileExists: false,
				config: {
					owner: repoConfig.owner,
					repo: repoConfig.repo,
					branch: repoConfig.branch,
					hasAppId: !!repoConfig.appId
				}
			}, null, 2), {
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*"
				}
			});
		}
	} catch (error: any) {
		return new Response(JSON.stringify({
			success: false,
			error: error.message || String(error),
			config: {
				owner: repoConfig.owner,
				repo: repoConfig.repo,
				branch: repoConfig.branch,
				hasAppId: !!repoConfig.appId
			}
		}, null, 2), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*"
			}
		});
	}
}
