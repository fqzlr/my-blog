---
title: "用 GitHub Gist 做博客后端：零成本的说说与笔记方案"
published: 2026-06-12
tags:
  - GitHub
  - Gist
  - 博客
  - 后端
category: 技术分享
description: 介绍如何利用 GitHub Gist 作为博客的说说和笔记功能的后端存储，实现零服务器、零成本的内容管理方案。
---

## 什么是 GitHub Gist？

GitHub Gist 是 GitHub 提供的一个轻量级代码和文本分享服务。每个 Gist 本质上是一个 Git 仓库，可以包含一个或多个文件，支持版本控制、克隆和 Fork。

Gist 分为两种类型：

- **Public Gist**：公开可见，任何人都能搜索和访问
- **Secret Gist**：不会出现在搜索结果中，但知道 URL 的人仍可访问

> 注意：Secret Gist 并不是真正的"私有"，它只是不被搜索引擎索引。如果你需要真正的私有存储，请使用 Private 仓库。

Gist 非常适合存储小规模的结构化数据，比如 JSON 格式的配置、笔记、日志等。而且它完全免费，没有存储空间限制（单文件建议 1MB 以内），API 调用频率限制为每小时 5000 次（认证后）。

## 为什么选择 Gist 做后端？

作为一个静态博客（Astro），我没有传统的服务器和数据库。但我需要两个动态功能：

1. **说说**（类似朋友圈/微博）— 随时发布短文和图片
2. **笔记**（类似日记本）— 记录每日所思所想

这些内容需要频繁更新，但我不希望每次都修改代码仓库、重新部署。

对比了几种方案：

| 方案 | 成本 | 复杂度 | 适合场景 |
|------|------|--------|----------|
| 自建数据库 | 服务器费用 | 高 | 大型项目 |
| Supabase/Firebase | 免费 tier 有限 | 中 | 需要实时数据库 |
| Cloudflare KV | 免费 tier 够用 | 中 | 需要边缘存储 |
| **GitHub Gist** | **完全免费** | **低** | **小规模结构化数据** |

最终选择了 Gist，因为：

- 完全免费，无任何限制
- 与 GitHub 生态无缝集成
- 支持版本历史，天然备份
- API 简单易用
- 无需注册新服务

## 说说后端的实现

### 数据结构

每条说说存储为 JSON 数组中的一个对象：

```json
[
  {
    "id": "ext-1718000000",
    "content": "今天的天气真好 ☀️",
    "published": "2026-06-12T10:00:00Z",
    "images": ["https://example.com/photo.jpg"],
    "tags": ["日常", "开心"],
    "location": "河南-郑州",
    "pinned": false
  }
]
```

所有说说存在一个 Gist 的单个 JSON 文件中。

### 配置文件

```typescript
// src/config/externalMomentsConfig.ts
export const externalMomentsConfig = {
  enable: true,
  gistId: "你的GistID",        // Gist URL 中的 ID
  fileName: "moments.json",     // Gist 中的文件名
  adminPasswordHash: "SHA-256哈希",  // 登录密码
  githubToken: process.env.GITHUB_TOKEN || "",
};
```

### Admin 管理页面

创建了 `/admin/moments/` 管理页面，功能包括：

- GitHub Token 认证（存储在浏览器 localStorage）
- 发布新说说（支持图片、标签、位置）
- 编辑已有说说
- 删除说说
- 自定义发布时间

核心流程：

```
Admin 页面 → 输入 GitHub Token → 连接 Gist API
  → 读取 moments.json → 渲染列表
  → 编辑/发布 → PATCH 更新 Gist
```

### 前端展示

前端页面通过客户端 JavaScript 从 Gist 读取数据：

```javascript
// 使用 Raw URL（不需要 API 认证，Secret Gist 也能访问）
fetch("https://gist.githubusercontent.com/raw/" + gistId)
  .then(r => r.json())
  .then(moments => {
    // 渲染说说列表
  });
```

关键点：使用 `gist.githubusercontent.com/raw/` 而不是 GitHub API，这样即使 Gist 是 Secret 的，前端也能匿名读取。

## 笔记后端的实现

### 为什么需要独立 Gist？

说说的数据量小（几十条），一个 Gist 足够。但笔记可能有几百篇，每篇包含完整的 Markdown 内容，单个 Gist 可能超过 1MB 限制。

解决方案：**每个笔记本对应一个独立的 Gist**。

```
Gist A: "每日总结" → notebooks-entries.json（所有"每日总结"的笔记）
Gist B: "日记本"   → notebooks-entries.json（所有"日记本"的笔记）
Gist C: "读书笔记" → notebooks-entries.json（所有"读书笔记"的笔记）
```

### 配置文件

