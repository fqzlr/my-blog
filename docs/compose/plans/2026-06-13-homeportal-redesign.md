# HomePortal 重新设计实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将博客首页重构为个性化门户区，文章列表独立到 `/posts/` 页面

**Architecture:** 首页 (`/`) 改为门户区展示个人信息、快速导航、站点数据和最新内容预览。文章列表移到 `/posts/[...page].astro`，复用现有 PostPage 组件。门户区使用极简+主题色点缀风格，与现有黑白灰中性调一致。

**Tech Stack:** Astro 5.17, Svelte 5, Tailwind CSS v4, CSS Layers

**Spec:** `docs/compose/specs/2026-06-13-homeportal-redesign-design.md`

---

## 文件结构总览

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/components/widget/AnnouncementMarquee.astro` | 公告跑马灯 |
| `src/components/widget/QuickNav.astro` | 快速导航卡片 |
| `src/components/widget/DailyQuote.astro` | 每日一言 |
| `src/pages/posts/[...page].astro` | 文章列表页 |
| `src/styles/features/portal.css` | 门户区全局样式 |

### 重写文件

| 文件 | 职责 |
|------|------|
| `src/components/layout/HomePortal.astro` | 门户区主组件 |

### 修改文件

| 文件 | 职责 |
|------|------|
| `src/pages/[...page].astro` | 改为门户首页 |
| `src/config/siteConfig.ts` | 新增 portal 配置 |
| `src/types/config.ts` | 新增类型 |
| `src/config/navBarConfig.ts` | 新增「文章」导航项 |
| `src/constants/link-presets.ts` | 新增 Posts LinkPreset |
| `src/i18n/i18nKey.ts` | 新增 i18n 键 |
| `src/i18n/languages/zh_CN.ts` | 中文翻译 |
| `src/i18n/languages/zh_TW.ts` | 繁体翻译 |
| `src/i18n/languages/en.ts` | 英文翻译 |
| `src/i18n/languages/ja.ts` | 日文翻译 |
| `src/i18n/languages/ru.ts` | 俄文翻译 |

---

## Task 1: 配置类型与站点配置

**Covers:** [S3, S8]

**Files:**
- Modify: `src/types/config.ts`
- Modify: `src/config/siteConfig.ts`

- [ ] **Step 1: 在 `types/config.ts` 的 `SiteConfig` 类型中添加 portal 配置**

在 `SiteConfig` 类型的 `siteStartDate` 字段之后添加：

```typescript
	// 门户区配置
	portal?: {
		// 公告跑马灯
		announcement?: {
			enable: boolean;
			text: string;
		};
		// 每日一言
		dailyQuote?: {
			enable: boolean;
			quotes: { text: string; source: string }[];
		};
		// 最近文章预览数量
		recentPostsCount?: number;
		// 最近说说预览数量
		recentMomentsCount?: number;
	};
```

- [ ] **Step 2: 在 `siteConfig.ts` 中添加 portal 配置**

在 `siteStartDate` 字段之后添加：

```typescript
	// 门户区配置
	portal: {
		announcement: {
			enable: true,
			text: "欢迎来到团子和蛋糕的博客！这里有技术分享、生活记录和更多有趣内容。",
		},
		dailyQuote: {
			enable: true,
			quotes: [
				{ text: "人生到处知何似，应似飞鸿踏雪泥。", source: "苏轼" },
				{ text: "海棠花未眠，老陈总在我身边。", source: "团子" },
				{ text: "世界上只有一种真正的英雄主义，那就是在认识生活的真相后依然热爱生活。", source: "罗曼·罗兰" },
				{ text: "愿你一生努力，一生被爱。想要的都拥有，得不到的都释怀。", source: "八月长安" },
				{ text: "凡是过去，皆为序章。", source: "莎士比亚" },
				{ text: "温柔半两，从容一生。", source: "三毛" },
			],
		},
		recentPostsCount: 3,
		recentMomentsCount: 3,
	},
