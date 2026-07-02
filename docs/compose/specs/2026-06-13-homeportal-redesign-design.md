# HomePortal 重新设计方案

## [S1] 问题

当前首页 (`/`) 直接展示文章列表，缺少一个有个性的"门户区"来展示博主信息、站点概览和快速导航。现有的 `HomePortal.astro` 存在以下问题：
- 使用 `100vw` hack 突破 grid 列宽，代码不优雅
- 门户区在 Swup 容器内，每次页面切换都会重新初始化 Three.js
- 内容单一，仅有头像+统计+文章列表标题
- 文章列表和门户区耦合在同一个页面

## [S2] 解决方案概述

将首页重构为"门户首页"，文章列表独立到 `/posts/` 页面。门户区包含：
- 个人展示区（头像+涟漪+状态+名字+签名+运行天数）
- 公告跑马灯
- 快速导航卡片（2×4 网格）
- 站点数据（刮刮卡效果）
- 每日一言
- 最近文章预览（3 篇）
- 最近说说动态（2-3 条）

设计风格：极简 + 主题色点缀（hue:230 紫蓝调），保持现有黑白灰中性底色。

## [S3] 页面架构

### URL 映射

| 路径 | 内容 | 布局 |
|------|------|------|
| `/` | 门户首页 | MainGridLayout（无侧边栏） |
| `/posts/` | 文章列表（第1页） | MainGridLayout（带侧边栏） |
| `/posts/2/` | 文章列表（第2页+） | MainGridLayout（带侧边栏） |
| `/posts/[slug]` | 文章详情 | 保持不变 |

### 导航栏变更

- `LinkPreset.Home` → 指向 `/`（门户）
- 新增导航项「文章」→ 指向 `/posts/`
- 其他导航项不变

## [S4] 门户区组件设计

### 布局结构

```
.home-portal (div)
├── .portal-hero (section) — 个人展示区
│   ├── 头像 + MagicRings + 状态按钮 + 运行天数
│   └── 名字 + 职业标签 + 打字机签名
├── AnnouncementMarquee — 公告跑马灯
├── .portal-grid (div) — 二列响应式网格
│   ├── QuickNav — 快速导航卡片（2×4 图标网格）
│   └── PortalStats — 站点数据（刮刮卡）
├── DailyQuote — 每日一言
├── .portal-recent — 最近文章
│   ├── 标题 + "查看全部"链接
│   └── 3 篇文章精简卡片
└── .portal-moments — 最近说说
    ├── 标题 + "查看全部"链接
    └── 2-3 条说说预览
```

### 响应式断点

| 断点 | 布局 |
|------|------|
| < 768px | 单列堆叠 |
| 768px - 1023px | 二列网格（导航+统计） |
| >= 1024px | 二列网格 + 更宽松间距 |

## [S5] 各模块详细设计

### S5.1 个人展示区（Hero）

保留现有 `HomePortal.astro` 的核心逻辑：
- MagicRings 涟漪动效（上班时显示，下班时隐藏）
- 上下班状态检测 + 头像切换
- 打字机签名（多条循环）
- 新增：运行天数徽章（从 `siteStartDate` 计算）

移除 `100vw` 全宽 hack，让 hero 自然在 grid 内居中。

### S5.2 公告跑马灯（AnnouncementMarquee）

新建组件 `src/components/widget/AnnouncementMarquee.astro`。
- 配置驱动：从 `siteConfig.announcement` 读取公告文本
- CSS animation 实现无限循环滚动
- 单行，主题色文字，左右留 fade 遮罩

### S5.3 快速导航卡片（QuickNav）

新建组件 `src/components/widget/QuickNav.astro`。
- 2×4 网格，每个卡片：icon + 文字标签
- 预设入口：书架、影视与游戏、音乐、留言板、说说、相册、友链、关于
- 每个入口可配置显示/隐藏（跟随 `siteConfig.pages` 开关）
- hover：`border-color` 过渡到主题色，轻微 `scale(1.02)`
- 点击跳转对应页面

### S5.4 站点数据（PortalStats）

