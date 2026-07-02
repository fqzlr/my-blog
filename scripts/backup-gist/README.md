# Gist → 本地迁移工具

将 GitHub Gist 中的外部数据（说说、友链、影视、笔记本）迁移到本地 Astro Content Collections，迁移完成后自动从 Gist 中删除已处理的条目，避免前端重复渲染。

## 前提条件

### 1. 设置 GitHub Token

迁移脚本需要 Token 才能从 Gist 中删除已迁移的条目：

```bash
# Linux / macOS
export GITHUB_TOKEN=ghp_你的Token

# Windows PowerShell
$env:GITHUB_TOKEN="ghp_你的Token"

# Windows CMD
set GITHUB_TOKEN=ghp_你的Token
```

> **没有 Token 也能运行**，数据会写入本地，但不会从 Gist 中删除。你需要手动清空 Gist。

### 2. Token 权限要求

Token 需要 `gist` 权限（读写 Gist）。在 GitHub → Settings → Developer settings → Personal access tokens 中创建。

---

## 使用方式

### 通过 CLI 交互菜单

```bash
pnpm cli gist-migrate
```

会提示选择迁移类型和是否仅预览。

### 直接运行脚本

```bash
# 预览模式（不写入文件，不修改 Gist，仅显示会做什么）
node scripts/backup-gist/index.js --dry-run

# 迁移全部数据
node scripts/backup-gist/index.js

# 只迁移某一类
node scripts/backup-gist/index.js moments      # 说说
node scripts/backup-gist/index.js friends      # 友链
node scripts/backup-gist/index.js bangumi      # 影视/书籍/音乐/游戏
node scripts/backup-gist/index.js notebooks    # 笔记本
```

---

## 数据映射

### Moments（说说）

| 项 | 值 |
|---|---|
| Gist 文件 | `moments.json` |
| 本地目录 | `src/content/moments/` |
| 文件命名 | `{日期}.md`（如 `2026-06-10.md`），冲突自动加 `-2`、`-3` 后缀 |
| 去重依据 | `published` 日期 |
| 默认作者 | `团子和蛋糕`（Gist 中无 author 时自动补全） |

**Frontmatter 示例：**

```yaml
---
published: 2026-06-10 08:00:00
author: 团子和蛋糕
avatar: https://re.tsh520.cn/zl/tx.webp
tags:
  - 日常
location: 家里
images:
  - https://example.com/photo.jpg
---

今天天气真好
```

### Friends（友链）

| 项 | 值 |
|---|---|
| Gist 文件 | `friends.json` |
| 本地目录 | `src/content/friends/` |
| 文件命名 | `{序号}-{slug}.md`（如 `12-wcowin-s-blog.md`） |
| 去重依据 | `siteurl` |

**Frontmatter 示例：**

```yaml
---
title: 某博客
imgurl: https://example.com/avatar.png
desc: 一个有趣的博客
siteurl: https://example.com
tags:
  - Blog
weight: 5
enabled: true
---
```

### Bangumi（影视/书籍/音乐/游戏）

| 项 | 值 |
|---|---|
| Gist 文件 | `bangumi.json` |
| 本地目录 | `src/content/bangumi/{category}/` |
| 文件命名 | `{中文标题}.md`（如 `你的名字.md`） |
| 去重依据 | `title` |
| 封面图 | 自动下载到 `scripts/fetch-media/img-anime/`，URL 重写为 `https://ph.0824.uk/file/anime/{文件名}` |

**Category 映射规则：**

| Gist 中的 category | 本地 category | 本地 subcategory |
|---|---|---|
| `anime` | `anime` | - |
| `book` | `book` | - |
| `music` | `music` | - |
| `game` | `game` | - |
| `real` | `real` | - |
| `movie` | `anime` | `movie` |
| `tv` | `anime` | `tv` |
| `documentary` | `anime` | `documentary` |

> `movie`、`tv`、`documentary` 不是 Astro schema 的有效枚举值，会自动映射为 `category: anime` + 对应 `subcategory`。

