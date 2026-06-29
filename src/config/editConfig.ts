/**
 * 在线编辑 - 各模块 Gist 配置
 * 统一管理各功能模块的 Gist ID 和文件名
 */

export interface EditGistConfig {
	gistId: string;
	fileName: string;
	enable: boolean;
}

// 友链编辑配置
export const friendsEditConfig: EditGistConfig = {
	enable: true,
	gistId: "a55519b0f88adac957889eddd6c1db53",
	fileName: "friends.json",
};

// 工具收藏编辑配置
export const collectionsEditConfig: EditGistConfig = {
	enable: true,
	gistId: "", // 首次编辑时自动创建
	fileName: "collections.json",
};

// 番剧/影视编辑配置
export const bangumiEditConfig: EditGistConfig = {
	enable: true,
	gistId: "6045e8306c907fbe7962f507c45dc1dc",
	fileName: "bangumi.json",
};

// 说说编辑配置
export const momentsEditConfig: EditGistConfig = {
	enable: true,
	gistId: "562ca26ed50f406e0814cd5fd06866d3",
	fileName: "moments.json",
};

// GitHub 仓库配置（用于直接修改仓库文件）
const envAppId = (import.meta as any).env?.PUBLIC_GITHUB_APP_ID || "";
export const repoConfig = {
	owner: "fqzlr",
	repo: "my-blog",
	branch: "main",
	appId: envAppId || "",
};
