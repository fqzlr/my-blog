# 说说动态配置详解

说说动态配置文件用于配置基于 GitHub Gist 的外部说说数据源，支持通过后台管理面板在线发布、编辑、删除说说，无需修改代码或重新构建。

配置文件路径：[externalMomentsConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalMomentsConfig.ts)

::: tip
说说功能配合 CMS 后台管理面板使用，可以在线发布动态，无需每次都修改代码重新部署。
:::

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否启用外部说说数据源 |
| `gistId` | `string` | 见源文件 | GitHub Gist ID |
| `fileName` | `string` | `"moments.json"` | Gist 中的文件名 |
| `defaultAuthor` | `string` | 见源文件 | 默认作者名称 |
| `defaultAvatar` | `string` | 见源文件 | 默认作者头像 |
| `adminPasswordHash` | `string` | 见源文件 | 后台管理密码的 SHA-256 哈希 |
| `githubToken` | `string` | 环境变量 | GitHub Personal Access Token，优先从 `GITHUB_TOKEN` 环境变量读取 |

## 配置步骤

### 1. 创建 GitHub Gist

1. 访问 [GitHub Gist](https://gist.github.com/)
2. 创建一个 **Secret Gist**（重要！不要创建公开 Gist）
3. 文件名填写 `moments.json`
4. 初始内容填写 `[]`（空数组）
5. 创建后从 URL 中获取 Gist ID

### 2. 创建 GitHub Token

需要一个具有 Gist 编辑权限的 Token：

1. 前往 GitHub [Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens)
2. 生成一个新的 Token（经典 Token 即可）
3. 勾选 `gist` 权限
4. 生成后复制保存 Token（只显示一次）

### 3. 配置环境变量

在部署平台（如 EdgeOne Pages、Vercel）的环境变量中添加：
```
GITHUB_TOKEN=你的GitHubToken
```

本地开发时可以在 `.env` 文件中添加。

### 4. 修改后台密码

默认密码是 `admin123`，**强烈建议修改为自己的密码**。

生成密码哈希的方法：

**方法一：PowerShell（Windows）**
```powershell
$bytes = [System.Text.Encoding]::UTF8.GetBytes("你的新密码")
[BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash($bytes)).Replace("-", "").ToLower()
```

**方法二：浏览器控制台**
```javascript
await crypto.subtle.digest('SHA-256', new TextEncoder().encode('你的新密码')).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))
```

将生成的 64 位十六进制字符串替换 `adminPasswordHash` 的值。

## 数据格式

`moments.json` 是一个数组，每个说说包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一ID，自动生成 |
| `content` | `string` | 说说内容（支持 Markdown） |
| `date` | `string` | 发布时间 ISO 格式 |
| `author` | `string` | 作者名称 |
| `avatar` | `string` | 作者头像 |
| `images` | `string[]` | 图片 URL 数组（可选） |
| `tags` | `string[]` | 标签数组（可选） |

### 示例：moments.json

```json
[
  {
    "id": "1718888888888",
    "content": "今天天气真好！☀️\n\n出去走走看看~",
    "date": "2024-06-20T10:30:00.000Z",
    "author": "博主",
    "avatar": "https://example.com/avatar.png",
    "images": [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg"
    ],
    "tags": ["日常", "心情"]
  }
]
```

## 使用后台管理

1. 访问 `/admin/` 页面进入后台管理
2. 输入密码登录
3. 可以在线发布、编辑、删除说说
4. 支持添加图片、标签
5. 修改会实时保存到 Gist，无需重新构建

::: warning
- **务必使用 Secret Gist**，否则你的说说数据和 Token 可能泄露
- 请妥善保管 GitHub Token，不要提交到代码仓库
- 后台密码仅存储为 SHA-256 哈希，无法从哈希反推明文
- 建议定期更换密码和 Token
:::
