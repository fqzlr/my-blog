# Homepage Replication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate the 4-section homepage from my-blog-master into the Firefly blog, including HomeHero, HomeTicker, HomeDataLayer, and HomePortfolioShutterLayer.

**Architecture:** Replace the current HomePortal homepage with 4 new sections. Copy all required components, utilities, CSS, and assets. Install @vfx-js/core for the hatch shader effect. Hide sidebar widgets on the homepage.

**Tech Stack:** Astro, Svelte 5, GSAP + ScrollTrigger, @vfx-js/core, Tailwind CSS v4

---

### Task 1: Install dependencies and copy assets

**Files:**
- Modify: `package.json`
- Create: `public/assets/images/home/` (9 images)
- Create: `public/assets/images/home-truncated/` (12 images)
- Create: `public/assets/images/loading/feibi-loading.webp`

- [ ] Install @vfx-js/core dependency
- [ ] Copy all image assets from target project
- [ ] Verify assets are in place

### Task 2: Create config files

**Files:**
- Create: `src/config/homePortfolioShutterConfig.ts`
- Create: `src/config/skillsConfig.ts`
- Modify: `src/config/index.ts` (add exports)

### Task 3: Create utility files

**Files:**
- Create: `src/utils/hatch-effect.ts`
- Create: `src/utils/home-data-layer.js`
- Create: `src/utils/home-portfolio-shutter.js`
- Create: `src/utils/logo-loop.js`
- Create: `src/utils/page-loader-controller.js`

### Task 4: Create feature components

**Files:**
- Create: `src/components/features/DataMetricCard.astro`
- Create: `src/components/features/LogoLoop.svelte`
- Create: `src/components/features/PageLoader.astro`

### Task 5: Create homepage section components

**Files:**
- Create: `src/components/layout/HomeHero.astro`
- Create: `src/components/layout/HomeTicker.astro`
- Create: `src/components/layout/HomeDataLayer.astro`
- Create: `src/components/layout/HomePortfolioShutterLayer.astro`

### Task 6: Create CSS files

**Files:**
- Create: `src/styles/components/home-hero.css`
- Create: `src/styles/components/home-ticker.css`
- Create: `src/styles/components/home-data-layer.css`
- Create: `src/styles/components/home-portfolio-shutter.css`
- Create: `src/styles/components/page-loader.css`
- Modify: `src/styles/main.css` (add imports)

### Task 7: Replace homepage and hide sidebars

**Files:**
- Modify: `src/pages/[...page].astro` (replace HomePortal with new sections)
- Modify: `src/layouts/Layout.astro` (add PageLoader)
- Modify: `src/layouts/MainGridLayout.astro` (hide sidebars on homepage)

### Task 8: Build and verify

- [ ] Run `pnpm build`
- [ ] Fix any build errors
- [ ] Verify all 4 sections render correctly
