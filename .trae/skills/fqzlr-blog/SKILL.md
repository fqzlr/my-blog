---
name: "fqzlr-blog"
description: "fqzlr 个人博客项目（Astro+Svelte+TailwindCSS）开发指南。Invoke when modifying blog code, adding features, fixing bugs, or understanding project architecture for fqzlr's personal blog."
---

# Fqzlr 个人博客项目开发指南

## 项目概述

这是一个基于 **Astro 6.x** 的静态个人博客，采用 Svelte 5 作为交互组件框架，TailwindCSS v4 作为样式系统，支持 **Cloudflare Workers/Pages** 和 **Vercel** 双平台部署。站点地址：https://fqzlr.com

- **包管理器**：pnpm 9.x（强制使用，preinstall 钩子检查）
- **构建命令**：`pnpm run build`（生成图标 → Astro 构建 → Pagefind 搜索索引）
- **开发命令**：`pnpm run dev`（Astro dev server，端口 4321；API 代理到 localhost:8787 即 Wrangler）
- **代码规范**：Biome（`pnpm run lint` 检查，`pnpm run format` 格式化）

---

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Astro 6.4.6（Content Layer API） |
| UI组件 | Svelte 5.55.5（Runes模式） |
| 样式 | TailwindCSS v4 + Stylus + CSS |
| 代码高亮 | Expressive Code 0.41.x（双主题、折叠、语言徽章） |
| 图标 | Iconify + astro-icon（fa7/material-symbols/mingcute/ri/simple-icons/mdi） |
| 搜索 | Pagefind 静态搜索 + Cloudflare Vectorize AI搜索 |
| MD处理 | MDX + remark/rehype 插件链（Mermaid/PlantUML/KaTeX/Callouts/GitHub卡片/Email保护等） |
| 动画 | GSAP 3.15 + Anime.js 4.4 + Swup页面过渡 |
| 可视化 | ECharts 6 + Three.js（音乐可视化/3D模型） |
| 服务端 | Cloudflare Workers（Worker入口在 src/worker.js）/ Vercel Edge Functions |
| 存储 | Cloudflare KV（访客统计）+ Cloudflare Vectorize（AI搜索向量库） |
| AI功能 | Cloudflare Workers AI + AI Chat API（/api/ai-chat） |
| 评论系统 | 支持 Twikoo/Waline/Giscus/Disqus/Artalk，可配置切换 |
| 看板娘 | Live2D + Spine 双模型支持 |

---

## 目录结构详解