```

- [ ] **Step 3: 验证 TypeScript 类型无误**

Run: `pnpm build 2>&1 | head -20`
Expected: 无类型错误（构建可能因其他原因失败，但不应有 TS 类型错误）

---

## Task 2: i18n 翻译键

**Covers:** [S5]

**Files:**
- Modify: `src/i18n/i18nKey.ts`
- Modify: `src/i18n/languages/zh_CN.ts`
- Modify: `src/i18n/languages/zh_TW.ts`
- Modify: `src/i18n/languages/en.ts`
- Modify: `src/i18n/languages/ja.ts`
- Modify: `src/i18n/languages/ru.ts`

- [ ] **Step 1: 在 `i18nKey.ts` 中添加新键**

在 `recentMoments = "recentMoments"` 之后添加：

```typescript
	portalRecentPosts = "portalRecentPosts",
	portalRecentMoments = "portalRecentMoments",
	portalViewAll = "portalViewAll",
	portalViewMore = "portalViewMore",
	portalRunningDays = "portalRunningDays",
	portalDays = "portalDays",
```

- [ ] **Step 2: 在 `zh_CN.ts` 中添加中文翻译**

在 `recentMoments` 条目之后添加：

```typescript
	portalRecentPosts: "最近文章",
	portalRecentMoments: "最近动态",
	portalViewAll: "查看全部",
	portalViewMore: "查看更多",
	portalRunningDays: "已运行",
	portalDays: "天",
```

- [ ] **Step 3: 在 `zh_TW.ts` 中添加繁体翻译**

```typescript
	portalRecentPosts: "最近文章",
	portalRecentMoments: "最近動態",
	portalViewAll: "查看全部",
	portalViewMore: "查看更多",
	portalRunningDays: "已運行",
	portalDays: "天",
```

- [ ] **Step 4: 在 `en.ts` 中添加英文翻译**

```typescript
	portalRecentPosts: "Recent Posts",
	portalRecentMoments: "Recent Updates",
	portalViewAll: "View All",
	portalViewMore: "View More",
	portalRunningDays: "Running for",
	portalDays: "days",
```

- [ ] **Step 5: 在 `ja.ts` 中添加日文翻译**

```typescript
	portalRecentPosts: "最近の記事",
	portalRecentMoments: "最近の更新",
	portalViewAll: "すべて見る",
	portalViewMore: "もっと見る",
	portalRunningDays: "運営",
	portalDays: "日目",
```

- [ ] **Step 6: 在 `ru.ts` 中添加俄文翻译**

```typescript
	portalRecentPosts: "Недавние записи",
	portalRecentMoments: "Недавние обновления",
	portalViewAll: "Смотреть все",
	portalViewMore: "Ещё",
	portalRunningDays: "Работает",
	portalDays: "дней",
```

---

## Task 3: LinkPreset 与导航栏更新

**Covers:** [S3]

**Files:**
- Modify: `src/types/config.ts` — 添加 `Posts = 11` 到 `LinkPreset` 枚举
- Modify: `src/constants/link-presets.ts` — 添加 Posts 链接预设
- Modify: `src/config/navBarConfig.ts` — 在导航栏中添加「文章」入口

- [ ] **Step 1: 在 `types/config.ts` 的 `LinkPreset` 枚举中添加 Posts**

在 `Changelog = 10` 之后添加：

```typescript
	Posts = 11,
```

- [ ] **Step 2: 在 `link-presets.ts` 中添加 Posts 链接**

在 `[LinkPreset.Changelog]` 块之后添加：

```typescript
	[LinkPreset.Posts]: {
		name: i18n(I18nKey.postList),
		url: "/posts/",
		icon: "material-symbols:article-outline",
	},
```

- [ ] **Step 3: 在 `navBarConfig.ts` 中添加「文章」导航项**

在 `LinkPreset.Home` 之后、分类链接之前，添加：

```typescript
		// 文章列表
		LinkPreset.Posts,
```

找到这行：
```typescript
		// 主页
		LinkPreset.Home,
```

在其后添加：
```typescript
		// 文章列表
		LinkPreset.Posts,
```

---

## Task 4: AnnouncementMarquee 公告跑马灯组件

**Covers:** [S5.2]

**Files:**
- Create: `src/components/widget/AnnouncementMarquee.astro`

- [ ] **Step 1: 创建 AnnouncementMarquee 组件**

```astro
---
import { siteConfig } from "@/config";

const announcement = siteConfig.portal?.announcement;
if (!announcement?.enable || !announcement.text) {
  // 如果未启用，不渲染任何内容
}
---

