# 笔记配置详解

笔记配置文件用于配置基于 GitHub Gist 的外部笔记本数据源，支持多个独立笔记本，可通过后台管理面板在线撰写和管理笔记。

配置文件路径：[externalNotebooksConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalNotebooksConfig.ts)

::: tip
笔记功能与说说功能共用同一套后台认证机制，配置方法类似。每个笔记本使用独立的 Gist 存储，避免单个 Gist 空间不足。
:::

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否启用外部笔记数据源 |
| `notebookGists` | `Record<string, string>` | 见源文件 | 笔记本名称到 Gist ID 的映射 |
| `templates` | `Array` | 见源文件 | 笔记模板列表，用于后台快速创建 |
| `adminPasswordHash` | `string` | 见源文件 | 后台管理密码的 SHA-256 哈希 |
| `githubToken` | `string` | 环境变量 | GitHub Personal Access Token |

## 笔记本配置

`notebookGists` 是一个键值对对象，键为笔记本名称，值为对应的 Gist ID。

默认配置的笔记本：
- 每日总结
- 日记本
- 日常随笔
- 喜马拉雅
- 我和宝宝的日常
- 记录100件事

### 添加新笔记本

1. 在 [GitHub Gist](https://gist.github.com/) 创建一个新的 **Secret Gist**
2. 文件名填写 `notebooks-entries.json`
3. 初始内容填写 `[]`（空数组）
4. 获取 Gist ID 并添加到配置中：

```ts
notebookGists: {
  "每日总结": "85e22c520b3ea86d80d0a2f7f5154a67",
  "日记本": "04da78da60cd6363041605ee65f56bdb",
  "我的新笔记本": "新的GistID", // 添加新笔记本
} as Record<string, string>,
```

## 笔记模板配置

`templates` 数组定义后台创建笔记时的快速模板，每个模板包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 模板唯一标识 |
| `icon` | `string` | 模板图标（Emoji） |
| `name` | `string` | 模板名称 |
| `title` | `string` | 标题模板，`{name}` 会被替换为今天的日期 |
| `content` | `string` | 内容模板 |

### 内置模板

- 📅 每日总结
- 📖 日记
- 📚 读书笔记
- 💡 灵感
- ✅ 待办
- 📝 空白

### 示例：添加自定义模板

```ts
{
  id: "travel",
  icon: "✈️",
  name: "旅行记录",
  title: "✈️ {name} 旅行记录",
  content: "## 目的地\n\n## 行程安排\n\n## 精彩瞬间\n\n## 感悟\n\n",
},
```

## GitHub Token 配置

与说说配置共用同一个 Token，需要有 `gist` 权限。在部署平台环境变量中设置：
```
GITHUB_TOKEN=你的GitHubToken
```

## 密码配置

密码哈希生成方法与说说配置相同。注意：笔记后台与说说后台共用密码，修改一处另一处也需要同步更新（或设置为相同的哈希值）。

## 数据格式

每个笔记本的 `notebooks-entries.json` 是一个数组，每条笔记包含：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `string` | 唯一ID，自动生成 |
| `title` | `string` | 笔记标题 |
| `content` | `string` | 笔记内容（支持 Markdown） |
| `date` | `string` | 创建日期，格式 `YYYY-MM-DD` |
| `createdAt` | `string` | 创建时间 ISO 格式 |
| `updatedAt` | `string` | 更新时间 ISO 格式 |

### 示例：notebooks-entries.json

```json
[
  {
    "id": "1718888888888",
    "title": "2024-06-20 每日总结",
    "content": "✅️今天做了：完成了博客主题开发\n🤔今日感悟：坚持就是胜利\n⏰明天计划：开始写文档",
    "date": "2024-06-20",
    "createdAt": "2024-06-20T15:30:00.000Z",
    "updatedAt": "2024-06-20T15:30:00.000Z"
  }
]
```

## 本地笔记

除了使用 Gist 外部数据，也可以在本地 `src/content/life/notebooks/` 目录下创建笔记本目录和笔记文件，本地笔记与 Gist 笔记会合并显示。

::: tip
- 每个笔记本使用独立 Gist，方便管理和备份
- 模板中的 `{name}` 会自动替换为当天日期（如 2024-06-20）
- 后台支持创建、编辑、删除笔记，修改实时保存到 Gist
- 本地笔记适合提交到 Git 仓库的内容，Gist 笔记适合私密随手记录
:::