```typescript
// src/config/externalNotebooksConfig.ts
export const externalNotebooksConfig = {
  enable: true,
  notebookGists: {
    "每日总结": "GistID_1",
    "日记本": "GistID_2",
    "日常随笔": "GistID_3",
    "喜马拉雅": "GistID_4",
    "我和宝宝的日常": "GistID_5",
    "记录100件事": "GistID_6",
  },
  templates: [
    {
      id: "daily",
      icon: "📅",
      name: "每日总结",
      title: "{name} 每日总结",
      content: "✅️今天做了：  \n🤔今日感悟：  \n⏰明天计划：",
    },
    // ... 更多模板
  ],
};
```

### 数据结构

每个笔记本的 Gist 包含：

```json
{
  "entries": [
    {
      "id": "entry-1718000000",
      "notebook": "每日总结",
      "title": "2026年6月12日",
      "date": "2026-06-12",
      "content": "## 今天做了什么\n\n...",
      "createdAt": "2026-06-12T10:00:00Z",
      "updatedAt": "2026-06-12T10:00:00Z"
    }
  ],
  "metadata": {
    "name": "每日总结",
    "summary": "记录每天的所思所想"
  }
}
```

### Admin 管理页面

`/admin/notebooks/` 页面功能：

- 选择笔记本（显示 ✅ 已配置 / ⚠️ 未配置）
- 快速模板（每日总结、日记、读书笔记、灵感、待办、空白）
- Markdown 编辑器 + 实时预览
- 创建/编辑/删除笔记
- 首次保存自动创建 Gist

### 前端合并展示

前端笔记本页面同时显示本地笔记和远程笔记：

```astro
<!-- 本地笔记（构建时渲染） -->
<div class="diary-entries-list">
  {localEntries.map(entry => ...)}
</div>

<!-- 远程笔记容器（客户端填充） -->
<div id="remote-entries-container" style="display:none;">
  <div id="remote-entries-list"></div>
</div>
```

客户端脚本从 Gist 获取远程笔记，合并到列表中：

```javascript
fetch("https://gist.githubusercontent.com/raw/" + gistId)
  .then(r => r.json())
  .then(data => {
    const entries = data.entries
      .filter(e => e.notebook === currentNotebook)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // 渲染到页面，样式与本地笔记完全一致
    entries.forEach(entry => {
      const card = document.createElement("a");
      card.href = `/life/notebooks/remote-entry/?nb=${notebook}&id=${entry.id}`;
      card.className = "diary-entry-card group";
      card.innerHTML = `...`;
      list.appendChild(card);
    });
  });
```

## 认证与安全

### GitHub Token

读写 Gist 需要 GitHub Token。Token 只在以下场景使用：

- Admin 页面：输入后存储在浏览器 `localStorage`
- 构建时：通过 `process.env.GITHUB_TOKEN` 注入（用于 SSR）

Token 需要 `gist` 权限，可以在 GitHub Settings → Developer settings → Personal access tokens 创建。

### 密码保护

Admin 页面使用 SHA-256 哈希验证密码：

```typescript
// 密码哈希存储在配置文件中（不是明文）
adminPasswordHash: "284d9a101beeb8fbf979d029b25fa49f859739904bfc3a918ecba1c00001b0af"
```

用户输入密码后，前端计算 SHA-256 哈希并与配置中的值比对。验证通过后在 `sessionStorage` 中标记登录状态。

## 数据流总结

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Admin 页面  │────→│ GitHub API  │────→│  Gist (JSON) │
│  (写入数据)  │     │  (Token认证) │     │  (数据存储)  │
└─────────────┘     └─────────────┘     └─────────────┘
                                               │
                                               ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  前端页面    │←────│ Raw URL     │←────│  Gist 内容   │
│  (展示数据)  │     │ (无需认证)   │     │  (JSON数据)  │
└─────────────┘     └─────────────┘     └─────────────┘
```

## 注意事项

1. **Gist 默认公开**：创建时选 Secret Gist，但知道 URL 的人仍可访问
2. **单文件大小限制**：建议 1MB 以内，普通笔记可存 200-300 篇
3. **API 频率限制**：5000 次/小时，个人博客完全够用
4. **图片不存 Gist**：图片使用外部 CDN，Gist 只存 Markdown 文本和图片 URL
5. **备份**：Gist 本质是 Git 仓库，有完整版本历史

## 总结

GitHub Gist 作为一个免费、可靠的轻量级存储服务，非常适合作为静态博客的动态内容后端。通过合理的架构设计（Raw URL 读取、Token 认证写入、按笔记本拆分 Gist），我们实现了：

- 零服务器成本
- 零额外依赖
- 完整的 CRUD 操作
- Markdown 编辑器 + 实时预览
- 本地 + 远程数据合并展示

如果你也有一个静态博客，想要添加动态内容功能，不妨试试这个方案。
