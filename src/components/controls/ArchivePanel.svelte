<script lang="ts">
import { onMount, tick } from "svelte";
import I18nKey from "@/i18n/i18nKey";
import { i18n } from "@/i18n/translation";
import { getPostUrlBySlug } from "@/utils/url-utils";

interface Post {
	id: string;
	type?: string;
	data: {
		title: string;
		tags: string[];
		category?: string | null;
		published: Date;
	};
}
interface MonthGroup {
	month: number;
	posts: Post[];
}
interface YearGroup {
	year: number;
	months: MonthGroup[];
	totalCount: number;
}
interface ActiveFilter {
	labelKey: I18nKey;
	values: string[];
}

export let tags: string[] = [];
export let categories: string[] = [];
export let sortedPosts: Post[] = [];
export let extConfig: { gistId: string; fileName: string } | null = null;

const typeLabels: Record<string, string> = {
	post: "文章",
	moment: "说说",
	bangumi: "记录",
	life: "生活",
};
function getTypeLabel(t: string | undefined): string {
	return t ? typeLabels[t] || t : "";
}

let yearGroups: YearGroup[] = [];
let activeFilters: ActiveFilter[] = [];
let primaryFilter: ActiveFilter | null = null;
let secondaryFilters: ActiveFilter[] = [];
let filteredPostCount = 0;
let categoryColors = new Map<string, string>();
let hoveredPostId: string | null = null;
let highlightedYear: number | null = null;
let highlightedMonth: string | null = null;

interface HighlightSeg {
	x: number;
	top: number;
	height: number;
}
interface HighlightHLine {
	x: number;
	y: number;
	width: number;
}
let highlightSegs: HighlightSeg[] = [];
let highlightHLines: HighlightHLine[] = [];

let panelEl: HTMLElement;
let yearBlockRefs = new Map<number, HTMLElement>();
let monthBlockRefs = new Map<string, HTMLElement>();
let postRowRefs = new Map<string, HTMLElement>();

function registerYearBlock(node: HTMLElement, year: number) {
	yearBlockRefs.set(year, node);
	return {
		destroy() {
			yearBlockRefs.delete(year);
		},
	};
}
function registerMonthBlock(
	node: HTMLElement,
	key: { year: number; month: number },
) {
	monthBlockRefs.set(`${key.year}-${key.month}`, node);
	return {
		destroy() {
			monthBlockRefs.delete(`${key.year}-${key.month}`);
		},
	};
}
function registerPostRow(node: HTMLElement, postId: string) {
	postRowRefs.set(postId, node);
	return {
		destroy() {
			postRowRefs.delete(postId);
		},
	};
}

const palette = [
	"text-amber-400",
	"text-rose-400",
	"text-emerald-400",
	"text-blue-400",
	"text-purple-400",
	"text-pink-400",
	"text-teal-400",
	"text-orange-400",
	"text-cyan-400",
	"text-indigo-400",
	"text-fuchsia-400",
	"text-lime-400",
	"text-red-400",
	"text-violet-400",
];

