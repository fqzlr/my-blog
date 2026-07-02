/**
 * 在线编辑 - 各模块配置
 */

export interface EditConfig {
	fileName: string;
	enable: boolean;
}

// 友链编辑配置
export const friendsEditConfig: EditConfig = {
	enable: false,
	fileName: "friends.json",
};

// 工具收藏编辑配置
export const collectionsEditConfig: EditConfig = {
	enable: false,
	fileName: "collections.json",
};

// 番剧/影视编辑配置
export const bangumiEditConfig: EditConfig = {
	enable: false,
	fileName: "bangumi.json",
};

// 说说编辑配置
export const momentsEditConfig: EditConfig = {
	enable: false,
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
