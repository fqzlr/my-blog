<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import {
	showToast,
	genId,
	deepClone,
	ensureIconify,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";


interface BangumiItem {
	id: string;
	title: string;
	name_cn: string;
	category: string; // anime/book/game/music
	status: number; // 1=想看 2=看过 3=在看 4=搁置 5=抛弃
	score: number;
	image: string;
	tags: string[];
	comment: string;
	updated_at: string;
	_draft?: boolean;
	_local?: boolean;
}

let {
	defaultCategory = "all",
	skipDomCollect = false,
	customPageName = "番剧",
	configPath = "public/bangumi.json",
	configExportName = "bangumiConfig",
	initialItems = [],
}: {
	defaultCategory?: string;
	skipDomCollect?: boolean;
	customPageName?: string;
	configPath?: string;
	configExportName?: string;
	initialItems?: BangumiItem[];
} = $props();

let editMode = $state(false);
let saving = $state(false);
let items = $state<BangumiItem[]>([]);
let originalItems = $state<BangumiItem[]>([]);
let editingIndex = $state(-1);
let activeTab = $state(defaultCategory);
let fileSha = $state<string | null>(null);

const currentPageKey = customPageName === "书架"
	? "books"
	: customPageName === "影视游戏"
		? "movies-games"
		: "bangumi";

// TS 配置文件内容生成与解析
function generateTsContent(data: BangumiItem[]): string {
	const json = JSON.stringify(data, null, 2);
	return `// 此文件由编辑器自动生成，请勿手动修改\nexport const ${configExportName} = ${json} as const;\n`;
}

function parseTsContent(content: string): BangumiItem[] | null {
	try {
		// 匹配 export const xxx = [...]; 或 export const xxx = [...] as const;
		const match = content.match(/export\s+const\s+\w+\s*=\s*(\[[\s\S]*\])\s*(?:as\s+const)?;?\s*$/m);
		if (match) return JSON.parse(match[1]);
		// 回退：尝试直接解析为 JSON
		return JSON.parse(content);
	} catch {
		return null;
	}
}

const isJsonFile = configPath.endsWith(".json");

const drafts = setupRepoDrafts({
	pageKey: currentPageKey,
	pageName: customPageName,
	getContent: () => isJsonFile ? JSON.stringify(items, null, 2) : generateTsContent(items),
	setContent: (v) => {
		if (isJsonFile) {
			items = JSON.parse(v);
		} else {
			const parsed = parseTsContent(v);
			if (parsed) items = parsed;
		}
	},
	getPath: () => configPath,
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => isJsonFile ? JSON.stringify(originalItems, null, 2) : generateTsContent(originalItems),
	setOriginalContent: (v) => {
		if (isJsonFile) {
			originalItems = JSON.parse(v);
		} else {
			const parsed = parseTsContent(v);
			if (parsed) originalItems = parsed;
		}
	},
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update ${customPageName} config` : `chore: create ${customPageName} config`,
	onSubmitted: () => {
		waitForDeployAndReload();
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

const categoryMap: Record<string, string> = {
	anime: "动漫",
	book: "书籍",
	game: "游戏",
	music: "音乐",
	real: "影视",
};

// 根据 customPageName 动态生成分类列表
const categoryList = (() => {
	if (customPageName === "影视游戏") {
		// 影视游戏页面：使用 subcategory 细分
		return [
			{ id: "movie", name: "电影" },
			{ id: "tv", name: "剧集" },
			{ id: "anime", name: "动漫" },
			{ id: "documentary", name: "纪录片" },
			{ id: "game", name: "游戏" },
		];
	} else if (customPageName === "书架") {
		// 书架页面：只显示 book
		return [{ id: "book", name: "书籍" }];
	} else {
		// 默认（番剧页面）：显示所有分类
		return [
			{ id: "anime", name: "动漫" },
			{ id: "book", name: "书籍" },
			{ id: "game", name: "游戏" },
			{ id: "music", name: "音乐" },
			{ id: "real", name: "影视" },
		];
	}
})();

// 获取条目的 subcategory（仅影视游戏页面使用）
// 与前端 SSR 渲染逻辑完全一致
function getItemSubcategory(item: BangumiItem): string {
	// 优先使用 _subcategory 字段（如果有）
	if ((item as any)._subcategory) return (item as any)._subcategory;

	// game 分类保持为 game
	if (item.category === "game") return "game";

	// real 分类根据 tags 推断 subcategory
	if (item.category !== "real") return item.category;

	const tags = item.tags || [];
	if (tags.some((t) => t.includes("纪录"))) return "documentary";
	if (tags.some((t) => t.includes("动漫") || t.includes("动画")))
		return "anime";
	if (tags.some((t) => t.includes("电视剧") || t.includes("剧集"))) return "tv";
	return "movie"; // 默认为电影
}

const tabs = [{ id: "all", name: "全部" }, ...categoryList];

// 影视游戏页面支持第二排状态筛选
const statusTabs =
	customPageName === "影视游戏"
		? [
				{ id: "all", name: "全部" },
				{ id: "2", name: "看过" },
				{ id: "3", name: "在看" },
				{ id: "1", name: "想看" },
				{ id: "4", name: "搁置" },
				{ id: "5", name: "抛弃" },
			]
		: null;

let activeStatusTab = $state("all");

// 根据分类和状态双重筛选
let filteredItems = $derived.by(() => {
	let result = items;

	// 影视游戏页面：按 subcategory 筛选
	if (customPageName === "影视游戏" && activeTab !== "all") {
		result = result.filter((i) => getItemSubcategory(i) === activeTab);
	} else if (activeTab !== "all") {
		// 其他页面：按 category 筛选
		result = result.filter((i) => i.category === activeTab);
	}

	// 状态筛选
	if (activeStatusTab !== "all") {
		result = result.filter((i) => i.status === Number(activeStatusTab));
	}

	return result;
});

const statusMap: Record<number, { name: string; color: string }> = {
	1: { name: "想看", color: "#3b82f6" },
	2: { name: "看过", color: "#10b981" },
	3: { name: "在看", color: "#f59e0b" },
	4: { name: "搁置", color: "#6b7280" },
	5: { name: "抛弃", color: "#ef4444" },
};

const statusStrToNum: Record<string, number> = {
	wish: 1,
	collect: 2,
	doing: 3,
	on_hold: 4,
	dropped: 5,
};

onMount(() => {
	ensureIconify();
	if (initialItems.length > 0) {
		// 使用页面直接传入的初始数据
		items = initialItems.map((item) => ({ ...item, _local: true }));
		originalItems = deepClone(items);
	} else if (!skipDomCollect) {
		collectFromDOM();
	}
	drafts.restoreFromDrafts();
});

// 从 DOM 收集 SSR 渲染的本地番剧条目
function collectFromDOM() {
	const collected: BangumiItem[] = [];
	const sections = document.querySelectorAll("[data-section]");
	sections.forEach((sectionEl) => {
		const section = sectionEl as HTMLElement;
		const category = section.dataset.section;
		if (!category || !categoryMap[category]) return;
		const grid = section.querySelector(".bangumi-grid");
		if (!grid) return;
		grid.querySelectorAll(".bangumi-item").forEach((itemEl, idx) => {
			const card = itemEl as HTMLElement;
			const link = card.querySelector<HTMLAnchorElement>(".bm-card");
			const img = card.querySelector<HTMLImageElement>(".bm-img");
			const titleEl = card.querySelector(".bm-title");
			const scoreEl = card.querySelector(".bm-score");
			const commentEl = card.querySelector(".bm-comment");
			const tagEls = card.querySelectorAll(".bm-tag");
			const statusStr = card.dataset.itemStatus || "wish";

			const title = titleEl?.textContent?.trim() || "";
			if (!title) return;

			let score = 0;
			if (scoreEl) {
				const scoreText =
					scoreEl.textContent?.trim().replace(/[^0-9.]/g, "") || "0";
				score = parseFloat(scoreText) || 0;
			}

			const tags: string[] = [];
			tagEls.forEach((t) => {
				const text = t.textContent?.trim();
				if (text) tags.push(text);
			});

			const href = link?.getAttribute("href") || "";
			// 用 href + title 生成唯一 ID，避免同链接的多个条目 ID 重复
			const rawId = href ? `${href}#${title}` : `${category}-${idx}`;
			const id = `local-${btoa(unescape(encodeURIComponent(rawId)))
				.replace(/[^a-zA-Z0-9]/g, "")
				.slice(0, 20)}`;

			collected.push({
				id,
				title,
				name_cn: title,
				category,
				status: statusStrToNum[statusStr] || 1,
				score,
				image: img?.src || "",
				tags,
				comment: commentEl?.textContent?.trim() || "",
				updated_at: new Date().toISOString(),
				_local: true,
			});
		});
	});
	items = collected;
	originalItems = deepClone(collected);
}