{announcement?.enable && announcement.text && (
  <div class="announcement-marquee">
    <div class="marquee-track">
      <span class="marquee-content">{announcement.text}</span>
      <span class="marquee-content" aria-hidden="true">{announcement.text}</span>
    </div>
  </div>
)}

<style>
  .announcement-marquee {
    width: 100%;
    overflow: hidden;
    padding: 0.5rem 0;
    border-top: 1px solid var(--line-divider);
    border-bottom: 1px solid var(--line-divider);
    position: relative;
  }

  .announcement-marquee::before,
  .announcement-marquee::after {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    width: 3rem;
    z-index: 2;
    pointer-events: none;
  }

  .announcement-marquee::before {
    left: 0;
    background: linear-gradient(to right, var(--page-bg), transparent);
  }

  .announcement-marquee::after {
    right: 0;
    background: linear-gradient(to left, var(--page-bg), transparent);
  }

  .marquee-track {
    display: flex;
    width: max-content;
    animation: marquee-scroll 25s linear infinite;
  }

  .marquee-content {
    flex-shrink: 0;
    padding: 0 3rem;
    font-size: 0.875rem;
    color: var(--content-meta);
    white-space: nowrap;
  }

  @keyframes marquee-scroll {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }

  .announcement-marquee:hover .marquee-track {
    animation-play-state: paused;
  }
</style>
```

---

## Task 5: QuickNav 快速导航组件

**Covers:** [S5.3]

**Files:**
- Create: `src/components/widget/QuickNav.astro`

- [ ] **Step 1: 创建 QuickNav 组件**

```astro
---
import { Icon } from "astro-icon/components";
import { siteConfig } from "@/config";

interface NavItem {
  icon: string;
  label: string;
  url: string;
  show: boolean;
}

const navItems: NavItem[] = [
  { icon: "material-symbols:book-5", label: "书架", url: "/books/", show: !!siteConfig.pages.books },
  { icon: "material-symbols:movie", label: "影视与游戏", url: "/movies-games/", show: !!siteConfig.pages.moviesGames },
  { icon: "material-symbols:music-note", label: "音乐", url: "/music/", show: !!siteConfig.pages.musicPage },
  { icon: "material-symbols:chat", label: "留言板", url: "/guestbook/", show: !!siteConfig.pages.guestbook },
  { icon: "material-symbols:chat-bubble-outline", label: "说说", url: "/moments/", show: true },
  { icon: "material-symbols:photo-album-outline", label: "相册", url: "/album/", show: true },
  { icon: "material-symbols:group", label: "友链", url: "/friends/", show: true },
  { icon: "material-symbols:person", label: "关于", url: "/about/", show: true },
];

const visibleItems = navItems.filter(item => item.show);
---

<div class="quick-nav">
  <div class="quick-nav-grid">
    {visibleItems.map(item => (
      <a href={item.url} class="quick-nav-item">
        <Icon name={item.icon} class="quick-nav-icon" />
        <span class="quick-nav-label">{item.label}</span>
      </a>
    ))}
  </div>
</div>

<style>
  .quick-nav {
    width: 100%;
  }

  .quick-nav-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
  }

  .quick-nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    border-radius: 0.75rem;
    border: 1px solid var(--line-divider);
    transition: all 0.2s ease;
    text-decoration: none;
    color: var(--deep-text);
  }

  .quick-nav-item:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
  }

  .quick-nav-icon {
    font-size: 1.5rem;
    color: var(--content-meta);
    transition: color 0.2s ease;
  }

  .quick-nav-item:hover .quick-nav-icon {
    color: var(--primary);
  }

  .quick-nav-label {
    font-size: 0.75rem;
    color: var(--content-meta);
    text-align: center;
    line-height: 1.2;
  }

  @media (max-width: 767px) {
    .quick-nav-grid {
      grid-template-columns: repeat(4, 1fr);
      gap: 0.375rem;
    }

    .quick-nav-item {
      padding: 0.5rem 0.25rem;
    }

    .quick-nav-icon {
      font-size: 1.25rem;
    }

    .quick-nav-label {
      font-size: 0.625rem;
    }
  }
</style>
```

---

## Task 6: DailyQuote 每日一言组件

**Covers:** [S5.5]

**Files:**
- Create: `src/components/widget/DailyQuote.astro`

- [ ] **Step 1: 创建 DailyQuote 组件**

```astro
---
import { siteConfig } from "@/config";