复用现有 `PortalStats.astro` 的刮刮卡效果，微调：
- 移除外层黑框 `border: 2px solid #000`，改为更轻的 `border: 1px solid var(--line-divider)`
- 保持 star 粒子 + clip-path 刮刮卡交互

### S5.5 每日一言（DailyQuote）

新建组件 `src/components/widget/DailyQuote.astro`。
- 内置一组名言/诗句数组
- 客户端 JS 每次刷新随机选一条
- 设计：左侧竖线（主题色）+ 引用文字 + 来源署名
- 支持配置自定义语录列表

### S5.6 最近文章预览

直接在 `HomePortal.astro` 中查询 `getSortedPosts` 取前 3 篇。
- 使用 `PostCard.astro` 的精简渲染（标题 + 日期 + 标签）
- 底部 "查看全部文章 →" 链接指向 `/posts/`

### S5.7 最近说说动态

查询 `getCollection("moments")` 取前 2-3 条。
- 显示：日期 + 文字内容截断
- 底部 "查看更多 →" 链接指向 `/moments/`

## [S6] 文章列表页

新建 `src/pages/posts/[...page].astro`：
- 复用现有 `[...page].astro` 的分页逻辑
- 包含 CategoryTools（分类栏 + 布局切换）
- 包含 PostPage（文章卡片列表）
- 包含 Pagination（分页）
- 使用 MainGridLayout 布局

原 `[...page].astro` 改为门户首页：
- 移除文章列表相关逻辑
- 只渲染 HomePortal 组件

## [S7] 样式规范

门户区样式放入 `src/styles/features/portal.css`，遵循项目规范：
- 使用 CSS 自定义属性（`--primary`, `--line-divider`, `--content-meta` 等）
- 暗色模式选择器统一使用 `:root.dark`
- 不使用 `!important`
- 使用 `@layer components` 管理特异性
- 主题色仅用于：标题下划线、hover 状态、数据高亮、公告文字

## [S8] 配置变更

### siteConfig.ts 新增

```ts
// 公告配置
announcement: {
  enable: true,
  text: "欢迎来到团子和蛋糕的博客！",
},

// 每日一言配置
dailyQuote: {
  enable: true,
  quotes: [
    { text: "人生到处知何似，应似飞鸿踏雪泥。", source: "苏轼" },
    { text: "海棠花未眠，老陈总在我身边。", source: "团子" },
    // ...
  ],
},
```

### navBarConfig.ts 变更

- 在导航链接数组中，在「分类」之后插入「文章」链接
- `LinkPreset.Home` 保持指向 `/`

## [S9] 文件清单

### 新建

| 文件 | 说明 |
|------|------|
| `src/components/widget/QuickNav.astro` | 快速导航卡片 |
| `src/components/widget/DailyQuote.astro` | 每日一言 |
| `src/components/widget/AnnouncementMarquee.astro` | 公告跑马灯 |
| `src/pages/posts/[...page].astro` | 文章列表页 |
| `src/styles/features/portal.css` | 门户区样式 |

### 重写

| 文件 | 说明 |
|------|------|
| `src/components/layout/HomePortal.astro` | 门户区主组件（完全重写） |

### 修改

| 文件 | 说明 |
|------|------|
| `src/pages/[...page].astro` | 改为门户首页，移除文章列表逻辑 |
| `src/config/siteConfig.ts` | 新增 announcement、dailyQuote 配置 |
| `src/config/navBarConfig.ts` | 新增「文章」导航项 |
| `src/types/config.ts` | 新增相关类型定义 |
| `src/i18n/i18nKey.ts` | 新增门户相关 i18n 键 |
| `src/i18n/languages/*.ts` | 5 个语言文件同步更新 |

## [S10] 实施顺序

1. **配置与类型** — 更新 siteConfig、types、navBarConfig
2. **新建小组件** — QuickNav、DailyQuote、AnnouncementMarquee
3. **重写 HomePortal** — 整合所有组件
4. **新建文章列表页** — `src/pages/posts/[...page].astro`
5. **修改首页** — `[...page].astro` 改为门户
6. **样式** — 创建 portal.css
7. **i18n** — 新增翻译键
8. **验证** — 构建测试 + 页面跳转验证