function sortItems() {
	items = [...items].sort((a, b) => {
		const da = new Date(a.updated_at).getTime();
		const db = new Date(b.updated_at).getTime();
		return db - da;
	});
}

// 非编辑模式：将外部条目注入到 SSR section 中
function renderExternalItems() {
	if (skipDomCollect) return;
	for (const cat of Object.keys(categoryMap)) {
		const section = document.querySelector(
			`[data-section="${cat}"]`,
		) as HTMLElement;
		if (!section) continue;
		const grid = section.querySelector(".bangumi-grid");
		if (!grid) continue;
		// 清除旧的外部条目
		grid
			.querySelectorAll(".bangumi-item-external")
			.forEach((el) => el.remove());

		const catItems = items.filter((i) => i.category === cat && !i._local);
		for (const item of catItems) {
			const el = document.createElement("div");
			el.className = "bangumi-item bangumi-item-external";
			el.dataset.itemId = item.id;
			el.dataset.itemSection = cat;
			const statusInfo = statusMap[item.status] || statusMap[1];
			const scoreHtml = item.score
				? `<span class="bm-score"><svg class="bm-star" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>${item.score}</span>`
				: "";
			const tagsHtml =
				item.tags && item.tags.length > 0
					? `<div class="bm-tags">${item.tags.map((t) => `<span class="bm-tag">${escapeHtml(t)}</span>`).join("")}</div>`
					: "";
			const commentOverlay = item.comment
				? `<div class="bm-overlay"><p class="bm-comment">${escapeHtml(item.comment)}</p></div>`
				: "";
			const subjectType =
				cat === "anime"
					? "2"
					: cat === "book"
						? "1"
						: cat === "music"
							? "3"
							: "4";
			el.innerHTML = `
					<a class="bm-card" data-type="${subjectType}" href="javascript:void(0)">
						<div class="bm-cover">
							<img src="${item.image}" alt="${escapeHtml(item.title)}" class="bm-img" loading="lazy" onerror="this.style.opacity='0.3'" />
							<div class="bm-gradient"></div>
							<span class="bm-status" style="background:${statusInfo.color}cc">${statusInfo.name}</span>
							${scoreHtml}
							<div class="bm-info">
								<h3 class="bm-title">${escapeHtml(item.name_cn || item.title)}</h3>
								${tagsHtml}
							</div>
							${commentOverlay}
						</div>
					</a>
				`;
			grid.insertBefore(el, grid.firstChild);
		}
	}
}

