# CMS 后台管理指南

Firefly Blog 内置了轻量级 CMS 后台管理面板，支持在线管理说说动态和笔记内容，数据存储在 GitHub Gist 中，无需数据库，完全免费。

## 访问后台

后台管理面板地址：`/admin/`

例如你的博客地址是 `https://example.com`，则后台地址为 `https://example.com/admin/`。

::: tip
需要在 `siteConfig.ts` 中开启 `pages.admin: true`（默认已开启）才能访问后台页面。
:::

## 密码设置

### 默认密码
后台默认密码为：`admin123`

::: danger
首次使用前请务必修改默认密码！
:::

### 修改密码

密码使用 SHA-256 哈希存储，无法从哈希反推明文。生成哈希的方法：

**方法一：PowerShell（Windows）**
```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes("你的新密码")
[BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace("-", "").ToLower()
```

**方法二：浏览器控制台**
打开任意网页按 F12 打开控制台，执行：
```javascript
await crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的新密码')).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))
```

将生成的 64 位十六进制字符串替换以下两个文件中的 `adminPasswordHash` 值：
- [externalMomentsConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalMomentsConfig.ts)
- [externalNotebooksConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalNotebooksConfig.ts)

::: warning
两个配置文件的密码哈希需要保持一致，否则会导致部分功能无法正常登录。
:::

## 前置配置

使用后台管理前需要完成以下配置：

### 1. 创建 GitHub Token

1. 访问 GitHub [Settings → Developer settings → Personal access tokens → Tokens (classic)](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. Note 填写任意名称（如 `blog-admin`）
4. Expiration 选择有效期（建议选择 `No expiration` 或较长时间）
5. 勾选 **gist** 权限（必须）
6. 点击 Generate token，复制生成的 Token（只显示一次！）

### 2. 创建 Gist 仓库

需要为说说和每个笔记本创建独立的 Secret Gist：

**说说 Gist：**
- 文件名：`moments.json`
- 初始内容：`[]`

**笔记本 Gist：**
每个笔记本对应一个 Gist：
- 文件名：`notebooks-entries.json`
- 初始内容：`[]`

::: warning
请务必创建 **Secret Gist**，不要创建公开 Gist，否则你的数据可能被他人看到或篡改。
:::

### 3. 配置环境变量

在部署平台的环境变量中添加：
```
GITHUB_TOKEN=你刚才复制的GitHubToken
```

本地开发时可在项目根目录 `.env` 文件中添加。

### 4. 配置 Gist ID

从创建的 Gist URL 中获取 ID（如 `https://gist.github.com/user/abc123` 中的 `abc123`），填入对应配置文件：

- 说说：`externalMomentsConfig.ts` 中的 `gistId`
- 笔记：`externalNotebooksConfig.ts` 中的 `notebookGists`

## 功能介绍

### 说说管理

登录后台后，可以：

- **发布说说**：输入内容，支持 Markdown 格式，可添加图片和标签
- **编辑说说**：修改已发布的说说内容
- **删除说说**：删除不需要的说说
- **预览**：发布前预览渲染效果

### 笔记管理

支持多个笔记本，每个笔记本独立管理：

- **切换笔记本**：在顶部选择要编辑的笔记本
- **使用模板**：快速创建每日总结、日记、读书笔记、灵感、待办等类型笔记
- **编辑笔记**：支持 Markdown 实时编辑
- **删除笔记**：删除不需要的笔记
- **模板变量**：`{name}` 会自动替换为当天日期

### 数据同步

- 所有修改实时保存到 GitHub Gist
- 前端页面访问时动态拉取最新数据
- **无需重新构建和部署**博客即可看到更新

## 数据备份

建议定期备份 Gist 数据：

1. 访问你的 Gist 页面
2. 下载每个 Gist 的 JSON 文件
3. 或使用 Git 克隆 Gist 仓库进行版本管理

## 常见问题

### Q: 登录提示密码错误？
A: 检查两个配置文件中的 `adminPasswordHash` 是否一致，且是密码的正确 SHA-256 哈希。注意密码区分大小写。

### Q: 发布说说/笔记失败？
A: 检查：
1. `GITHUB_TOKEN` 环境变量是否正确配置
2. Token 是否有 `gist` 权限
3. Gist ID 是否填写正确
4. Gist 文件名是否正确（`moments.json` / `notebooks-entries.json`）

### Q: 本地开发可以使用后台吗？
A: 可以，但需要在 `.env` 文件中配置 `GITHUB_TOKEN`，本地修改会真实写入你的 Gist。

### Q: 可以禁用后台吗？
A: 可以，在 `siteConfig.ts` 中设置 `pages.admin: false` 即可关闭后台页面。同时可以在 `externalMomentsConfig.ts` 和 `externalNotebooksConfig.ts` 中设置 `enable: false` 禁用外部数据源。

### Q: Gist 有容量限制吗？
A: GitHub Gist 每个文件限制为 1MB，对于博客说说和笔记来说完全足够使用。如果数据量较大，可以定期归档旧内容。

## 安全建议

1. **务必修改默认密码**，使用强密码
2. 使用 **Secret Gist**，不要创建公开 Gist
3. 妥善保管 GitHub Token，不要提交到代码仓库
4. 定期轮换 Token 和密码
5. 不要在后台输入敏感信息（如密码、银行卡号等）
