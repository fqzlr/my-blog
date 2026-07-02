# CLAUDE.md — Firefly 博客工程规范

> 本文件是 Claude Code 在本仓库中工作的唯一权威指令。所有开发行为必须遵守以下规范。

---

## 1. 项目概览

| 项 | 值 |
|---|---|
| 名称 | Firefly v6.6.13 — "团子和蛋糕的博客" |
| 框架 | Astro 5.17 + Svelte 5 + Tailwind CSS v4 |
| 包管理 | pnpm 9.14.4 (ESM) |
| 部署 | Vercel（主）+ GitHub Pages（CI/CD） |
| 线上 | https://blog.tsh520.cn/ |
| 来源 | Fork 自 CuteLeaf/Firefly ← saicaca/fuwari |

---

## 2. 目录结构约定

```
src/
├── components/          # 按功能域组织的组件
│   ├── analytics/       # 数据分析（GA, Clarity）
│   ├── comment/         # 评论系统（Waline, Twikoo...）
│   ├── common/          # 跨域共享的基础组件
│   ├── controls/        # 交互控件（搜索、主题切换...）
│   ├── features/        # 独立功能模块（音乐、樱花、Live2D...）
│   ├── guestbook/       # 留言板
│   ├── layout/          # 布局组件（Navbar, Footer, SideBar...）
│   ├── life/            # 生活模块组件
│   ├── misc/            # 杂项（License, RelatedPosts...）
│   ├── moments/         # 动态组件
│   ├── pages/           # 页面级组件（bangumi, books, music...）
│   └── widget/          # 侧边栏 Widget 组件
├── config/              # 所有站点配置（26 个文件，index.ts 统一导出）
├── constants/           # 常量定义
├── content/             # Astro Content Collections（11 个集合）
├── i18n/                # 国际化（5 种语言）
├── layouts/             # 页面布局（Layout.astro, MainGridLayout.astro）
├── notes/               # Obsidian 笔记（不发布）
├── plugins/             # 自定义 remark/rehype 插件
├── styles/              # ★ 全局样式（唯一合法入口）
├── types/               # TypeScript 类型定义
└── utils/               # 工具函数
```

### 2.1 新增文件规则

- **组件** → 放入对应功能域目录，不要平铺在 `components/` 根目录
- **样式** → 必须放入 `src/styles/`，禁止在组件外新建独立 CSS 文件
- **配置** → 放入 `src/config/`，并在 `index.ts` 中统一导出
- **工具函数** → 放入 `src/utils/`，按职责命名

---

## 3. 样式架构规范（核心）

### 3.1 当前问题诊断

经过深度分析，当前样式系统存在以下严重问题：

| 问题 | 严重度 | 描述 |
|------|--------|------|
| `!important` 泛滥 | 🔴 | 全项目 465+ 处 `!important`，根源是全局样式与组件样式特异性冲突 |
| 三格式共存 | 🔴 | CSS、Stylus、Tailwind v4 三种格式混用，增加构建复杂度 |
| `main.css` 巨文件 | 🟡 | 939 行混合了设计系统基础与页面级功能样式 |
| 硬编码颜色 | 🟡 | 绕过令牌系统直接写 `#000`/`#fff`，深色模式靠复制硬编码值 |
| 暗色模式选择器不统一 | 🟡 | 4 种选择器混用：`:root.dark`、`.dark`、`html.dark`、`@media (prefers-color-scheme: dark)` |
| 孤立文件 | 🟡 | `widget-responsive.css` 定义了与 `variables.styl` 冲突的断点变量 |
| 样式重复 | 🟢 | `DisplaySettings.svelte` 与 `DisplaySettingsIntegrated.svelte` 包含完全相同的 Stylus 块 |

### 3.2 样式分层架构（目标）

采用 **CSS Cascade Layers** 管理特异性，消除 `!important`：

```css
/* src/styles/main.css 顶部声明层顺序 */
@layer reset, tokens, base, components, utilities, overrides;
```