function escapeHtml(text: string) {
	const div = document.createElement("div");
	div.textContent = text;
	return div.innerHTML;
}

// 进入/退出编辑模式
function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
		hideSSRContent();
		editingIndex = -1;
		activeTab = "all";
	} else {
		showSSRContent();
	}
}

function hideSSRContent() {
	// 隐藏 SSR 的 TabNav 和所有 section
	const tabsWrapper = document.querySelector(".bangumi-tabs-wrapper");
	if (tabsWrapper) (tabsWrapper as HTMLElement).style.display = "none";
	// 隐藏 .bangumi-section（movies-games 页面）
	document.querySelectorAll<HTMLElement>(".bangumi-section").forEach((s) => {
		s.style.display = "none";
	});
	// 隐藏带 data-section 属性的元素（books 页面等）
	document.querySelectorAll<HTMLElement>("[data-section]").forEach((s) => {
		// 排除编辑器内部的元素
		if (!s.closest(".edit-bangumi-wrapper")) {
			s.style.display = "none";
		}
	});
}

function showSSRContent() {
	const tabsWrapper = document.querySelector(".bangumi-tabs-wrapper");
	if (tabsWrapper) (tabsWrapper as HTMLElement).style.display = "";
	// 显示 .bangumi-section（movies-games 页面）
	document.querySelectorAll<HTMLElement>(".bangumi-section").forEach((s) => {
		s.style.display = "";
	});
	// 显示带 data-section 属性的元素（books 页面等）
	document.querySelectorAll<HTMLElement>("[data-section]").forEach((s) => {
		// 排除编辑器内部的元素
		if (!s.closest(".edit-bangumi-wrapper")) {
			s.style.display = "";
		}
	});
}