function formatDate(d: Date): string {
	return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function formatMonth(m: number): string {
	return `${m}${i18n(I18nKey.month)}`;
}
function getCatColor(name: string): string {
	return categoryColors.get(name) || "text-[var(--meta-divider)]";
}
function normCategory(name: string | null | undefined): string {
	return (name || "").trim();
}

function initCategoryColors(ps: Post[]) {
	const set = new Set<string>();
	for (const p of ps)
		set.add(normCategory(p.data.category) || i18n(I18nKey.uncategorized));
	const sorted = Array.from(set).sort((a, b) => a.localeCompare(b, "zh-CN"));
	for (let i = 0; i < sorted.length; i++)
		categoryColors.set(sorted[i], palette[i % palette.length]);
}

function groupByYearMonth(ps: Post[]): YearGroup[] {
	const ym = new Map<number, Map<number, Post[]>>();
	for (const p of ps) {
		const y = p.data.published.getFullYear(),
			mo = p.data.published.getMonth() + 1;
		if (!ym.has(y)) ym.set(y, new Map());
		const mm = ym.get(y)!;
		if (!mm.has(mo)) mm.set(mo, []);
		mm.get(mo)!.push(p);
	}
	return Array.from(ym.keys())
		.sort((a, b) => b - a)
		.map((year) => {
			const mm = ym.get(year)!;
			const months = Array.from(mm.keys())
				.sort((a, b) => b - a)
				.map((month) => ({ month, posts: mm.get(month)! }));
			return {
				year,
				months,
				totalCount: months.reduce((s, m) => s + m.posts.length, 0),
			};
		});
}

function getItemUrl(post: Post): string {
	if (
		post.type === "moment" &&
		typeof post.id === "string" &&
		post.id.startsWith("ext-")
	) {
		return "/moments/";
	}
	if (post.type && post.type !== "post") {
		// @ts-expect-error - data.link exists on ArchiveItem
		return (post as any).data?.link || getPostUrlBySlug(post.id);
	}
	return getPostUrlBySlug(post.id);
}
function formatFilterValues(f: ActiveFilter): string {
	return f.labelKey === I18nKey.tags
		? f.values.map((v) => `#${v}`).join(" / ")
		: f.values.join(" / ");
}
function resolvePrimary(f: ActiveFilter[]): ActiveFilter | null {
	return f.find((f) => f.labelKey === I18nKey.tags) ?? f[0] ?? null;
}
function formatFilterSummary(fs: ActiveFilter[]): string {
	return fs
		.map((f) => `${i18n(f.labelKey)}: ${formatFilterValues(f)}`)
		.join("  ·  ");
}

async function computeHighlight(postId: string) {
	await tick();
	if (!panelEl) {
		highlightSegs = [];
		highlightHLines = [];
		return;
	}
	let ty: number | null = null,
		tm: number | null = null;
	for (const yg of yearGroups)
		for (const mg of yg.months)
			if (mg.posts.some((p) => p.id === postId)) {
				ty = yg.year;
				tm = mg.month;
				break;
			}
	if (ty === null || tm === null) {
		highlightSegs = [];
		highlightHLines = [];
		highlightedYear = null;
		highlightedMonth = null;
		return;
	}
	highlightedYear = ty;
	highlightedMonth = `${ty}-${tm}`;

	const pr = panelEl.getBoundingClientRect();
	const tw =
		Number.parseFloat(getComputedStyle(panelEl).getPropertyValue("--tw")) * 16;
	const yb = yearBlockRefs.get(ty),
		mb = monthBlockRefs.get(`${ty}-${tm}`),
		prow = postRowRefs.get(postId);
	if (!yb || !mb || !prow) {
		highlightSegs = [];
		highlightHLines = [];
		return;
	}

	const yr = yb.getBoundingClientRect(),
		mr = mb.getBoundingClientRect(),
		por = prow.getBoundingClientRect();
	const ylx = yr.left - pr.left + tw / 2,
		mlx = mr.left - pr.left + tw / 2,
		plx = por.left - pr.left + tw / 2;
	const yncy = yr.top - pr.top + tw / 2,
		mncy = mr.top - pr.top + tw / 2,
		pncy = por.top - pr.top + por.height / 2;

	highlightSegs = [
		{ x: ylx, top: yncy, height: mncy - yncy },
		{ x: mlx, top: mncy, height: pncy - mncy },
	];
	highlightHLines = [
		{ x: ylx, y: mncy, width: mlx - ylx },
		{ x: mlx, y: pncy, width: plx - mlx },
	];
}

async function onPostEnter(id: string) {
	hoveredPostId = id;
	await computeHighlight(id);
}
function onPostLeave() {
	hoveredPostId = null;
	highlightedYear = null;
	highlightedMonth = null;
	highlightSegs = [];
	highlightHLines = [];
}

function applyFilters(allPosts: Post[]) {
	const params = new URLSearchParams(window.location.search);
	tags = params.has("tag") ? params.getAll("tag") : [];
	categories = params.has("category") ? params.getAll("category") : [];
	const uncategorized = params.get("uncategorized");
	let filtered = allPosts;
	const cf: ActiveFilter[] = [];
	if (categories.length > 0)
		cf.push({ labelKey: I18nKey.categories, values: categories });
	if (uncategorized)
		cf.push({
			labelKey: I18nKey.categories,
			values: [i18n(I18nKey.uncategorized)],
		});
	if (tags.length > 0) cf.push({ labelKey: I18nKey.tags, values: tags });
	activeFilters = cf;
	primaryFilter = resolvePrimary(cf);
	secondaryFilters = primaryFilter ? cf.filter((f) => f !== primaryFilter) : [];
	if (tags.length > 0)
		filtered = filtered.filter(
			(p) =>
				Array.isArray(p.data.tags) && p.data.tags.some((t) => tags.includes(t)),
		);
	if (categories.length > 0)
		filtered = filtered.filter(
			(p) => p.data.category && categories.includes(p.data.category),
		);
	if (uncategorized) filtered = filtered.filter((p) => !p.data.category);
	filtered = filtered
		.slice()
		.sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
	filteredPostCount = filtered.length;
	initCategoryColors(filtered);
	yearGroups = groupByYearMonth(filtered);
}

onMount(async () => {
	let allPosts = [...sortedPosts];

	// 加载外部说说
	if (extConfig && extConfig.gistId) {
		try {
			const token = localStorage.getItem("gh_moments_token") || "";
			const headers: Record<string, string> = {
				Accept: "application/vnd.github+json",
			};
			if (token) headers["Authorization"] = "Bearer " + token;
			const res = await fetch(
				`https://api.github.com/gists/${extConfig.gistId}`,
				{ headers },
			);
			if (res.ok) {
				const gist = await res.json();
				const file = gist.files[extConfig.fileName];
				if (file) {
					const moments = JSON.parse(file.content || "[]");
					for (const m of moments) {
						allPosts.push({
							id: m.id || `ext-${Date.now()}`,
							type: "moment",
							data: {
								title: (m.content || "").slice(0, 50) || "说说",
								tags: m.tags || [],
								category: "说说",
								published: new Date(m.published),
							},
						} as any);
					}
				}
			}
		} catch (e) {
			/* ignore */
		}
	}

	applyFilters(allPosts);
});
</script>

<div class="archive-panel card-base px-3 py-6 md:px-10 md:py-8" bind:this={panelEl}>
  {#if primaryFilter}
    <div class="mb-6">
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div class="min-w-0 text-sm text-75">
          <span class="text-50">{i18n(primaryFilter.labelKey)}</span>
          <span class="mx-2 text-30">/</span>
          <span class="font-semibold text-(--primary)">{formatFilterValues(primaryFilter)}</span>
          {#if secondaryFilters.length > 0}
            <span class="ml-2 text-50">· {formatFilterSummary(secondaryFilters)}</span>
          {/if}
        </div>
        <div class="shrink-0 text-xs text-50">
          {filteredPostCount} {i18n(filteredPostCount === 1 ? I18nKey.postCount : I18nKey.postsCount)}
          <span class="mx-1.5 text-30">·</span>
          {yearGroups.length} {i18n(I18nKey.year)}
        </div>
      </div>
    </div>
  {/if}

  {#each yearGroups as yg (yg.year)}
    <div class="ap-year-block" use:registerYearBlock={yg.year}>
      <div class="ap-year-header">
        <div class="ap-col"><div class="ap-node ap-year-node" class:highlighted={highlightedYear === yg.year}></div></div>
        <div class="ap-year-label">
          <h2 class="ap-h1">{yg.year}{i18n(I18nKey.year)}</h2>
          <span class="ap-count">共 {yg.totalCount} {i18n(yg.totalCount === 1 ? I18nKey.postCount : I18nKey.postsCount)}</span>
        </div>
      </div>
      <div class="ap-months-area">
        {#each yg.months as mg (mg.month)}
          <div class="ap-month-block" use:registerMonthBlock={{ year: yg.year, month: mg.month }}>
            <div class="ap-month-header">
              <div class="ap-col"><div class="ap-hline ap-month-hline"></div><div class="ap-node ap-month-node" class:highlighted={highlightedMonth === `${yg.year}-${mg.month}`}></div></div>
              <div class="ap-month-label">
                <h3 class="ap-h2">{formatMonth(mg.month)}</h3>
                <span class="ap-count">{mg.posts.length} {i18n(mg.posts.length === 1 ? I18nKey.postCount : I18nKey.postsCount)}</span>
              </div>
            </div>
            <div class="ap-posts-area">
              <ul class="ap-post-list">
                {#each mg.posts as post, idx (post.id)}
                  <li class="ap-post-row" class:last={idx === mg.posts.length - 1} use:registerPostRow={post.id}>
                    <div class="ap-col"><div class="ap-hline ap-post-hline"></div><div class="ap-node ap-post-node" class:hovered={hoveredPostId === post.id}></div></div>
                    <a href={getItemUrl(post)} aria-label={post.data.title} class="ap-post-link group btn-plain"
                       on:mouseenter={() => onPostEnter(post.id)} on:mouseleave={onPostLeave}>
                      <span class="ap-date">{formatDate(post.data.published)}</span>
                      {#if post.type && post.type !== "post"}
                        <span class="ap-type-badge">{getTypeLabel(post.type)}</span>
                      {:else}
                        <span class="ap-type-badge">文章</span>
                      {/if}
                      <span class="ap-title group-hover:text-(--primary)">{post.data.title}</span>
                    </a>
                  </li>
                {/each}
              </ul>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/each}

  {#if highlightSegs.length > 0 || highlightHLines.length > 0}
    <div class="ap-highlight-layer" aria-hidden="true">
      {#each highlightSegs as seg}<div class="ap-hl-vline" style="left:{seg.x}px;top:{seg.top}px;height:{seg.height}px"></div>{/each}
      {#each highlightHLines as hl}<div class="ap-hl-hline" style="left:{hl.x}px;top:{hl.y}px;width:{hl.width}px"></div>{/each}
    </div>
  {/if}
</div>

<style>
  .archive-panel { --tw: 2rem; --lc: var(--line-color, oklch(0.82 0 0)); --lh: oklch(0.15 0 0); --nc: var(--line-color, oklch(0.82 0 0)); --nh: oklch(0.15 0 0); --lw: 2.5px; position: relative; }
  .ap-year-block { position: relative; margin-bottom: 2.5rem; }
  .ap-year-block::before { content: ""; position: absolute; left: calc(var(--tw) / 2); top: calc(var(--tw) / 2); bottom: 1rem; width: 0; border-left: var(--lw) dashed var(--lc); z-index: 0; }
  .ap-months-area { padding-left: var(--tw); }
  .ap-month-block { position: relative; margin-bottom: 0.5rem; }
  .ap-month-block::before { content: ""; position: absolute; left: calc(var(--tw) / 2); top: calc(var(--tw) / 2); bottom: 1rem; width: 0; border-left: var(--lw) dashed var(--lc); z-index: 0; }
  .ap-posts-area { padding-left: var(--tw); }
  .ap-post-list { list-style: none; margin: 0; padding: 0; }
  .ap-post-row { position: relative; display: flex; align-items: center; min-height: 2.25rem; transition: transform 0.2s cubic-bezier(0.4,0,0.2,1); }
  .ap-post-row:hover { transform: translateX(0.375rem); }
  .ap-col { position: relative; width: var(--tw); flex-shrink: 0; align-self: stretch; }
  .ap-node { position: absolute; left: 50%; transform: translateX(-50%); border-radius: 50%; z-index: 2; transition: background-color 0.15s ease, border-color 0.15s ease, transform 0.15s ease; }
  .ap-year-node { top: calc(50% - 0.375rem); width: 0.75rem; height: 0.75rem; border: 2px solid var(--nc); background: var(--page-bg, white); }
  .ap-year-node.highlighted { background: var(--nh); border-color: var(--nh); }
  .ap-month-node { top: calc(50% - 0.25rem); width: 0.5rem; height: 0.5rem; background: var(--nc); }
  .ap-month-node.highlighted { background: var(--nh); }
  .ap-post-node { top: calc(50% - 0.2rem); width: 0.4rem; height: 0.4rem; background: var(--nc); }
  .ap-post-node.hovered { background: var(--nh); transform: translateX(-50%) scale(1.6); }
  .ap-hline { position: absolute; height: 0; border-top: var(--lw) dashed var(--lc); z-index: 1; }
  .ap-month-hline { top: 50%; left: calc(-1 * var(--tw) / 2); width: var(--tw); }
  .ap-post-hline { top: 50%; left: calc(-1 * var(--tw) / 2); width: var(--tw); }
  .ap-highlight-layer { position: absolute; inset: 0; pointer-events: none; z-index: 10; }
  .ap-hl-vline { position: absolute; width: 0; border-left: 3px solid var(--lh); transform: translateX(-50%); }
  .ap-hl-hline { position: absolute; height: 0; border-top: 3px solid var(--lh); }
  .ap-year-header, .ap-month-header { display: flex; align-items: center; min-height: var(--tw); }
  .ap-year-label, .ap-month-label { display: flex; align-items: baseline; gap: 0.6rem; padding-left: 0.5rem; flex: 1; }
  .ap-h1 { font-size: 1.375rem; font-weight: 700; color: var(--deep-text); margin: 0; }
  .ap-h2 { font-size: 1.05rem; font-weight: 600; color: var(--deep-text); margin: 0; }
  .ap-count { font-size: 0.75rem; color: var(--content-meta); }
  .ap-post-link { display: flex; align-items: center; gap: 0.6rem; flex: 1; min-height: 2.25rem; padding: 0.2rem 0.5rem 0.2rem 0; margin-left: 0; border-radius: 0.5rem; text-decoration: none; overflow: hidden; }
  .ap-date { font-size: 0.875rem; color: var(--content-meta); font-variant-numeric: tabular-nums; white-space: nowrap; flex-shrink: 0; width: 2.8rem; text-align: right; }
  .ap-category { font-size: 0.8rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; min-width: 3rem; }
  .ap-type-badge { font-size: 0.75rem; font-weight: 600; white-space: nowrap; flex-shrink: 0; min-width: 2.5rem; padding: 0.1rem 0.4rem; border: 1px solid var(--line-divider); border-radius: 0.25rem; color: var(--content-meta); }
  .ap-title { font-size: 0.9rem; font-weight: 500; color: var(--deep-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; transition: color 0.15s ease; display: inline-block; }
  :global(.dark) .archive-panel { --lh: oklch(0.9 0 0); --nh: oklch(0.9 0 0); }
  @media (max-width: 768px) {
    .archive-panel { --tw: 1.5rem; }
    .ap-date { width: 2.4rem; font-size: 0.8rem; }
    .ap-category { min-width: 2.5rem; font-size: 0.75rem; }
    .ap-title { font-size: 0.82rem; }
    .ap-year-block::before, .ap-month-block::before { content: none; }
    .ap-hline, .ap-node, .ap-col, .ap-highlight-layer { display: none; }
    .ap-months-area, .ap-posts-area { padding-left: 0.5rem; }
  }
</style>