| 层 | 职责 | 文件 |
|----|------|------|
| `reset` | 浏览器重置 | `main.css` 中 `@layer reset` 块 |
| `tokens` | 设计令牌（CSS 自定义属性） | `tokens.css`（从 `variables.styl` 迁移） |
| `base` | 全局基础样式（排版、链接、代码） | `base.css`（从 `main.css` 拆出） |
| `components` | 组件级全局样式（card, btn, dropdown） | `components/*.css`（按组件拆分） |
| `utilities` | Tailwind 工具类 | 由 Tailwind 自动生成 |
| `overrides` | 第三方库覆盖（评论系统、代码块） | `overrides/*.css` |

**关键原则：**
- Astro scoped `<style>` 不在任何层中，默认优先级最高，天然覆盖全局层
- 不再需要 `!important` 来覆盖全局样式
- 未分层的样式永远优先于分层样式（这是 CSS 规范行为）

### 3.3 样式文件拆分方案

**从 `main.css`（939 行）拆分为：**

```
src/styles/
├── main.css                    # 入口：@layer 声明 + @import 链
├── tokens/
│   ├── colors.css              # 颜色令牌（从 variables.styl 迁移为纯 CSS）
│   ├── typography.css          # 字体、字号、行高
│   ├── spacing.css             # 间距、容器宽度
│   └── animation.css           # 缓动曲线、持续时间
├── base/
│   ├── reset.css               # 浏览器重置
│   ├── typography-base.css     # 全局排版（标题、段落、列表）
│   └── links.css               # 全局链接样式
├── components/
│   ├── buttons.css             # .btn-plain, .btn-primary
│   ├── cards.css               # .card-base
│   ├── dropdown.css            # .dropdown, .float-panel
│   ├── pagination.css          # 分页组件
│   ├── floating-dock.css       # 浮动控制栏
│   ├── category-bar.css        # 分类栏
│   └── post-list.css           # 文章列表网格
├── layout/
│   ├── layout-styles.css       # Banner 布局（保持现有，逐步减少 !important）
│   ├── navbar.css              # 导航栏
│   ├── banner-title.css        # Banner 文字
│   ├── waves.css               # 波浪动画
│   └── sidebar.css             # 侧边栏布局
├── transitions/
│   ├── swup.css                # Swup 过渡动画（见第 5 节规范）
│   └── theme.css               # 主题切换过渡
├── vendor/
│   ├── expressive-code.css     # 代码块覆盖
│   ├── fancybox.css            # 灯箱覆盖
│   ├── waline.css              # Waline 评论覆盖
│   ├── twikoo.css              # Twikoo 评论覆盖
│   └── photoswipe.css          # PhotoSwipe 覆盖
├── features/
│   ├── markdown.css            # .custom-md 排版
│   ├── toc.css                 # 目录样式
│   ├── scrollbar.css           # 自定义滚动条
│   └── widget-responsive.css   # Widget 响应式（统一断点变量）
└── utils/
    └── scrollbar-overlay.css   # OverlayScrollbars 定制
```

### 3.4 Stylus → CSS 迁移

**必须迁移的 3 个 Stylus 文件：**

| 文件 | 迁移为 | 说明 |
|------|--------|------|
| `variables.styl` | `tokens/*.css` | 用 CSS 自定义属性重写，保留 `:root` 和 `:root.dark` 结构 |
| `markdown-extend.styl` | `features/markdown-extend.css` | Stylus 嵌套改用 CSS 原生嵌套 |
| Svelte 组件内 `<style lang="stylus">` | `<style>` 纯 CSS | Svelte 原生支持 CSS 嵌套 |

**迁移后删除 `postcss.config.mjs` 中的 `postcss-nesting`**，Tailwind v4 原生支持嵌套。

### 3.5 设计令牌规范

**所有颜色必须通过令牌引用，禁止硬编码：**

```css
/* ✅ 正确 */
.card { background: var(--card-bg); color: var(--primary); }

/* ❌ 错误 */
.card { background: #fff; color: #000; }
```

**暗色模式选择器统一为一种：**

```css
/* ✅ 统一使用 :root.dark */
:root { --primary: oklch(0.30 0 0); }
:root.dark { --primary: oklch(0.85 0 0); }

/* ❌ 禁止以下混用 */
.dark .selector { }                    /* 不带 :root */
html.dark .selector { }               /* html 前缀 */
@media (prefers-color-scheme: dark) { } /* 媒体查询（由 JS 管理，不需要） */
```

**Tailwind 中引用令牌：**