const quotes = siteConfig.portal?.dailyQuote?.quotes || [];
const isEnabled = siteConfig.portal?.dailyQuote?.enable && quotes.length > 0;
---

{isEnabled && (
  <div class="daily-quote" id="daily-quote">
    <div class="quote-line"></div>
    <div class="quote-body">
      <p class="quote-text" id="quote-text"></p>
      <span class="quote-source" id="quote-source"></span>
    </div>
  </div>
)}

<script is:inline define:vars={{ quotes }}>
(function() {
  if (!quotes || quotes.length === 0) return;

  var idx = Math.floor(Math.random() * quotes.length);
  var quote = quotes[idx];

  var textEl = document.getElementById("quote-text");
  var sourceEl = document.getElementById("quote-source");
  if (textEl) textEl.textContent = "「" + quote.text + "」";
  if (sourceEl) sourceEl.textContent = "— " + quote.source;
})();
</script>

<style>
  .daily-quote {
    display: flex;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid var(--line-divider);
    align-items: stretch;
  }

  .quote-line {
    width: 3px;
    flex-shrink: 0;
    border-radius: 9999px;
    background: var(--primary);
  }

  .quote-body {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .quote-text {
    font-size: 0.9375rem;
    color: var(--deep-text);
    line-height: 1.6;
    margin: 0;
  }

  .quote-source {
    font-size: 0.75rem;
    color: var(--content-meta);
    text-align: right;
  }
</style>
```

---

## Task 7: HomePortal 重写

**Covers:** [S4, S5.1, S5.6, S5.7]

**Files:**
- Rewrite: `src/components/layout/HomePortal.astro`

- [ ] **Step 1: 重写 HomePortal 组件**

完整替换 `src/components/layout/HomePortal.astro`：

```astro
---
import type { ImageMetadata } from "astro";
import type { CollectionEntry } from "astro:content";
import { getCollection } from "astro:content";
import { Icon } from "astro-icon/components";
import ImageWrapper from "@/components/common/ImageWrapper.astro";
import TypewriterText from "@/components/features/TypewriterText.astro";
import AnnouncementMarquee from "@/components/widget/AnnouncementMarquee.astro";
import DailyQuote from "@/components/widget/DailyQuote.astro";
import PortalStats from "@/components/widget/PortalStats.astro";
import QuickNav from "@/components/widget/QuickNav.astro";
import { profileConfig, siteConfig } from "@/config";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { getPostUrlBySlug } from "@/utils/url-utils";

// 上班头像：从 avatar_sb 文件夹加载所有动态 WebP
const workAvatarModules = import.meta.glob<ImageMetadata>(
	"../../assets/images/avatar_sb/*.webp",
	{ import: "default" },
);
const workAvatarUrls: string[] = [];
for (const [, loader] of Object.entries(workAvatarModules)) {
	const meta = await loader();
	workAvatarUrls.push(meta.src);
}
if (workAvatarUrls.length === 0 && profileConfig.avatar) {
	workAvatarUrls.push(profileConfig.avatar);
}

// 运行天数计算
const startDate = siteConfig.siteStartDate ? new Date(siteConfig.siteStartDate) : null;
const now = new Date();
const runningDays = startDate
	? Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
	: 0;

// 最近文章
const recentCount = siteConfig.portal?.recentPostsCount ?? 3;
const allPosts = await getCollection("posts", ({ data }) => {
	return import.meta.env.PROD ? data.draft !== true : true;
});
const recentPosts = allPosts
	.sort((a, b) => b.data.published.valueOf() - a.data.published.valueOf())
	.slice(0, recentCount);

// 最近说说
const momentsCount = siteConfig.portal?.recentMomentsCount ?? 3;
const allMoments = await getCollection("moments");
const recentMoments = allMoments
	.sort((a, b) => {
		const dateA = a.data.published ? new Date(a.data.published).valueOf() : 0;
		const dateB = b.data.published ? new Date(b.data.published).valueOf() : 0;
		return dateB - dateA;
	})
	.slice(0, momentsCount);

function formatDate(date: Date): string {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
---

<div class="home-portal">
  {/* === HERO: 个人展示区 === */}
  <section class="portal-hero section onload-animation">
    <div class="hero-content">
      <div
        class="avatar-ripple-wrapper" id="avatar-ripple-wrapper"
        data-work-start={siteConfig.workHours?.start ?? 9}
        data-work-end={siteConfig.workHours?.end ?? 18}
        data-work-days={JSON.stringify(siteConfig.workHours?.workDays ?? [1,2,3,4,5])}
        data-work-avatars={JSON.stringify(workAvatarUrls)}
      >
        <div class="magic-rings-bg" id="magic-rings-bg"></div>
        <a href="/about/" class="avatar-core">
          <div class="avatar-img avatar-work">
            <img id="work-avatar-img" src="" alt="Profile Image of the Author" class="w-full h-full object-cover" />
            <noscript>
              <img data-src={profileConfig.avatar || ""} alt="Profile Image of the Author" class="w-full h-full object-cover" />
            </noscript>
          </div>
          {profileConfig.avatarOffWork && (
            <div class="avatar-img avatar-off">
              <ImageWrapper src={profileConfig.avatarOffWork} alt="Profile Image of the Author" class="w-full h-full" loading="eager" widths={[400]} sizes="400px" />
            </div>
          )}
        </a>
        <div class="avatar-status-btn" id="avatar-status-btn">
          <span class="status-dot"></span>
          <span class="status-text" id="status-text">下班</span>
        </div>
      </div>

      <div class="hero-text">
        {profileConfig.displayName && (
          <span class="profile-display-name">{profileConfig.displayName}</span>
        )}
        {profileConfig.occupation && (
          <span class="profile-occupation">{profileConfig.occupation}</span>
        )}
        <TypewriterText text={profileConfig.bio || ""} speed={80} pauseTime={3000} class="text-base text-(--content-meta) mt-2" />
        {runningDays > 0 && (
          <div class="running-days">
            <Icon name="material-symbols:calendar-month-outline" class="running-days-icon" />
            <span>{i18n(I18nKey.portalRunningDays)} {runningDays} {i18n(I18nKey.portalDays)}</span>
          </div>
        )}
      </div>
    </div>
  </section>

  {/* === 公告跑马灯 === */}
  <div class="onload-animation" style="animation-delay: calc(var(--content-delay) + 50ms);">
    <AnnouncementMarquee />
  </div>

  {/* === 网格区：快速导航 + 站点数据 === */}
  <div class="portal-grid onload-animation" style="animation-delay: calc(var(--content-delay) + 100ms);">
    <div class="portal-card">
      <QuickNav />
    </div>
    <div class="portal-card">
      <PortalStats />
    </div>
  </div>

  {/* === 每日一言 === */}
  <div class="onload-animation" style="animation-delay: calc(var(--content-delay) + 150ms);">
    <DailyQuote />
  </div>

  {/* === 最近文章 === */}
  {recentPosts.length > 0 && (
    <section class="portal-section onload-animation" style="animation-delay: calc(var(--content-delay) + 200ms);">
      <div class="section-header">
        <span class="section-title">{i18n(I18nKey.portalRecentPosts)}</span>
        <a href="/posts/" class="section-link">
          {i18n(I18nKey.portalViewAll)} <Icon name="material-symbols:arrow-forward" class="section-link-icon" />
        </a>
      </div>
      <div class="recent-posts-grid">
        {recentPosts.map((post) => (
          <a href={getPostUrlBySlug(post.id)} class="recent-post-card">
            <div class="recent-post-meta">
              <time class="recent-post-date">{formatDate(post.data.published)}</time>
              {post.data.category && <span class="recent-post-category">{post.data.category}</span>}
            </div>
            <h3 class="recent-post-title">{post.data.title}</h3>
            {post.data.tags && post.data.tags.length > 0 && (
              <div class="recent-post-tags">
                {post.data.tags.slice(0, 3).map(tag => (
                  <span class="recent-post-tag">#{tag}</span>
                ))}
              </div>
            )}
          </a>
        ))}
      </div>
    </section>
  )}

  {/* === 最近说说 === */}
  {recentMoments.length > 0 && (
    <section class="portal-section onload-animation" style="animation-delay: calc(var(--content-delay) + 250ms);">
      <div class="section-header">
        <span class="section-title">{i18n(I18nKey.portalRecentMoments)}</span>
        <a href="/moments/" class="section-link">
          {i18n(I18nKey.portalViewMore)} <Icon name="material-symbols:arrow-forward" class="section-link-icon" />
        </a>
      </div>
      <div class="recent-moments-list">
        {recentMoments.map((moment) => (
          <a href="/moments/" class="recent-moment-item">
            <time class="moment-date">
              {moment.data.published ? formatDate(new Date(moment.data.published)) : ""}
            </time>
            <p class="moment-content">
              {typeof moment.data.content === 'string'
                ? moment.data.content.slice(0, 100) + (moment.data.content.length > 100 ? '...' : '')
                : ''}
            </p>
          </a>
        ))}
      </div>
    </section>
  )}
</div>

<style>
  /* === Portal Container === */
  .home-portal {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1rem 0;
  }

  /* === Hero Section === */
  .portal-hero {
    display: flex;
    justify-content: center;
    padding: 1rem 0;
  }

  .hero-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.5rem;
    text-align: center;
  }

  .hero-text {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
  }

  /* === Avatar (reused from existing) === */
  .avatar-ripple-wrapper {
    position: relative;
    width: 11rem;
    height: 11rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .magic-rings-bg {
    position: absolute;
    top: -3rem;
    bottom: -2.5rem;
    left: -8rem;
    right: -8rem;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .magic-rings-bg :global(canvas) {
    width: 100% !important;
    height: 100% !important;
    transform: scaleY(0.45);
  }

  @media (min-width: 768px) {
    .magic-rings-bg {
      left: -20rem;
      right: -20rem;
    }
  }

  [data-time-mode="off"] .magic-rings-bg {
    display: none;
  }

  .avatar-core {
    position: relative;
    z-index: 2;
    display: block;
    width: 11rem;
    height: 11rem;
    border-radius: 9999px;
    overflow: hidden;
    border: 1px solid var(--line-divider);
    transition: border 0.3s ease;
  }

  [data-time-mode="off"] .avatar-core {
    border-width: 3px;
    border-color: var(--primary);
  }

  .avatar-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .avatar-img.avatar-work { display: none; }
  .avatar-img.avatar-off { display: none; }
  [data-time-mode="work"] .avatar-img.avatar-work { display: block; }
  [data-time-mode="off"] .avatar-img.avatar-off { display: block; }

  /* === Status Button === */
  .avatar-status-btn {
    position: absolute;
    bottom: -0.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 10;
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
    border: 1px solid var(--line-divider);
    color: var(--content-meta);
    background: var(--page-bg);
  }

  [data-time-mode="work"] .avatar-status-btn {
    border-color: oklch(0.65 0.2 350);
    color: oklch(0.65 0.2 350);
  }

  .status-dot {
    width: 0.375rem;
    height: 0.375rem;
    border-radius: 9999px;
    background: var(--content-meta);
    flex-shrink: 0;
  }

  [data-time-mode="work"] .status-dot {
    background: oklch(0.65 0.2 350);
    animation: status-pulse 1.5s ease-in-out infinite;
  }

  @keyframes status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* === Profile Text === */
  .profile-display-name {
    font-size: 2rem;
    font-weight: 700;
    color: var(--deep-text);
    letter-spacing: 0.05em;
  }

  .profile-occupation {
    font-size: 1rem;
    font-weight: 400;
    color: var(--content-meta);
    letter-spacing: 0.05em;
  }

  .running-days {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    margin-top: 0.5rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    border: 1px solid var(--line-divider);
    font-size: 0.75rem;
    color: var(--content-meta);
  }

  .running-days-icon {
    font-size: 0.875rem;
  }

  /* === Portal Grid === */
  .portal-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .portal-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  .portal-card {
    border: 1px solid var(--line-divider);
    border-radius: 0.75rem;
    padding: 1rem;
    overflow: hidden;
  }

  /* === Section Headers === */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--deep-text);
  }

  .section-link {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.875rem;
    color: var(--content-meta);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .section-link:hover {
    color: var(--primary);
  }

  .section-link-icon {
    font-size: 1rem;
    transition: transform 0.2s ease;
  }

  .section-link:hover .section-link-icon {
    transform: translateX(2px);
  }

  /* === Recent Posts Grid === */
  .recent-posts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  @media (min-width: 768px) {
    .recent-posts-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .recent-post-card {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border: 1px solid var(--line-divider);
    border-radius: 0.75rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .recent-post-card:hover {
    border-color: var(--primary);
    transform: translateY(-2px);
  }

  .recent-post-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--content-meta);
  }

  .recent-post-category {
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    border: 1px solid var(--line-divider);
  }

  .recent-post-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--deep-text);
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .recent-post-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .recent-post-tag {
    font-size: 0.6875rem;
    color: var(--content-meta);
  }

  /* === Recent Moments === */
  .recent-moments-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .recent-moment-item {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.75rem 1rem;
    border: 1px solid var(--line-divider);
    border-radius: 0.75rem;
    text-decoration: none;
    transition: all 0.2s ease;
  }

  .recent-moment-item:hover {
    border-color: var(--primary);
  }

  .moment-date {
    font-size: 0.75rem;
    color: var(--content-meta);
  }

  .moment-content {
    font-size: 0.875rem;
    color: var(--deep-text);
    line-height: 1.5;
    margin: 0;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }
</style>

<script>
import { initMagicRings } from '@components/features/MagicRings.ts';

(function() {
	var ringsInstance: ReturnType<typeof initMagicRings> = null;

	function getIsWork(wrapper: HTMLElement) {
		var start = parseInt(wrapper.dataset.workStart || '9') || 9;
		var end = parseInt(wrapper.dataset.workEnd || '18') || 18;
		var workDays = [1,2,3,4,5];
		try { workDays = JSON.parse(wrapper.dataset.workDays || '[1,2,3,4,5]'); } catch(e) {}
		var now = new Date();
		var day = now.getDay();
		var hour = now.getHours();
		var isWorkDay = workDays.indexOf(day) !== -1;
		return isWorkDay && hour >= start && hour < end;
	}

	function pickNextWorkAvatar(wrapper: HTMLElement): string {
		var urls: string[] = [];
		try { urls = JSON.parse(wrapper.dataset.workAvatars || '[]'); } catch(e) {}
		if (urls.length === 0) return '';
		var idx = parseInt(localStorage.getItem('work-avatar-idx') || '-1') || 0;
		idx = (idx + 1) % urls.length;
		localStorage.setItem('work-avatar-idx', String(idx));
		return urls[idx] || urls[0];
	}

	function applyWorkAvatar(url: string, onReady: () => void) {
		var img = document.getElementById('work-avatar-img') as HTMLImageElement | null;
		if (!img || !url) { onReady(); return; }
		if (img.complete && img.src && img.src.indexOf(url) !== -1) { onReady(); return; }
		img.onload = function() { onReady(); };
		img.onerror = function() { onReady(); };
		img.src = url;
	}

	function setTimeMode() {
		var wrapper = document.getElementById('avatar-ripple-wrapper');
		var statusText = document.getElementById('status-text');
		if (!wrapper) return;
		var isWork = getIsWork(wrapper);
		if (statusText) statusText.textContent = isWork ? '上班中' : '下班';

		if (isWork) {
			var avatarUrl = pickNextWorkAvatar(wrapper);
			applyWorkAvatar(avatarUrl, function() {
				if (wrapper) wrapper.setAttribute('data-time-mode', 'work');
			});
		} else {
			wrapper.setAttribute('data-time-mode', 'off');
		}
	}

	function initRings() {
		var container = document.getElementById('magic-rings-bg');
		var wrapper = document.getElementById('avatar-ripple-wrapper');
		if (!container || !wrapper) return;
		if (ringsInstance) {
			ringsInstance.destroy();
			ringsInstance = null;
		}
		var isWork = getIsWork(wrapper);
		if (isWork) {
			ringsInstance = initMagicRings(container, {
				color: '#E24EA0',
				colorTwo: '#F97316',
				ringCount: 6,
				speed: 1,
				attenuation: 10,
				lineThickness: 2,
				baseRadius: 0.35,
				radiusStep: 0.1,
				scaleRate: 0.1,
				opacity: 1,
				noiseAmount: 0,
				rotation: 0,
				ringGap: 1.5,
				fadeIn: 0.7,
				fadeOut: 0.5,
				followMouse: true,
				mouseInfluence: 0.2,
				hoverScale: 1.2,
				parallax: 0.05,
				clickBurst: true,
			});
		}
	}

	setTimeMode();
	initRings();
	setInterval(setTimeMode, 60000);

	document.addEventListener('astro:page-load', function() {
		setTimeMode();
		initRings();
	});
})();
</script>
```

---

## Task 8: 新建文章列表页

**Covers:** [S3, S6]

**Files:**
- Create: `src/pages/posts/[...page].astro`

- [ ] **Step 1: 创建文章列表页**

从现有 `src/pages/[...page].astro` 复制文章列表逻辑到新文件：

```astro
---
import type { GetStaticPaths } from "astro";
import Pagination from "@/components/common/Pagination.astro";
import CategoryTools from "@/components/controls/CategoryTools.astro";
import PostPage from "@/components/layout/PostPage.astro";
import { siteConfig } from "@/config";
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import { getSortedPosts } from "@/utils/content-utils";

export const getStaticPaths = (async ({ paginate }) => {
	const allBlogPosts = await getSortedPosts();
	const pageSize = siteConfig.pagination.postsPerPage;
	return paginate(allBlogPosts, { pageSize });
}) satisfies GetStaticPaths;

const { page } = Astro.props;
const len = page.data.length;
---

<MainGridLayout>
  {siteConfig.categoryBar && <CategoryTools />}
  <PostPage page={page} />
  {
    page.total > page.size && (
      <Pagination
        class="mx-auto onload-animation"
        page={page}
        style={`animation-delay: calc(var(--content-delay) + ${len * 50}ms)`}
      />
    )
  }
</MainGridLayout>
```

---

## Task 9: 修改首页为门户

**Covers:** [S3, S6]

**Files:**
- Modify: `src/pages/[...page].astro`

- [ ] **Step 1: 替换 `[...page].astro` 为门户首页**

完整替换 `src/pages/[...page].astro`：

```astro
---
import type { GetStaticPaths } from "astro";
import HomePortal from "@/components/layout/HomePortal.astro";
import MainGridLayout from "@/layouts/MainGridLayout.astro";
import { getSortedPosts } from "@/utils/content-utils";

export const getStaticPaths = (async ({ paginate }) => {
	const allBlogPosts = await getSortedPosts();
	// 首页只需要1页（门户页），实际分页在 /posts/ 页面
	return paginate(allBlogPosts, { pageSize: allBlogPosts.length });
}) satisfies GetStaticPaths;

const { page } = Astro.props;
---

<MainGridLayout>
  <HomePortal />
</MainGridLayout>
```

---

## Task 10: 门户区样式文件

**Covers:** [S7]

**Files:**
- Create: `src/styles/features/portal.css`
- Modify: `src/styles/main.css` — 添加 import

- [ ] **Step 1: 创建 `portal.css`**

```css
/* ===== 门户区全局样式 ===== */
@layer components {
  /* 门户区容器 */
  .home-portal {
    max-width: 100%;
  }

  /* 门户区入场动画 */
  .home-portal .onload-animation {
    opacity: 0;
    animation: portal-fade-in 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  @keyframes portal-fade-in {
    from {
      opacity: 0;
      transform: translateY(0.75rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
}
```

- [ ] **Step 2: 在 `main.css` 中导入 `portal.css`**

读取 `src/styles/main.css`，在已有的 `@import` 链末尾添加：

```css
@import "./features/portal.css";
```

---

## Task 11: 构建验证

**Covers:** [S10]

- [ ] **Step 1: 运行构建**

Run: `pnpm build`
Expected: 构建成功，无 TypeScript 错误

- [ ] **Step 2: 验证门户首页**

Run: `pnpm dev` 后访问 `http://localhost:4321/`
Expected:
- 显示头像+名字+签名+运行天数
- 公告跑马灯滚动
- 快速导航和站点数据二列布局
- 每日一言显示
- 最近文章和说说预览

- [ ] **Step 3: 验证文章列表页**

访问 `http://localhost:4321/posts/`
Expected:
- 文章列表正常显示
- 分类栏和布局切换正常
- 分页正常工作

- [ ] **Step 4: 验证导航栏**

Expected:
- 导航栏显示「首页」和「文章」两个入口
- 点击「首页」回到门户
- 点击「文章」进入文章列表

- [ ] **Step 5: 验证 Swup 过渡**

Expected:
- 从门户点击文章链接，页面平滑过渡
- 从文章页返回门户，MagicRings 重新初始化