function handleCancel() {
	items = deepClone(originalItems);
	drafts.clearDrafts();
	editingIndex = -1;
	showSSRContent();
}

// 开始内联编辑
function startEdit(index: number) {
	editingIndex = index;
}

function finishEdit(index: number) {
	const item = items[index];
	if (!item.title.trim()) {
		showToast("标题不能为空", "warning");
		return;
	}
	items[index] = {
		...item,
		updated_at: new Date().toISOString(),
		_draft: false,
		_local: item._local,
	};
	items = [...items];
	sortItems();
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

// 取消单卡片编辑
function cancelItemEdit(index: number) {
	const item = items[index];
	if (item._draft && !item.title.trim()) {
		items = items.filter((_, i) => i !== index);
	} else {
		const orig = originalItems.find((o) => o.id === item.id && !item._draft);
		if (orig) {
			items[index] = deepClone(orig);
			items = [...items];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const item = items[index];
	if (!confirm(`确定要删除「${item.name_cn || item.title || "该条目"}」吗？`))
		return;
	items = items.filter((_, i) => i !== index);
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

// 移动卡片（在 filteredItems 的可见顺序中上移/下移）
function moveUp(index: number) {
	const filtered = filteredItems;
	if (index <= 0) return;
	const item = filtered[index];
	const prevItem = filtered[index - 1];
	const globalIdx = items.indexOf(item);
	const prevGlobalIdx = items.indexOf(prevItem);
	if (globalIdx < 0 || prevGlobalIdx < 0) return;
	const arr = [...items];
	[arr[prevGlobalIdx], arr[globalIdx]] = [arr[globalIdx], arr[prevGlobalIdx]];
	items = arr;
	if (editingIndex === globalIdx) editingIndex = prevGlobalIdx;
	else if (editingIndex === prevGlobalIdx) editingIndex = globalIdx;
}

function moveDown(index: number) {
	const filtered = filteredItems;
	if (index >= filtered.length - 1) return;
	const item = filtered[index];
	const nextItem = filtered[index + 1];
	const globalIdx = items.indexOf(item);
	const nextGlobalIdx = items.indexOf(nextItem);
	if (globalIdx < 0 || nextGlobalIdx < 0) return;
	const arr = [...items];
	[arr[globalIdx], arr[nextGlobalIdx]] = [arr[nextGlobalIdx], arr[globalIdx]];
	items = arr;
	if (editingIndex === globalIdx) editingIndex = nextGlobalIdx;
	else if (editingIndex === nextGlobalIdx) editingIndex = globalIdx;
}

function handleAdd() {
	const newItem: BangumiItem = {
		id: genId("bgm"),
		title: "",
		name_cn: "",
		category: "anime",
		status: 1,
		score: 0,
		image: "",
		tags: [],
		comment: "",
		updated_at: new Date().toISOString(),
		_draft: true,
		_local: false,
	};
	items = [...items, newItem];
	editingIndex = items.length - 1;
}

function handleSaveDraft() {
	const cleanData = items.map(({ _draft, _local, ...rest }) => ({
		...rest,
		id: rest.id || genId("bgm"),
	}));
	items = cleanData;
	drafts.saveToDrafts();
}

/** 等待 Vercel 新部署上线后刷新页面 */
function waitForDeployAndReload() {
	const startTime = Date.now();
	const waitSeconds = 90;
	const tickInterval = 10;
	function tick() {
		const elapsed = Math.round((Date.now() - startTime) / 1000);
		if (elapsed >= waitSeconds) {
			showToast("部署完成，正在刷新...", "success");
			window.location.reload();
		} else {
			showToast(
				`等待 Vercel 部署中... (${elapsed}s / ${waitSeconds}s)`,
				"info",
			);
			setTimeout(tick, tickInterval * 1000);
		}
	}
	setTimeout(tick, 15 * 1000);
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	saving = true;
	try {
		items = items.map(({ _draft, _local, ...rest }) => ({
			...rest,
			id: rest.id || genId("bgm"),
		}));

		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

// 更新编辑中的卡片字段
function updateField(index: number, field: keyof BangumiItem, value: any) {
	items[index] = { ...items[index], [field]: value };
	items = [...items];
}

function updateTags(index: number, value: string) {
	const tags = value
		.split(/[,，\s]+/)
		.map((t) => t.trim())
		.filter(Boolean);
	items[index] = { ...items[index], tags };
	items = [...items];
}

function switchTab(tabId: string) {
	activeTab = tabId;
	editingIndex = -1;
}

// 切换状态筛选标签（仅影视游戏页面）
function switchStatusTab(tabId: string) {
	activeStatusTab = tabId;
	editingIndex = -1;
}
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="bangumi-edit-toolbar">
	<EditToolbar
		pageKey={currentPageKey}
		pageName={customPageName}
		mountTo=".page-header-toolbar-slot"
		{saving}
		{hasChanges}
		on:modeChange={(e) => handleModeChange(e)}
		on:add={() => handleAdd()}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
		on:cancel={() => handleCancel()}
	/>
</div>

<!-- 编辑模式：Svelte 渲染的可编辑网格 -->
{#if editMode}
	<div class="edit-bangumi-wrapper">
		<!-- 分类 Tab -->
		<div class="edit-bangumi-tabs">
			{#each tabs as tab (tab.id)}
				<button
					class="edit-tab"
					class:active={activeTab === tab.id}
					onclick={() => switchTab(tab.id)}
				>
					{tab.name}
					<span class="edit-tab-count">{
						tab.id === "all" 
							? items.length 
							: customPageName === "影视游戏" 
								? items.filter((i) => getItemSubcategory(i) === tab.id).length 
								: items.filter((i) => i.category === tab.id).length
					}</span>
				</button>
			{/each}
		</div>

		<!-- 影视游戏页面：第二排状态筛选标签 -->
		{#if statusTabs}
			<div class="edit-bangumi-tabs edit-bangumi-status-tabs">
				{#each statusTabs as tab (tab.id)}
					<button
						class="edit-tab"
						class:active={activeStatusTab === tab.id}
						onclick={() => switchStatusTab(tab.id)}
					>
						{tab.name}
						<span class="edit-tab-count">
							{tab.id === "all" 
								? filteredItems.length 
								: filteredItems.filter((i) => i.status === Number(tab.id)).length}
						</span>
					</button>
				{/each}
			</div>
		{/if}

		<!-- 卡片网格 -->
		<div class="edit-bangumi-grid" id="edit-bangumi-grid">
			{#each filteredItems as item, fi (fi + "-" + item.id)}
				{@const originalIndex = items.indexOf(item)}
				<div
					class="edit-bangumi-card"
					class:edit-bangumi-card-draft={item._draft}
					class:edit-bangumi-card-editing={editingIndex === originalIndex}
				>
					<!-- 非编辑态：展示卡片 -->
					{#if editingIndex !== originalIndex}
						<div class="card-action-row">
							{#if fi > 0}
								<button class="action-btn action-move" onclick={() => moveUp(fi)} title="上移">
									<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
								</button>
							{/if}
							{#if fi < filteredItems.length - 1}
								<button class="action-btn action-move" onclick={() => moveDown(fi)} title="下移">
									<iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
								</button>
							{/if}
							<button class="action-btn action-edit" onclick={() => startEdit(originalIndex)} title="编辑">
								<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
							</button>
							<button class="action-btn action-delete" onclick={() => deleteItem(originalIndex)} title="删除">
								<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
							</button>
						</div>

						<div class="card-poster">
							{#if item.image}
								<img src={item.image} alt={item.title} class="card-poster-img" loading="lazy" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
							{:else}
								<div class="card-poster-placeholder">
									<iconify-icon icon="material-symbols:image-not-supported-outline"></iconify-icon>
								</div>
							{/if}
							<div class="card-poster-gradient"></div>
							<span
								class="card-status-badge"
								style={`background:${statusMap[item.status]?.color || "#6b7280"}`}
							>
								{statusMap[item.status]?.name || "未知"}
							</span>
							{#if item.score > 0}
								<span class="card-score-badge">
									<svg class="card-star" viewBox="0 0 20 20" fill="currentColor"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
									{item.score}
								</span>
							{/if}
							<div class="card-poster-info">
								<h3 class="card-poster-title" title={item.name_cn || item.title}>{item.name_cn || item.title || "（未命名）"}</h3>
								<span class="card-cat-label">{categoryMap[item.category] || item.category}</span>
							</div>
						</div>
						<div class="card-meta">
							<h3 class="card-meta-title">{item.name_cn || item.title || "（未命名）"}</h3>
							{#if item.comment}
								<p class="card-meta-comment">{item.comment}</p>
							{/if}
							{#if item.tags && item.tags.length > 0}
								<div class="card-meta-tags">
									{#each item.tags.slice(0, 3) as tag (tag)}
										<span class="card-meta-tag">{tag}</span>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<!-- 编辑态：内联表单 -->
						<div class="card-edit-form">
							<div class="edit-form-header">
								<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
								<span>编辑条目</span>
								{#if item._draft}
									<span class="draft-badge">新增</span>
								{/if}
							</div>

							<div class="form-preview">
								{#if item.image}
									<img src={item.image} alt="" class="form-preview-img" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
								{:else}
									<div class="form-preview-placeholder">
										<iconify-icon icon="material-symbols:image-outline"></iconify-icon>
									</div>
								{/if}
							</div>

							<div class="form-group">
								<label>标题（原名）</label>
								<input
									type="text"
									value={item.title}
									oninput={(e) => updateField(originalIndex, "title", (e.target as HTMLInputElement).value)}
									placeholder="日文/英文标题"
									class="form-input"
								/>
							</div>
							<div class="form-group">
								<label>中文标题</label>
								<input
									type="text"
									value={item.name_cn}
									oninput={(e) => updateField(originalIndex, "name_cn", (e.target as HTMLInputElement).value)}
									placeholder="中文译名"
									class="form-input"
								/>
							</div>
							<div class="form-row">
								<div class="form-group form-group-half">
									<label>分类</label>
									<select
										value={item.category}
										onchange={(e) => updateField(originalIndex, "category", (e.target as HTMLSelectElement).value)}
										class="form-select"
									>
										{#each categoryList as cat (cat.id)}
											<option value={cat.id}>{cat.name}</option>
										{/each}
									</select>
								</div>
								<div class="form-group form-group-half">
									<label>状态</label>
									<select
										value={item.status}
										onchange={(e) => updateField(originalIndex, "status", parseInt((e.target as HTMLSelectElement).value))}
										class="form-select"
									>
										{#each Object.entries(statusMap) as [num, info] (num)}
											<option value={num}>{info.name}</option>
										{/each}
									</select>
								</div>
							</div>
							<div class="form-row">
								<div class="form-group form-group-half">
									<label>评分 (0-10)</label>
									<input
										type="number"
										min="0"
										max="10"
										step="0.5"
										value={item.score}
										oninput={(e) => updateField(originalIndex, "score", parseFloat((e.target as HTMLInputElement).value) || 0)}
										class="form-input"
									/>
								</div>
							</div>
							<div class="form-group">
								<label>封面图片 URL</label>
								<input
									type="text"
									value={item.image}
									oninput={(e) => updateField(originalIndex, "image", (e.target as HTMLInputElement).value)}
									placeholder="https://..."
									class="form-input"
								/>
							</div>
							<div class="form-group">
								<label>标签（逗号分隔）</label>
								<input
									type="text"
									value={item.tags.join(", ")}
									oninput={(e) => updateTags(originalIndex, (e.target as HTMLInputElement).value)}
									placeholder="标签1, 标签2"
									class="form-input"
								/>
							</div>
							<div class="form-group">
								<label>评论</label>
								<textarea
									value={item.comment}
									oninput={(e) => updateField(originalIndex, "comment", (e.target as HTMLTextAreaElement).value)}
									placeholder="简短评论..."
									class="form-textarea"
									rows={3}
								></textarea>
							</div>
							<div class="form-actions">
								<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(originalIndex)}>取消</button>
								<button class="form-btn form-btn-save" onclick={() => finishEdit(originalIndex)}>完成</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			{#if filteredItems.length === 0}
				<div class="empty-state">
					<iconify-icon icon="material-symbols:collections-bookmark-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
					<p>暂无条目，点击"添加"开始添加</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.bangumi-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.loading-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		color: var(--content-meta, #737373);
		font-size: 14px;
	}

	/* ===== 编辑模式容器 ===== */
	.edit-bangumi-wrapper {
		margin-top: 8px;
	}

	/* 分类 Tab */
	.edit-bangumi-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--btn-regular-bg, #f3f4f6);
		border-radius: 12px;
		border: 1px solid var(--line-divider, rgba(0,0,0,0.08));
		margin-bottom: 16px;
		overflow-x: auto;
		scrollbar-width: none;
	}
	.edit-bangumi-tabs::-webkit-scrollbar {
		display: none;
	}
	/* 第二排状态筛选标签 */
	.edit-bangumi-status-tabs {
		margin-top: -8px;
		margin-bottom: 16px;
	}
	:global(.dark) .edit-bangumi-tabs {
		background: var(--card-bg, rgba(255,255,255,0.03));
		border-color: rgba(255,255,255,0.08);
	}
	.edit-tab {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 7px 16px;
		border-radius: 8px;
		border: none;
		background: transparent;
		color: var(--content-meta, #6b7280);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s;
	}
	.edit-tab:hover {
		color: var(--deep-text, #1f2937);
		background: var(--btn-card-bg-hover, rgba(0,0,0,0.04));
	}
	:global(.dark) .edit-tab:hover {
		color: var(--title-active, #f0f0f0);
		background: rgba(255,255,255,0.06);
	}
	.edit-tab.active {
		background: var(--card-bg, white);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		font-weight: 600;
		box-shadow: 0 1px 4px rgba(0,0,0,0.06);
	}
	:global(.dark) .edit-tab.active {
		background: rgba(255,255,255,0.06);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	.edit-tab-count {
		font-size: 10px;
		font-weight: 600;
		padding: 1px 6px;
		border-radius: 999px;
		background: var(--btn-regular-bg, rgba(0,0,0,0.05));
		color: var(--content-meta, #9ca3af);
	}
	.edit-tab.active .edit-tab-count {
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}

	/* ===== 卡片网格 ===== */
	.edit-bangumi-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: 16px;
	}

	.edit-bangumi-card {
		position: relative;
		border-radius: 14px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-bangumi-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.edit-bangumi-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
	}
	.edit-bangumi-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-bangumi-card-editing {
		grid-column: span 2;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}

	/* 操作按钮 */
	.card-action-row {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
		opacity: 1;
		transition: opacity 0.2s;
	}
	.edit-bangumi-card:hover .card-action-row {
		opacity: 1;
	}
	.action-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 16px;
		backdrop-filter: blur(8px);
		transition: all 0.15s;
		color: white;
	}
	.action-move {
		background: rgba(100, 116, 139, 1);
	}
	.action-move:hover {
		background: rgba(71, 85, 105, 1);
		transform: scale(1.1);
	}
	.action-btn iconify-icon {
		display: flex;
	}
	.action-edit {
		background: rgba(59, 130, 246, 0.85);
	}
	.action-edit:hover {
		background: rgba(37, 99, 235, 0.95);
		transform: scale(1.1);
	}
	.action-delete {
		background: rgba(239, 68, 68, 0.85);
	}
	.action-delete:hover {
		background: rgba(220, 38, 38, 0.95);
		transform: scale(1.1);
	}

	/* 海报区域 */
	.card-poster {
		position: relative;
		aspect-ratio: 2/3;
		background: var(--btn-regular-bg, #f3f4f6);
		overflow: hidden;
	}
	:global(.dark) .card-poster {
		background: rgba(255,255,255,0.04);
	}
	.card-poster-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.3s;
	}
	.edit-bangumi-card:hover .card-poster-img {
		transform: scale(1.05);
	}
	.card-poster-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 36px;
	}
	.card-poster-gradient {
		position: absolute;
		inset: auto 0 0 0;
		height: 55%;
		background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 50%, transparent 100%);
		pointer-events: none;
		z-index: 1;
	}
	.card-status-badge {
		position: absolute;
		top: 8px;
		left: 8px;
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: #fff;
		backdrop-filter: blur(6px);
		z-index: 3;
		line-height: 1.5;
	}
	.card-score-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 3px 8px 3px 6px;
		border-radius: 999px;
		background: rgba(0,0,0,0.48);
		backdrop-filter: blur(6px);
		font-size: 11px;
		font-weight: 700;
		color: #fff;
		z-index: 3;
		line-height: 1;
	}
	.card-star {
		width: 11px;
		height: 11px;
		color: #fbbf24;
		flex-shrink: 0;
	}
	.card-poster-info {
		position: absolute;
		inset: auto 0 0 0;
		z-index: 2;
		padding: 0 10px 10px;
		pointer-events: none;
	}
	.card-poster-title {
		font-size: 13px;
		font-weight: 700;
		line-height: 1.4;
		color: #fff;
		margin: 0 0 4px;
		text-shadow: 0 1px 3px rgba(0,0,0,0.4);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card-cat-label {
		font-size: 10px;
		color: rgba(255,255,255,0.7);
		font-weight: 500;
	}

	/* 卡片底部信息 */
	.card-meta {
		padding: 10px 12px;
	}
	.card-meta-title {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-color, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.dark) .card-meta-title {
		color: #f0f0f0;
	}
	.card-meta-comment {
		margin: 0 0 6px;
		font-size: 11px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.dark) .card-meta-comment {
		color: #9ca3af;
	}
	.card-meta-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
	.card-meta-tag {
		font-size: 10px;
		padding: 1px 7px;
		border-radius: 999px;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--content-meta, #6b7280);
	}
	:global(.dark) .card-meta-tag {
		background: rgba(255,255,255,0.06);
		color: #9ca3af;
	}

	/* ===== 内联编辑表单 ===== */
	.card-edit-form {
		padding: 20px;
	}
	.edit-form-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.draft-badge {
		padding: 1px 8px;
		border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.form-preview {
		width: 100px;
		height: 150px;
		border-radius: 10px;
		overflow: hidden;
		margin: 0 auto 16px;
		background: var(--btn-regular-bg, #f3f4f6);
		flex-shrink: 0;
	}
	:global(.dark) .form-preview {
		background: rgba(255,255,255,0.05);
	}
	.form-preview-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.form-preview-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 32px;
	}
	.form-row {
		display: flex;
		gap: 10px;
	}
	.form-group {
		margin-bottom: 12px;
	}
	.form-group-half {
		flex: 1;
	}
	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 4px;
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}
	.form-input,
	.form-textarea,
	.form-select {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 8px;
		font-size: 13px;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.2s;
		box-sizing: border-box;
		font-family: inherit;
	}
	:global(.dark) .form-input,
	:global(.dark) .form-textarea,
	:global(.dark) .form-select {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}
	.form-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.form-btn {
		flex: 1;
		padding: 8px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.form-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.form-btn-cancel:hover {
		background: var(--border, #e5e7eb);
	}
	:global(.dark) .form-btn-cancel {
		background: #2d2d44;
		color: #d1d5db;
	}
	.form-btn-save {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.form-btn-save:hover {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}

	/* 空状态 */
	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	/* 响应式调整 */
	@media (max-width: 640px) {
		.edit-bangumi-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 10px;
		}
		.edit-bangumi-card-editing {
			grid-column: 1 / -1;
		}
		.card-meta {
			padding: 8px;
		}
		.card-meta-title {
			font-size: 12px;
		}
		.card-edit-form {
			padding: 16px;
		}
	}
</style>