```html
<!-- ✅ 正确：使用 CSS 自定义属性 -->
<div class="bg-(--card-bg) text-(--primary) border-(--line-divider)">

<!-- ❌ 错误：硬编码颜色 -->
<div class="bg-white text-black border-gray-200">
```

### 3.6 消除 `!important` 路线图

**Phase 1（立即）：** 新代码禁止使用 `!important`，Biome lint 规则拦截

**Phase 2（逐步）：** 按文件重构，优先级排序：
1. `PostPage.astro`（42 处）→ 利用 scoped 样式天然优先级
2. `PostCard.astro`（19 处）→ 同上
3. `layout-styles.css`（214 处）→ CSS Layers 管理特异性
4. `main.css`（68 处）→ 拆分到 components 层

**Phase 3（第三方覆盖）：** 评论系统样式保留 `!important` 在 `@layer overrides` 中，这是唯一合理使用场景

---

## 4. 组件开发规范

### 4.1 组件文件命名

```
PascalCase.astro          # Astro 组件
PascalCase.svelte         # Svelte 组件
camelCase.ts              # 工具函数
kebab-case.css            # 样式文件
```

### 4.2 Astro 组件结构

```astro
---
// 1. 导入（按类型分组）
import type { CollectionEntry } from "astro:content";
import { siteConfig } from "@config/siteConfig";
import Icon from "@components/common/Icon.svelte";

// 2. Props 定义（使用 interface）
interface Props {
  title: string;
  slug?: string;
  class?: string;
}
const { title, slug, class: className } = Astro.props;

// 3. 数据获取
const posts = await getCollection("posts");

// 4. 计算逻辑
const sortedPosts = posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
---

<!-- 模板：使用语义化 HTML -->
<article class:list={["post-card", className]}>
  <h2>{title}</h2>
  <slot />
</article>

<!-- 样式：scoped 为默认，is:global 仅在必要时使用 -->
<style>
  .post-card {
    background: var(--card-bg);
    border: 1px solid var(--line-divider);
  }
</style>
```

### 4.3 Hydration 指令规范

| 指令 | 使用场景 | 示例 |
|------|----------|------|
| 无（静态） | 纯展示内容，无 JS 交互 | 文章卡片、页脚、头像 |
| `client:load` | 首屏关键交互元素 | 导航栏、搜索面板、主题切换 |
| `client:visible` | 首屏以下的交互内容 | 评论区、音乐播放器、Widget |
| `client:idle` | 非紧急后台功能 | 数据分析、访客统计 |
| `client:media` | 仅在特定视口需要 | 移动端侧边栏切换 |
| `client:only` | 依赖浏览器 API | Live2D、Spine 动画 |

**审计规则：** `client:load` 仅用于首屏可见且需要立即交互的组件。其余一律使用更轻量的指令。

### 4.4 Svelte 组件规范

```svelte
<script lang="ts">
  // Props 使用 $props()（Svelte 5）
  interface Props {
    label: string;
    active?: boolean;
    onclick?: () => void;
  }
  let { label, active = false, onclick }: Props = $props();
</script>

<button class:active {onclick}>
  {label}
</button>

<style>
  /* Svelte scoped 样式，使用 CSS 原生嵌套 */
  button {
    background: var(--btn-regular-bg);
    transition: all 0.2s ease;

    &.active {
      background: var(--primary);
    }

    &:hover {
      opacity: 0.85;
    }
  }
</style>
```

---

## 5. Swup 容器过渡规范（核心）

### 5.1 当前 Swup 配置

```js
// astro.config.mjs
containers: [
  "#banner-overlay-container",   // Banner 覆盖层
  "#banner-dim-container",       // Banner 暗化层
  "#swup-container",             // 主内容区
  "#left-sidebar-dynamic",       // 左侧边栏
  "#right-sidebar-dynamic",      // 右侧边栏
]
```

### 5.2 已识别的 CSS 渲染问题