**Frontmatter 示例：**

```yaml
---
title: 你的名字
category: anime
status: 2
image: https://ph.0824.uk/file/anime/你的名字.jpg
score: 10
tags:
  - 动画
  - 爱情
published: 2025-01-09
---
```

### Notebooks（笔记本）

| 项 | 值 |
|---|---|
| Gist 文件 | 每个笔记本一个独立 Gist，文件名 `notebooks-entries.json` |
| 本地目录 | `src/content/life/notebooks/{笔记本名}/` |
| 文件命名 | `{标题}.md`（如 `今天的事.md`） |
| 去重依据 | `id` 字段 |

**笔记本 Gist 映射：**

| 笔记本名 | Gist ID |
|---|---|
| 每日总结 | `85e22c52...` |
| 日记本 | `04da78da...` |
| 日常随笔 | `a3707e72...` |
| 喜马拉雅 | `f189e792...` |
| 我和宝宝的日常 | `5cabb890...` |
| 记录100件事 | `05da9de9...` |

**Frontmatter 示例：**

```yaml
---
date: 2026-06-10
name: 今天的事
---

## 今天
玩了一天
```

---

## 封面图下载

### 自动下载

迁移 Bangumi 时，脚本会自动从 TMDB 下载封面图到 `scripts/fetch-media/img-anime/`，并将 `.md` 文件中的 `image` URL 重写为自定义图床地址。

### 手动补下载

如果迁移时图片下载失败（如网络问题），可以单独运行：

```bash
node scripts/backup-gist/download-images.js
```

> **注意：** 需要能访问 `image.tmdb.org`。如果网络不通，需要手动下载图片。

### 上传到图床

下载完成后，将 `scripts/fetch-media/img-anime/` 中的图片上传到你的图床 `https://ph.0824.uk/file/anime/`。

---

## 工作原理

```
1. 读取 src/config/ 中的外部配置，获取 Gist ID
2. 通过 Raw URL 获取 Gist JSON 数据（无需认证）
3. 与本地已有文件去重（按日期/URL/标题/ID 匹配）
4. 写入本地 .md 文件到对应 Content Collection 目录
5. 对 Bangumi 类型，同时下载封面图并重写 URL
6. 通过 GitHub API PATCH 删除已迁移的条目（需要 Token）
7. 所有条目迁移完后，Gist 中剩余空数组 []
```

---

## 安全说明

- **读取** 使用 Raw URL（`gist.githubusercontent.com`），无需认证
- **写入/删除** 使用 GitHub API（`api.github.com`），需要 Bearer Token
- Token 通过环境变量传入，**不会**写入任何文件
- 脚本本身不存储任何凭据

---

## 常见问题

### Q: 没有 Token 可以运行吗？

可以。数据会写入本地，但不会从 Gist 中删除。你需要手动清空 Gist，否则前端会重复渲染。

### Q: 重复运行会出问题吗？

不会。脚本会检测本地已有文件（去重），已存在的条目会被跳过。从 Gist 删除的条目下次运行时自然不存在。

### Q: 迁移后前端还有重复数据？

检查 Gist 是否已被清空。如果 Gist 中仍有数据，前端的客户端 JS 会继续获取并渲染。确保 Gist 中的数组为空 `[]`。

### Q: 封面图下载失败怎么办？

1. 检查网络是否能访问 `image.tmdb.org`
2. 如果不通，运行 `node scripts/backup-gist/download-images.js` 单独重试
3. 如果仍然失败，手动下载图片放入 `scripts/fetch-media/img-anime/`
4. 最后将图片上传到你的图床

### Q: 如何回滚迁移？

迁移后的文件在 `git status` 中会显示为未跟踪文件。如果需要回滚：

```bash
# 删除迁移的文件（保留 git 已跟踪的文件）
git clean -f src/content/moments/ src/content/friends/ src/content/bangumi/ src/content/life/notebooks/
```

> **注意：** Gist 中的数据已被删除，回滚后需要手动恢复 Gist。
