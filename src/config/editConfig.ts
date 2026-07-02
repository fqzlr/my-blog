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
// 已禁用 Gist - 改用本地 friends.json
export const friendsEditConfig: EditGistConfig = {
	enable: false,
	gistId: "",
	fileName: "friends.json",
};

// 工具收藏编辑配置
// 已禁用 Gist
export const collectionsEditConfig: EditGistConfig = {
	enable: false,
	gistId: "",
	fileName: "collections.json",
};

// 番剧/影视编辑配置
// 已禁用 Gist - 改用本地 bangumi.json
export const bangumiEditConfig: EditGistConfig = {
	enable: false,
	gistId: "",
	fileName: "bangumi.json",
};

// 说说编辑配置
// 已禁用 Gist - 改用本地 moments.json
export const momentsEditConfig: EditGistConfig = {
	enable: false,
	gistId: "",
	fileName: "moments.json",
};

// GitHub 仓库配置（用于直接修改仓库文件）
const envAppId = (import.meta as any).env?.PUBLIC_GITHUB_APP_ID || "";
export const repoConfig = {
	owner: import.meta.env?.PUBLIC_GITHUB_OWNER || "fqzlr",
	repo: import.meta.env?.PUBLIC_GITHUB_REPO || "my-blog",
	branch: "master",
	appId: envAppId || "",
};