```
my-blog/
├── api/                          # Vercel Edge Functions（部署到Vercel时生效）
│   └── github.js                 # GitHub API代理（Edge Runtime）
├── public/                       # 静态资源（不经过Astro优化，直接复制到dist）
│   ├── assets/css/js/images/music/
│   ├── favicon/                  # 多尺寸favicon
│   ├── fonts/                    # 自定义字体
│   ├── gallery/                  # 相册原图（WebP格式）
│   ├── models/                   # 3D模型（GLB）
│   └── pio/                      # 看板娘模型（Live2D/Spine）
├── src/
│   ├── assets/images/            # Astro可优化图片（avatar/logo等）
│   ├── components/               # UI组件
│   │   ├── about/                # 关于页Canvas组件
│   │   ├── analytics/            # 统计代码组件（Google/Umami/Clarity/51la）
│   │   ├── comment/              # 评论系统组件（多平台切换）
│   │   ├── common/               # 通用组件（Button/Icon/Pagination/Markdown等）
│   │   │   ├── Icon.astro        # Astro图标组件
│   │   │   ├── Icon.svelte       # Svelte图标组件
│   │   │   └── portal.ts         # Svelte Portal工具
│   │   ├── controls/             # 控件组件（搜索/暗色切换/标签页/浮动码头）
│   │   ├── edit/                 # ✏️ 在线编辑器组件（核心编辑功能）
│   │   │   ├── WriteEditor.svelte    # 文章写作/编辑器
│   │   │   ├── EditToolbar.svelte    # 编辑工具栏（含代理状态指示）
│   │   │   ├── ChangelogEditor.svelte
│   │   │   ├── NotebooksEditor.svelte
│   │   │   ├── PlacesEditor.svelte
│   │   │   ├── RoutinesEditor.svelte
│   │   │   ├── FriendsEditor.svelte
│   │   │   ├── CollectionsEditor.svelte
│   │   │   ├── MomentsEditor.svelte
│   │   │   ├── BangumiEditor.svelte
│   │   │   ├── ConfigEditor.svelte   # 站点配置编辑器
│   │   │   ├── SponsorEditor.svelte
│   │   │   ├── FileCodeEditor.svelte # 文件代码编辑器
│   │   │   ├── MarkdownPageEditor.svelte
│   │   │   └── EditToast.svelte      # 编辑提示
│   │   ├── features/             # 功能特色组件
│   │   │   ├── music-visualizer/ # Three.js音乐可视化
│   │   │   ├── Guestbook*.svelte # 留言板组件（虚拟列表/卡片栈/模态框）
│   │   │   ├── Live2DWidget.astro
│   │   │   ├── SpineModel.astro
│   │   │   ├── MusicPlayer.astro
│   │   │   ├── EncryptedPost.astro  # 加密文章
│   │   │   ├── FriendCard.astro
│   │   │   ├── FancyboxManager.astro
│   │   │   ├── KatexManager.astro
│   │   │   ├── PageLoader.astro
│   │   │   └── TypewriterText.astro
│ │   ├── layout/                 # 布局组件
│   │   │   ├── Navbar.astro          # 导航栏
│   │   │   ├── Footer.astro          # 页脚
│   │   │   ├── CategoryBar.astro     # 分类快捷导航栏
│   │   │   ├── PostCard.astro        # 文章卡片
│   │   │   ├── PostPage.astro        # 文章详情页布局
│   │   │   ├── HomeHero.astro        # 首页Hero区
│   │   │   ├── HomeDataLayer.astro   # 首页数据层
│   │   │   ├── HomePortfolioShutterLayer.astro  # 百叶窗作品层
│   │   │   ├── ConfigCarrier.astro   # 配置注入载体
│   │   │   └── DropdownMenu.astro
│   │   ├── misc/                   # 杂项（分享海报/推荐文章/许可）
│   │   ├── moments/                # 动态/说说卡片组件
│   │   ├── pages/                  # 页面专属组件
│   │   │   ├── bangumi/books/gallery/movies-games/music/calendar/
│   │   │   ├── ArticleVirtualList.svelte  # 文章虚拟列表
│   │   │   └── AdvancedSearch.svelte
│   │   └── widget/                 # 侧边栏小部件
│   │       ├── Profile.astro           # 个人资料卡
│   │       ├── Announcement.astro      # 公告
│   │       ├── Categories/Tags.astro   # 分类/标签
│   │       ├── TagCloud/TagGraph/TagWordcloud.astro  # 标签可视化
│   │       ├── ArchiveHeatmap/GithubHeatmap/PostHeatmap.astro  # 热力图
│   │       ├── Calendar.astro
│   │       ├── Music.astro
│   │       ├── SidebarTOC.astro        # 文章目录
│   │       ├── CategoryRose.astro      # 分类南丁格尔玫瑰图
│   │       └── TerrariumModel.astro    # 微景观3D模型
│   ├── config/                      # ⚙️ 站点配置（集中管理，统一从index.ts导出）
│   │   ├── index.ts                 # 配置总入口（所有配置从此导出）
│   │   ├── siteConfig.ts            # 站点核心配置（标题/URL/主题色/页面开关等）
│   │   ├── editConfig.ts            # ✏️ 在线编辑配置（Gist ID/仓库配置）
│   │   ├── navBarConfig.ts          # 导航栏配置
│   │   ├── profileConfig.ts         # 个人资料配置
│   │   ├── sidebarConfig.ts         # 侧边栏布局配置
│   │   ├── commentConfig.ts         # 评论系统配置
│   │   ├── friendsConfig.ts         # 友链配置
│   │   ├── musicConfig.ts           # 音乐播放器配置
│   │   ├── fontConfig.ts            # 字体配置
│   │   ├── galleryConfig.ts         # 相册配置
│   │   ├── calendarConfig.ts        # 日历/节日/生日配置
│   │   ├── footerConfig.ts          # 页脚HTML配置
│   │   ├── adConfig.ts              # 广告配置
│   │   ├── announcementConfig.ts    # 公告配置
│   │   ├── sponsorConfig.ts         # 赞助配置
│   │   ├── coverImageConfig.ts      # 封面图/随机图配置
│   │   ├── pioConfig.ts             # 看板娘配置（Live2D/Spine）
│   │   ├── skillsConfig.ts          # 技能标签配置
│   │   ├── aiSearchConfig.ts        # AI搜索配置
│   │   ├── backgroundWallpaper.ts   # 背景壁纸配置
│   │   ├── collectionsApiConfig.ts  # 收藏API配置
│   │   ├── expressiveCodeConfig.ts  # 代码高亮配置
│   │   ├── homePortfolioShutterConfig.ts  # 首页百叶窗配置
│   │   ├── licenseConfig.ts         # 许可证配置
│   │   └── plantumlConfig.ts        # PlantUML配置
│   ├── constants/                   # 常量定义
│   │   ├── constants.ts             # 全局常量（亮色/暗色/系统模式、壁纸模式等枚举）
│   │   ├── icons.ts                 # 图标名称常量集合
│   │   ├── icon.ts                  # 默认图标配置
│   │   └── link-presets.ts          # 预设导航链接配置
│   ├── content/                     # 📝 Markdown/MDX内容源
│   │   ├── posts/                   # 博客文章
│   │   ├── bangumi/{anime,book,game,music}/  # 番剧/影视/读书/游戏/音乐
│   │   ├── changelog/               # 更新日志
│   │   ├── life/{notebooks,places,routines}/  # 生活记录
│   │   ├── moments/                 # 动态/说说
│   │   └── spec/{about,friends,guestbook,privacy}.md(x)  # 独立页面内容
│   ├── i18n/                        # 🌐 国际化
│   │   ├── languages/{zh_CN,zh_TW,en,ja,ru}.ts
│   │   ├── i18nKey.ts               # 翻译Key枚举
│   │   └── translation.ts           # 翻译主函数
│   ├── layouts/                     # Astro布局
│   │   ├── Layout.astro             # 根布局
│   │   └── MainGridLayout.astro     # 主网格布局
│   ├── pages/                       # 📄 Astro文件路由
│   │   ├── index.astro              # 首页
│   │   ├── about.astro              # 关于页
│   │   ├── archive.astro            # 归档页
│   │   ├── categories.astro/tags.astro/list.astro/search.astro
│   │   ├── friends.astro/guestbook.astro/sponsor.astro
│   │   ├── bangumi.astro/books.astro/gallery.astro/moments.astro
│   │   ├── calendar.astro/collections.astro/changelog.astro
│   │   ├── config.astro             # 可视化配置管理页面
│   │   ├── write/index.astro        # ✏️ 在线写作页面
│   │   ├── posts/[...slug].astro    # 文章详情页
│   │   ├── life/                   # 生活系列页面
│   │   ├── bangumi/[...slug].astro/books/[...slug].astro
│   │   ├── og/[...slug].png.ts      # 动态OG图片生成
│   │   ├── rss.xml.ts/rss.astro     # RSS订阅
│   │   ├── robots.txt.ts
│   │   ├── api/                     # Astro API路由（构建时/SSR）
│   │   │   ├── allPostMeta.json.ts
│   │   │   └── holidays.json.ts
│   │   ├── admin/                   # 后台管理（已弃用，admin页面开关默认false）
│   │   └── 404.astro
│   ├── plugins/                     # 🔌 Remark/Rehype插件
│   │   ├── remark-*.js/mjs          # Remark插件（Markdown AST处理）
│   │   └── rehype-*.mjs             # Rehype插件（HTML AST处理）
│   ├── styles/                      # 🎨 样式文件
│   │   ├── main.css                 # 主入口（Tailwind v4 @import）
│   │   ├── variables.styl           # Stylus变量
│   │   ├── markdown.css/markdown-extend.styl  # Markdown渲染样式
│   │   ├── layout-styles.css
│   │   ├── components/              # 组件样式（按目录对应）
│   │   ├── layout/                  # 布局样式
│   │   ├── pages/                   # 页面样式
│   │   ├── widgets/                 # 小部件样式
│   │   └── features/                # 功能样式
│   ├── types/                       # TypeScript类型定义
│   │   ├── config.ts                # 所有配置相关类型（核心！）
│   │   ├── post.ts                  # 文章类型
│   │   ├── bangumi.ts               # 番剧类型
│   │   └── guestbook.ts             # 留言板类型
│   ├── utils/                       # 🔧 工具函数库
│   │   ├── editMode.ts              # ✏️ 在线编辑核心工具（GitHub API代理封装）
│   │   ├── content-utils.ts         # 内容处理工具
│   │   ├── date-utils.ts            # 日期/农历工具（lunar-typescript）
│   │   ├── image-utils.ts           # 图片处理/EXIF工具（exifr/sharp）
│   │   ├── crypto-utils.ts          # 加密工具
│   │   ├── cache-utils.ts           # 缓存工具
│   │   ├── icon-loader.ts           # 图标加载工具
│   │   ├── navigation-utils.ts      # 导航工具
│   │   ├── setting-utils.ts         # 设置/本地存储工具
│   │   ├── layout-utils.ts          # 布局工具
│   │   ├── url-utils.ts             # URL工具
│   │   ├── toc-utils.ts             # 目录生成
│   │   ├── tag-graph-data.ts        # 标签图数据
│   │   ├── gallery-utils.ts         # 相册工具
│   │   ├── guestbook-*.ts           # 留言板相关（API/缓存/卡片栈）
│   │   ├── calendar-events.ts       # 日历事件工具
│   │   ├── lunar-utils.ts           # 农历工具
│   │   ├── about/                   # 关于页Canvas/reflow引擎
│   │   ├── home-data-layer.js       # 首页数据层动画（GSAP）
│   │   ├── home-portfolio-shutter.js # 首页百叶窗动画
│   │   ├── page-loader-controller.js # 页面加载控制器
│   │   ├── logo-loop.js             # Logo循环动画
│   │   ├── hatch-effect.js          # 阴影效果
│   │   └── virtual-list-window.js   # 虚拟列表窗口
│   ├── workers/                     # ☁️ Cloudflare Worker模块
│   │   ├── github-proxy.js          # GitHub API代理核心（JWT签名/令牌缓存/PKCS转换）
│   │   ├── guestbook.js             # 留言板API（KV存储）
│   │   ├── ai-chat.js               # AI聊天API
│   │   └── utils/{rate-limit,streaming}.js
│   ├── worker.js                    # Cloudflare Worker入口（路由分发）
│   ├── content.config.ts            # Astro Content Layer配置
│   ├── env.d.ts                     # 环境变量类型声明
│   └── global.d.ts                  # 全局类型声明
├── scripts/                         # 构建脚本
│   ├── generate-icons.js            # 图标生成脚本（构建前自动运行）
│   ├── new-post.js                  # 新建文章脚本：pnpm new-post
│   └── build-vectorize-index.js     # Vectorize向量索引构建
├── .github/workflows/               # GitHub Actions CI
├── wrangler.toml                    # Cloudflare Wrangler配置
├── vercel.json                      # Vercel部署配置
├── astro.config.mjs                 # Astro主配置
├── biome.json                       # Biome代码规范配置
├── postcss.config.mjs               # PostCSS配置
├── package.json
├── pagefind.yml                     # Pagefind搜索配置
└── tsconfig.json
```