| ID | 问题 | 根因 |
|----|------|------|
| A | `onload-animation` 与 Swup 双重 opacity 冲突 | 子元素独立 fade-in 与容器 fade-in 叠加 |
| B | 非 Swup 容器的 JS 类切换时序不匹配 | `lg:is-home` 在 `visit:start` 切换，但 Banner 高度有 CSS 过渡 |
| C | `transition-main` 双重 opacity 操控 | 容器和子元素各自管理 opacity |
| D | `is-page-transitioning` 保护不完整 | 仅隐藏 banner 文字，未阻止布局跳动 |
| E | Banner 容器内容替换后壁纸模式未重新评估 | `applyWallpaperMode` 仅在初始加载运行 |
| F | `data-swup-ignore-script` 脚本不重新执行 | 有意为之，但可能导致过时 DOM 引用 |
| G | 隐藏侧边栏容器过渡闪烁 | `hidden` 容器可能在动画期间短暂可见 |

### 5.3 Swup 过渡 CSS 规范

**统一过渡文件：** `src/styles/transitions/swup.css`

```css
/* ========================================
   Swup 容器过渡规范 v2
   ======================================== */

/* --- 层声明 --- */
@layer components {
  /* 1. 容器过渡定义 */
  .transition-main {
    transition: opacity 350ms cubic-bezier(0.4, 0, 0.2, 1),
                transform 350ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .transition-swup-fade {
    transition: opacity 300ms ease,
                transform 300ms ease;
  }

  /* 2. 过渡状态（Swup 注入 html 的类） */
  html.is-animating .transition-main {
    opacity: 0;
    transform: translateY(0.75rem);
  }

  html.is-animating .transition-swup-fade {
    opacity: 0;
    transform: translateY(1.5rem);
  }

  /* 3. 修复 A：禁用子元素独立动画 */
  html.is-animating .onload-animation,
  html.is-changing .onload-animation {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }

  /* 4. 修复 B/D：过渡期间冻结布局属性 */
  html.is-page-transitioning #wallpaper-wrapper,
  html.is-page-transitioning #main-grid,
  html.is-page-transitioning #top-row {
    transition: none !important;
  }

  /* 5. 修复 G：隐藏容器在动画期间保持隐藏 */
  html.is-animating #left-sidebar-dynamic.hidden,
  html.is-animating #right-sidebar-dynamic.hidden {
    visibility: hidden !important;
    opacity: 0 !important;
    transition: none !important;
  }

  /* 6. 进度条 */
  #progress-bar {
    position: fixed;
    top: 0;
    left: 0;
    width: 0;
    height: 2px;
    background: var(--primary);
    z-index: var(--z-progress, 9999);
    transition: width 0.3s ease;
  }
}
```

### 5.4 Swup 生命周期 Hook 规范

```js
// Layout.astro 中的 Hook 注册顺序

// 1. link:click — 立即反馈
window.swup.hooks.on("link:click", () => {
  document.documentElement.style.setProperty("--content-delay", "0ms");
  document.documentElement.classList.add("is-page-transitioning");
});

// 2. visit:start — 进度条 + 导航栏控制
window.swup.hooks.on("visit:start", (visit) => {
  // 显示进度条
  // 控制导航栏显示/隐藏
  // ⚠️ 不要在此处切换影响布局的类（如 lg:is-home）
});

// 3. content:replace — DOM 更新后同步状态
window.swup.hooks.on("content:replace", (visit) => {
  // ✅ 在此处切换 body 类（lg:is-home 等）
  // ✅ 在此处重新评估壁纸模式
  // ✅ 在此处重新初始化侧边栏可见性
  // ✅ 在此处重新初始化 TOC、滚动条、图标加载器
});

// 4. page:view — 页面可见后
window.swup.hooks.on("page:view", () => {
  // 同步主题
  // 触发评论系统事件
  // 重新初始化 Mermaid
});

// 5. visit:end — 过渡完成
window.swup.hooks.on("visit:end", () => {
  document.documentElement.classList.remove("is-page-transitioning");
});
```

### 5.5 Swup 容器内元素规则

| 规则 | 说明 |
|------|------|
| 容器内的交互组件必须使用 `client:visible` 或 `client:idle` | 避免 `client:load` 在 Swup 替换后重复初始化 |
| 容器内禁止使用 `data-swup-ignore-script` | 该属性仅用于容器外的持久脚本 |
| 容器内的 `<style is:global>` 必须带有作用域前缀 | 防止 Swup 替换后样式残留 |
| 容器内的元素动画使用 `.onload-animation` 类 | 由 Swup `content:replace` hook 触发，不依赖页面加载 |

---

## 6. Content Collections 规范

