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
	defaultAuthor: "fqzlr",
	defaultAvatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",

	// ========================================================================
	// 后台管理登录密码配置
	// ========================================================================
	// 当前临时密码：admin123
	//
	// 修改密码方法：
	// 1. 在 PowerShell 中执行以下命令生成新密码的 SHA-256 哈希：
	//    $bytes = [System.Text.Encoding]::UTF8.GetBytes("你的新密码")
	//    [BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace("-", "").ToLower()
	//
	// 2. 或者在浏览器控制台执行：
	//    await crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的新密码')).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))
	//
	// 3. 将生成的64位十六进制字符串替换下方 adminPasswordHash 的值
	//
	// 注意：密码仅存储为 SHA-256 哈希，无法从哈希反推出明文密码
	// ========================================================================
	adminPasswordHash:
		"837b518a396d573ec995f128e2191865ea48c9250585db62718b94463163196c",

	// GitHub Token（优先从环境变量 GITHUB_TOKEN 读取）
	// EdgeOne 部署时在环境变量中设置 GITHUB_TOKEN=你的token
	githubToken: process.env.GITHUB_TOKEN || "",
};