---

## 核心架构与开发约定

### 1. 配置系统（重要！）

**所有站点配置集中在 `src/config/` 目录**，通过 `src/config/index.ts` 统一导出。修改站点行为时，优先查找对应配置文件而不是直接改组件代码。

- 添加新配置项时，先在 `src/types/config.ts` 定义类型，再在对应配置文件添加默认值，最后在 `index.ts` 导出
- 配置通过 `ConfigCarrier.astro` 注入到客户端，组件可从全局配置对象读取
- 页面开关在 `siteConfig.ts` 的 `pages` 对象控制，关闭的页面返回404

### 2. 组件约定

- **Astro 组件**（`.astro`）：用于静态渲染、布局、服务端逻辑
- **Svelte 5 组件**（`.svelte`）：用于需要客户端交互的功能（编辑器、动画、播放器等），使用 Runes 语法（`$state()`/`$derived()`/`$effect()`）
- 组件路径：通用组件放 `components/common/`，功能组件放对应子目录
- 图标使用 `<Icon name="iconify-name" />` 或 `<iconify-icon icon="iconify-name"></iconify-icon>`
- 图标名常量在 `src/constants/icons.ts` 统一管理，新增图标后需运行 `pnpm run icons` 生成

### 3. 在线编辑系统架构（核心功能）