### 6.1 定义位置

```typescript
// src/content.config.ts — 唯一定义位置
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ base: "./src/content/posts", pattern: "**/*.{md,mdx}" }),
  schema: z.object({
    title: z.string(),
    published: z.date(),
    tags: z.array(z.string()).default([]),
    // ...
  }),
});

export const collections = { posts, /* ... */ };
```

### 6.2 Frontmatter 规范

```yaml
---
title: "文章标题"           # 必填
published: 2026-01-01       # 必填，发布日期
updated: 2026-06-01         # 可选，更新日期
tags: [Astro, TypeScript]   # 标签数组
category: "技术分享"         # 必填，对应 content/posts/ 下的目录名
cover: "/images/cover.webp" # 可选，封面图
description: "摘要文字"      # 可选，不填则自动截取
draft: false                # 可选，草稿不发布
pinned: false               # 可选，置顶
---
```

### 6.3 查询规范

```typescript
// ✅ 正确：使用 getCollection + 类型安全
import { getCollection, getEntry } from "astro:content";

const allPosts = await getCollection("posts", ({ data }) => !data.draft);
const post = await getEntry("posts", slug);

// ✅ 正确：render 函数
const { Content, headings } = await render(post);

// ❌ 错误：直接 import markdown 文件
import content from "./post.md";
```

---

## 7. Astro 组件 vs Svelte 组件决策树

```
需要客户端交互？
├── 否 → 使用 .astro（零 JS 输出）
└── 是 → 需要状态管理？
    ├── 简单状态（toggle, hover）→ 使用 .astro + <script>
    └── 复杂状态（响应式、事件驱动）→ 使用 .svelte
        └── 何时挂载？
            ├── 首屏关键 → client:load
            ├── 滚动可见 → client:visible
            ├── 空闲时 → client:idle
            └── 仅特定视口 → client:media
```

---

## 8. Tailwind CSS v4 规范

### 8.1 配置方式

```css
/* src/styles/main.css — 唯一 Tailwind 入口 */
@import "tailwindcss";

@plugin "@tailwindcss/typography";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Roboto", sans-serif;
  /* 其他主题覆盖 */
}

/* 自定义工具类 */
@utility expand-animation {
  animation: expand 0.3s ease forwards;
}
```

### 8.2 使用规则

```html
<!-- ✅ 正确：Tailwind 工具类用于布局和间距 -->
<div class="flex items-center gap-4 p-6 mx-auto max-w-7xl">

<!-- ✅ 正确：设计令牌用于颜色和主题感知 -->
<div class="bg-(--card-bg) text-(--primary) border-(--line-divider)">

<!-- ❌ 错误：硬编码颜色值 -->
<div class="bg-white text-black border-gray-200">

<!-- ❌ 错误：Tailwind 的固定颜色调色板 -->
<div class="bg-blue-500 text-gray-800">
```

### 8.3 @apply 使用限制

```css
/* ✅ 仅在以下场景使用 @apply */
/* 1. 需要在 CSS 变量中复用 Tailwind 工具组合 */
.prose-heading { @apply text-2xl font-bold mb-4; }

/* 2. 第三方库样式覆盖需要 Tailwind 工具时 */

/* ❌ 禁止在组件 <style> 中使用 @apply */
/* 直接在 HTML class 中写工具类 */
```

---

## 9. i18n 规范

### 9.1 新增翻译键

```typescript
// 1. src/i18n/i18nKey.ts 中添加枚举值
export enum i18nKey {
  newFeature = "newFeature",
}

// 2. src/i18n/zh_CN.ts 中添加中文
export default {
  newFeature: "新功能",
} as const;

// 3. src/i18n/en.ts 中添加英文
export default {
  newFeature: "New Feature",
} as const;

// 4. 其他语言文件同步添加
```

### 9.2 使用方式

```astro
---
import { i18n } from "@i18n/translation";
import { i18nKey } from "@i18n/i18nKey";
---

<p>{i18n(i18nKey.newFeature)}</p>
```

---

## 10. 命名规范

### 10.1 文件命名

