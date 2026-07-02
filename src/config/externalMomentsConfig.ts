// 外部说说数据源配置（基于 GitHub Gist，完全免费）
// 数据存储在 GitHub Gist 中，通过 GitHub API 读写
// 添加新说说不会修改仓库中的任何代码

export const externalMomentsConfig = {
	// 是否启用外部说说数据源
	enable: true,

	// GitHub Gist ID（创建 Gist 后从 URL 中获取）
	gistId: "562ca26ed50f406e0814cd5fd06866d3",

	// Gist 中的文件名
	fileName: "moments.json",

	// 默认作者信息
	defaultAuthor: "团子",
	defaultAvatar: "https://re.tsh520.cn/zl/tx.webp",

	// 后台登录密码的 SHA-256 哈希（明文密码不再存入代码）
	// 生成方式：echo -n "你的密码" | sha256sum
	adminPasswordHash:
		"284d9a101beeb8fbf979d029b25fa49f859739904bfc3a918ecba1c00001b0af",

	// GitHub Token（优先从环境变量 GITHUB_TOKEN 读取）
	// EdgeOne 部署时在环境变量中设置 GITHUB_TOKEN=你的token
	githubToken: process.env.GITHUB_TOKEN || "",
};