认证流程：
1. **服务端代理模式**：所有 GitHub API 调用通过 `/api/github` 代理
2. **环境变量存储凭据**：
   - `GH_APP_ID`：GitHub App 数字ID
   - `GH_PRIVATE_KEY`：GitHub App PEM私钥（PKCS#1格式，支持自动转PKCS#8）
   - `GH_USER`：仓库所有者（默认 fqzlr）
   - `GH_REPO`：仓库名（默认 my-blog）
3. **JWT签名**：在 [github-proxy.js](file:///C:/Users/fqzlr/Documents/github/my-blog/src/workers/github-proxy.js) 中使用 Web Crypto API 签名 JWT（有效期8分钟）
4. **安装令牌缓存**：自动获取并缓存 Installation Access Token（有效期1小时）
5. **前端调用**：所有编辑器组件通过 [editMode.ts](file:///C:/Users/fqzlr/Documents/github/my-blog/src/utils/editMode.ts) 的 `githubApi()`/`getRepoFile()`/`updateRepoFile()`/`deleteRepoFile()`/`uploadImage()` 等封装函数操作GitHub

编辑页面路由：`/write`（新建）、`/write?slug=xxx`（编辑已有文章）

可编辑模块：
- 文章（posts）→ WriteEditor
- 更新日志（changelog）→ ChangelogEditor
- 生活/笔记本（notebooks）→ NotebooksEditor
- 生活/足迹（places）→ PlacesEditor
- 生活/日程（routines）→ RoutinesEditor
- 友链（friends）→ FriendsEditor
- 收藏（collections）→ CollectionsEditor
- 动态（moments）→ MomentsEditor
- 番剧（bangumi）→ BangumiEditor
- 赞助（sponsor）→ SponsorEditor
- 站点配置（config）→ ConfigEditor（通过 /config 页面）

**图片上传**：编辑器支持图片粘贴/拖拽上传，通过代理上传到 GitHub 仓库对应目录

### 4. 部署平台支持

项目支持双平台部署，API 路由共享代码：

| 功能 | Cloudflare Workers | Vercel |
|------|-------------------|--------|
| Worker 入口 | [src/worker.js](file:///C:/Users/fqzlr/Documents/github/my-blog/src/worker.js) | - |
| Edge Function 入口 | - | [api/github.js](file:///C:/Users/fqzlr/Documents/github/my-blog/api/github.js) |
| 共享代理逻辑 | [src/workers/github-proxy.js](file:///C:/Users/fqzlr/Documents/github/my-blog/src/workers/github-proxy.js) | 同左 |
| 配置文件 | [wrangler.toml](file:///C:/Users/fqzlr/Documents/github/my-blog/wrangler.toml) | [vercel.json](file:///C:/Users/fqzlr/Documents/github/my-blog/vercel.json) |
| 静态资源托管 | Cloudflare Pages（dist目录） | Vercel（outputDirectory: dist） |
| KV存储 | VISITOR_KV binding | - |
| 向量数据库 | VECTORIZE binding | - |
| AI绑定 | AI binding | - |

开发时：Vite dev server 将 `/api/*` 代理到 `http://localhost:8787`（需用 `wrangler dev` 启动Worker）

### 5. 内容管理

内容源位于 `src/content/`，使用 Astro Content Layer API（`content.config.ts` 定义）：

- **文章frontmatter字段**：title, published(datetime), description, tags(array), draft(bool), image(cover), category, pinned(bool)
- 新建文章可运行 `pnpm new-post` 脚本
- Markdown 支持扩展语法：Mermaid 图表、PlantUML、KaTeX 数学公式、Callouts 提示框、GitHub 卡片、Email 保护、图片网格、自定义指令

### 6. 样式约定

- 使用 TailwindCSS v4（通过 `@tailwindcss/vite` 插件）
- 主CSS入口在 `src/styles/main.css`（使用 `@import "tailwindcss"`）
- 主题色通过 CSS 变量 `--primary-hue` 控制，默认色相 165
- 暗色模式通过 `data-theme="dark"` 属性切换
- 组件样式可写在对应CSS文件中，或使用Tailwind类
- Stylus 用于 markdown 扩展样式（`markdown-extend.styl`）和变量定义

### 7. 国际化 (i18n)

- 语言文件在 `src/i18n/languages/`，默认 `zh_CN`
- 新增翻译key需在 `i18nKey.ts` 添加枚举，然后在各语言文件添加对应翻译
- 语言由 `siteConfig.lang` 控制

### 8. 图标系统

- 使用 Iconify 图标库，已安装的图标集：fa7-brands/fa7-regular/fa7-solid/material-symbols/mingcute/ri/simple-icons/mdi/svg-spinners
- Svelte组件中使用：`<iconify-icon icon="material-symbols:home-rounded"></iconify-icon>`
- Astro组件中使用：`<Icon name="material-symbols:home-rounded" />` 或 `<Icon icon="material-symbols:home-rounded" />`
- 图标名常量定义在 `src/constants/icons.ts`，**新增图标后必须运行 `pnpm run icons` 重新生成图标捆绑文件**

---

## 可用API端点

| 路径 | 平台 | 功能 | 认证方式 |
|------|------|------|---------|
| `GET/POST /api/github` | Workers/Vercel | GitHub API代理 | 服务端环境变量 |
| `POST /api/guestbook` | Workers | 留言板CRUD | 无（有速率限制） |
| `POST /api/ai-chat` | Workers | AI聊天 | 需 AI_API_KEY Secret |
| `GET /api/allPostMeta.json` | Astro静态 | 文章元数据JSON | 无 |
| `GET /api/holidays.json` | Astro静态 | 节假日数据 | 无 |

---

## 常见开发任务

### 添加新页面
1. 在 `src/pages/` 创建 `.astro` 文件
2. 使用 `Layout.astro` 或 `MainGridLayout.astro` 作为布局
3. 在 `siteConfig.pages` 添加开关（如需要）
4. 如需导航菜单项，在 `navBarConfig.ts` 添加

### 添加新配置项
1. 在 `src/types/config.ts` 定义类型接口
2. 在对应配置文件（如 `xxxConfig.ts`）添加默认值
3. 在 `src/config/index.ts` 导出
4. 组件中从 `@/config` 导入使用

### 添加新编辑器（可编辑内容类型）
1. 在 `src/components/edit/` 创建 `XxxEditor.svelte`
2. 从 `@/utils/editMode.ts` 导入 `githubApi, getRepoFile, updateRepoFile` 等
3. 在 `EditToolbar.svelte` 添加入口（如需要）
4. 在对应页面引入编辑器组件

### 添加Remark/Rehype插件
1. 在 `src/plugins/` 创建插件文件
2. 在 `astro.config.mjs` 的 `markdown.processor` 中注册

### 修改主题色
- 修改 `src/config/siteConfig.ts` 中 `themeColor.hue` 值（0-360）

### 修改卡片样式
- 修改 `src/config/siteConfig.ts` 中 `card` 配置（border/followTheme）

---

## 环境变量清单

### Cloudflare Secrets（Dashboard配置）
- `GH_APP_ID`：GitHub App ID
- `GH_PRIVATE_KEY`：GitHub App私钥PEM
- `GH_USER`：GitHub仓库所有者（可选，默认fqzlr）
- `GH_REPO`：GitHub仓库名（可选，默认my-blog）
- `AI_API_KEY`：AI聊天API密钥
- `UMAMI_TOKEN`：Umami统计Token
- `ALLOWED_ORIGINS`：CORS允许源（可选）

### Vercel环境变量（Vercel Dashboard配置）
- 同上 `GH_*` 变量

### wrangler.toml中配置的公开变量
- `NODE_VERSION`
- `UMAMI_API_URL`
- `UMAMI_WEBSITE_ID`

---

## 构建与部署注意事项

1. **构建前自动运行**：`pnpm run build` 先执行 `node scripts/generate-icons.js` 生成图标
2. **构建后自动运行**：Pagefind索引生成
3. **OG图片生成**：`siteConfig.generateOgImages` 默认false，开启后构建时间大幅增加
4. **静态资源缓存**：`/_astro/*` 和 `/assets/*` 设置长期缓存（immutable），HTML不缓存
5. **Cloudflare KV/Vectorize/AI绑定**：需在wrangler.toml配置并在Cloudflare Dashboard创建对应资源
6. **本地开发**：`pnpm dev`启动Astro(4321)，另开终端`npx wrangler dev`启动Worker(8787)处理API请求

---

## Git分支约定

- `main`：主分支（生产环境）
- `feature/frontend-editing`：前端在线编辑功能分支（当前开发分支）