| 类型 | 规范 | 示例 |
|------|------|------|
| Astro 组件 | PascalCase | `PostCard.astro` |
| Svelte 组件 | PascalCase | `SearchPanel.svelte` |
| TypeScript 文件 | camelCase | `content-utils.ts` |
| CSS 文件 | kebab-case | `layout-styles.css` |
| 配置文件 | camelCase | `siteConfig.ts` |
| 常量文件 | camelCase | `constants.ts` |

### 10.2 CSS 类命名

```css
/* 组件类：kebab-case，带功能前缀 */
.post-card { }
.btn-plain { }
.widget-layout { }

/* 状态类：is- 前缀 */
.is-active { }
.is-loading { }
.is-expanded { }

/* 工具类：使用 Tailwind，不自定义 */
/* 如必须自定义，使用 @utility 注册 */
```

### 10.3 CSS 自定义属性

```css
/* 设计令牌：--{category}-{variant} */
--color-primary: oklch(0.30 0 0);
--color-card-bg: oklch(0.98 0 0);
--spacing-widget-gap: 1rem;
--duration-fast: 150ms;

/* 组件级临时变量：--{component}-{purpose} */
--toc-active-indicator-width: 3px;
--navbar-height: 3.5rem;
```

---

## 11. Git 提交规范

```
<type>(<scope>): <description>

type:    feat | fix | style | refactor | perf | docs | chore | ci
scope:   components | styles | config | content | scripts | i18n | plugins
description: 简洁描述，中文或英文均可
```

**示例：**
```
feat(components): 添加文章分享海报组件
style(styles): 重构 main.css 拆分为分层架构
fix(swup): 修复页面切换时侧边栏闪烁问题
refactor(styles): 迁移 variables.styl 为 CSS 自定义属性
```

---

## 12. 构建与开发命令

```bash
pnpm dev          # 启动开发服务器
pnpm build        # 构建（生成图标 → Astro 构建 → Pagefind 索引）
pnpm sync         # Obsidian 笔记同步
pnpm new-post     # 创建新文章
pnpm format       # Biome 格式化
pnpm lint         # Biome 检查
pnpm cli          # 交互式 CLI 菜单
```

---

## 13. 代码审查清单

提交前检查：

- [ ] 新样式是否放入 `src/styles/` 对应目录？
- [ ] 是否使用了设计令牌（`var(--*)`）而非硬编码颜色？
- [ ] 暗色模式选择器是否使用 `:root.dark`？
- [ ] 是否新增了 `!important`？（如有，必须在 `@layer overrides` 中并注释原因）
- [ ] Astro 组件是否使用了正确的 `client:*` 指令？
- [ ] Swup 容器内的组件是否避免了 `client:load`？
- [ ] 新增 i18n 键是否在所有语言文件中添加？
- [ ] 文件命名是否符合规范？
- [ ] 是否有重复的样式可以提取为共享类？

---

## 14. 反模式（禁止）

| 反模式 | 正确做法 |
|--------|----------|
| 在组件外新建独立 CSS 文件 | 放入 `src/styles/` 对应目录 |
| 使用 `#000`/`#fff` 硬编码颜色 | 使用 `var(--primary)` 等令牌 |
| 混用 4 种暗色模式选择器 | 统一使用 `:root.dark` |
| `main.css` 中写页面级样式 | 拆分到 `components/` 或 `features/` 目录 |
| Swup 容器内用 `client:load` | 使用 `client:visible` 或 `client:idle` |
| 在 `visit:start` 切换布局类 | 在 `content:replace` 中切换 |
| 复制粘贴样式块 | 提取为共享组件或 CSS 类 |
| 使用 Stylus 新建文件 | 统一使用纯 CSS（Tailwind v4 原生嵌套） |
| `<style is:global>` 不带作用域 | 必须加前缀限定范围 |
| `@apply` 大量使用 | 直接在 HTML class 中写 Tailwind 工具类 |

---

## 15. 技术栈版本锁定

| 依赖 | 版本 | 说明 |
|------|------|------|
| Astro | 5.17.x | 不随意升级大版本 |
| Svelte | 5.x | 使用 runes API（`$props`, `$state`, `$derived`） |
| Tailwind CSS | 4.x | CSS-first 配置，无 `tailwind.config.js` |
| Swup | @swup/astro | 不迁移到 View Transitions（除非团队统一决定） |
| Biome | 2.3.x | 唯一 linter/formatter |
| pnpm | 9.14.x | 唯一包管理器 |
