<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import {
	getRepoFile,
	showToast,
	deepClone,
	ensureIconify,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";

// ============ 类型定义（使用 any 兼容完整 siteConfig） ============
type FullConfig = Record<string, any>;

// ============ 状态 ============
let editMode = $state(true);
let saving = $state(false);
let codeMode = $state(false);

let config = $state<FullConfig>({});
let originalConfig = $state<FullConfig>({});
let codeContent = $state("");
let fileSha = $state<string | null>(null);
let originalCodeContent = $state("");

const drafts = setupRepoDrafts({
	pageKey: "config",
	pageName: "站点配置",
	getContent: () => (codeMode ? codeContent : generateTsCode(config)),
	setContent: (v) => {
		codeContent = v;
		codeMode = true;
	},
	getPath: () => "src/config/siteConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalCodeContent,
	setOriginalContent: (v) => {
		originalCodeContent = v;
		originalConfig = deepClone(config);
	},
	getCommitMsg: (isEdit) =>
		isEdit ? "chore: 更新站点配置" : "chore: 创建站点配置",
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1500);
	},
});
let hasChanges = $derived(drafts.hasLocalChanges());

// 页面开关标签映射
const pageLabels: Record<string, string> = {
	friends: "友链页面",
	sponsor: "赞助页面",
	guestbook: "留言板",
	gallery: "相册页面",
	collections: "收藏API",
	stats: "统计页面",
	calendar: "日历页面",
	bangumi: "番剧页面",
	books: "书架页面",
	moviesGames: "影视游戏",
	musicPage: "音乐页面",
	changelog: "更新日志",
	moments: "动态页面",
	admin: "后台管理",
	lifeRoutines: "日常规划",
	lifePlaces: "旅行足迹",
	lifeNotebooks: "笔记本",
};

// 语言选项
const langOptions = [
	{ value: "zh_CN", label: "简体中文 (zh_CN)" },
	{ value: "zh_TW", label: "繁體中文 (zh_TW)" },
	{ value: "en", label: "English (en)" },
	{ value: "ja", label: "日本語 (ja)" },
	{ value: "ru", label: "Русский (ru)" },
];

// ============ 生命周期 ============
onMount(() => {
	ensureIconify();
	loadConfig();
	initRepoState();
});

function loadConfig() {
	try {
		const w = window as any;
		if (w.__SITE_CONFIG__) {
			config = deepClone(w.__SITE_CONFIG__);
			// 确保嵌套对象有默认值
			if (!config.themeColor)
				config.themeColor = { hue: 165, fixed: false, defaultMode: "light" };
			if (!config.navbar) config.navbar = {};
			if (!config.navbar.logo)
				config.navbar.logo = { type: "icon", value: "", alt: "logo" };
			if (!config.pages) config.pages = {};
			if (!config.pagination) config.pagination = { postsPerPage: 10 };
			if (!config.postListLayout)
				config.postListLayout = { defaultMode: "list" };
			// 初始化导航链接管理
			initNavItems();
			originalConfig = deepClone(config);
			// 保存原始navItems的副本用于取消
			originalNavItems = deepClone(navItems);
			originalCodeContent = generateTsCode(config);
		}
	} catch (e) {
		console.error("Failed to load site config:", e);
	}
}

async function initRepoState() {
	try {
		const existing = await getRepoFile("src/config/siteConfig.ts", repoConfig);
		if (existing) {
			fileSha = existing.sha;
		}
	} catch {}
	drafts.restoreFromDrafts();
}

let originalNavItems = $state<NavItem[]>([]);

// ============ 安全访问辅助 ============
function getThemeColor() {
	return config.themeColor || { hue: 165, fixed: false, defaultMode: "light" };
}
function getNavbar() {
	return config.navbar || {};
}
function getLogo() {
	return config.navbar?.logo || { type: "icon", value: "", alt: "logo" };
}
function getPages() {
	return config.pages || {};
}

// ============ 编辑模式控制 ============
function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
	} else {
		codeMode = false;
	}
}

function handleCancel() {
	config = deepClone(originalConfig);
	navItems = deepClone(originalNavItems);
	codeMode = false;
	drafts.clearDrafts();
	showToast("已取消编辑", "info");
}

// ============ 表单更新工具 ============
function setConfig(path: string[], value: any) {
	let obj: any = config;
	for (let i = 0; i < path.length - 1; i++) {
		if (!obj[path[i]]) obj[path[i]] = {};
		obj = obj[path[i]];
	}
	obj[path[path.length - 1]] = value;
	config = { ...config };
}

function updateKeywords(value: string) {
	config.keywords = value
		.split(/[,，]/)
		.map((s) => s.trim())
		.filter(Boolean);
	config = { ...config };
}

function getKeywordsString(): string {
	return (config.keywords || []).join(", ");
}

function updatePageField(key: string, value: boolean) {
	config.pages = { ...config.pages, [key]: value };
}

// ============ 导航栏链接管理 ============
type NavParent = "top" | "posts" | "contact" | "my" | "hidden";
type NavItem = {
	id: string;
	type: "preset" | "custom";
	parent: NavParent;
	name?: string;
	url?: string;
	icon?: string;
	external?: boolean;
};

// 预设链接的中文名称、图标、页面开关依赖
const PRESET_META: Record<
	string,
	{ label: string; icon: string; pageGate?: string }
> = {
	home: { label: "首页", icon: "material-symbols:home" },
	archive: { label: "归档", icon: "material-symbols:schedule-outline-rounded" },
	categories: { label: "分类标签", icon: "material-symbols:category" },
	postlist: {
		label: "文章列表",
		icon: "material-symbols:list-alt-outline-rounded",
	},
	collections: {
		label: "收藏",
		icon: "material-symbols:bookmark",
		pageGate: "collections",
	},
	friends: {
		label: "友链",
		icon: "material-symbols:group",
		pageGate: "friends",
	},
	guestbook: {
		label: "留言板",
		icon: "material-symbols:chat",
		pageGate: "guestbook",
	},
	qqgroup: { label: "QQ群", icon: "fa7-brands:qq" },
	fhome: { label: "导航主页", icon: "material-symbols:link" },
	fnote: { label: "笔记", icon: "material-symbols:link" },
	calendar: {
		label: "日历",
		icon: "material-symbols:calendar-today",
		pageGate: "calendar",
	},
	bangumi: {
		label: "番剧",
		icon: "material-symbols:movie",
		pageGate: "bangumi",
	},
	books: { label: "书架", icon: "material-symbols:book-5", pageGate: "books" },
	moviesgames: {
		label: "影视游戏",
		icon: "material-symbols:movie",
		pageGate: "moviesGames",
	},
	musicpage: {
		label: "音乐",
		icon: "material-symbols:music-note",
		pageGate: "musicPage",
	},
	changelog: {
		label: "更新日志",
		icon: "material-symbols:history",
		pageGate: "changelog",
	},
	moments: {
		label: "动态",
		icon: "material-symbols:local-cafe",
		pageGate: "moments",
	},
	routines: {
		label: "日常规划",
		icon: "material-symbols:list-alt",
		pageGate: "lifeRoutines",
	},
	places: {
		label: "旅行足迹",
		icon: "material-symbols:location-on",
		pageGate: "lifePlaces",
	},
	notebooks: {
		label: "笔记本",
		icon: "material-symbols:menu-book",
		pageGate: "lifeNotebooks",
	},
	gallery: {
		label: "相册",
		icon: "material-symbols:photo-library",
		pageGate: "gallery",
	},
	sponsor: {
		label: "赞助",
		icon: "material-symbols:favorite",
		pageGate: "sponsor",
	},
	about: { label: "关于", icon: "material-symbols:person" },
};

const PARENT_LABELS: Record<
	NavParent,
	{ label: string; icon: string; color: string }
> = {
	top: {
		label: "导航栏",
		icon: "material-symbols:top-panel-open",
		color: "#10b981",
	},
	posts: { label: "文章", icon: "material-symbols:article", color: "#3b82f6" },
	contact: { label: "联系我", icon: "material-symbols:mail", color: "#f59e0b" },
	my: { label: "我的", icon: "material-symbols:person", color: "#8b5cf6" },
	hidden: {
		label: "已隐藏",
		icon: "material-symbols:visibility-off",
		color: "#94a3b8",
	},
};

let navItems = $state<NavItem[]>([]);

function getDefaultNavOrder(): NavItem[] {
	const items: NavItem[] = [];
	items.push({ id: "home", type: "preset", parent: "top" });
	items.push({ id: "collections", type: "preset", parent: "top" });
	items.push({ id: "archive", type: "preset", parent: "posts" });
	items.push({ id: "categories", type: "preset", parent: "posts" });
	items.push({ id: "postlist", type: "preset", parent: "posts" });
	items.push({ id: "friends", type: "preset", parent: "contact" });
	items.push({ id: "guestbook", type: "preset", parent: "contact" });
	items.push({ id: "qqgroup", type: "preset", parent: "contact" });
	items.push({ id: "fhome", type: "preset", parent: "my" });
	items.push({ id: "fnote", type: "preset", parent: "my" });
	items.push({ id: "calendar", type: "preset", parent: "my" });
	items.push({ id: "bangumi", type: "preset", parent: "my" });
	items.push({ id: "books", type: "preset", parent: "my" });
	items.push({ id: "moviesgames", type: "preset", parent: "my" });
	items.push({ id: "musicpage", type: "preset", parent: "my" });
	items.push({ id: "changelog", type: "preset", parent: "my" });
	items.push({ id: "moments", type: "preset", parent: "my" });
	items.push({ id: "routines", type: "preset", parent: "my" });
	items.push({ id: "places", type: "preset", parent: "my" });
	items.push({ id: "notebooks", type: "preset", parent: "my" });
	items.push({ id: "gallery", type: "preset", parent: "my" });
	items.push({ id: "sponsor", type: "preset", parent: "my" });
	items.push({ id: "about", type: "preset", parent: "my" });
	return items;
}

/**
 * 判断预设链接是否在当前页面开关下可用
 */
function isPresetEnabled(key: string): boolean {
	const meta = PRESET_META[key];
	if (!meta) return true;
	if (!meta.pageGate) return true;
	return !!config.pages?.[meta.pageGate];
}

function initNavItems() {
	// 先从已有配置的navItems加载
	const existing = config.navbar?.navItems;
	if (existing && Array.isArray(existing) && existing.length > 0) {
		navItems = existing.map((it: any) => ({
			id: it.id,
			type: it.type || "custom",
			parent: it.parent || "my",
			name: it.name,
			url: it.url,
			icon: it.icon,
			external: !!it.external,
		}));
		// 补充可能缺失的预设链接（比如新版本新增的页面）
		const existingIds = new Set(navItems.map((n) => n.id));
		const defaults = getDefaultNavOrder();
		for (const d of defaults) {
			if (!existingIds.has(d.id)) {
				navItems.push(d);
			}
		}
		return;
	}

	// 兼容旧版customLinks
	const oldCustomLinks = (config.navbar as any)?.customLinks;
	const defaults = getDefaultNavOrder();
	if (
		oldCustomLinks &&
		Array.isArray(oldCustomLinks) &&
		oldCustomLinks.length > 0
	) {
		let customIdx = 0;
		for (const cl of oldCustomLinks) {
			if (!cl.name || !cl.url) continue;
			defaults.push({
				id: `custom-${Date.now()}-${customIdx++}`,
				type: "custom",
				parent: (cl.parent as NavParent) || "my",
				name: cl.name,
				url: cl.url,
				icon: cl.icon || "",
				external: !!cl.external,
			});
		}
	}
	navItems = defaults;
}

function getItemsByParent(parent: NavParent): NavItem[] {
	return navItems.filter((n) => n.parent === parent);
}

function getItemIndex(id: string): number {
	return navItems.findIndex((n) => n.id === id);
}

function moveNavItem(id: string, dir: -1 | 1) {
	const idx = getItemIndex(id);
	if (idx === -1) return;
	const item = navItems[idx];
	const groupItems = getItemsByParent(item.parent);
	const groupIdx = groupItems.findIndex((g) => g.id === id);
	const newGroupIdx = groupIdx + dir;
	if (newGroupIdx < 0 || newGroupIdx >= groupItems.length) return;

	// 计算在扁平数组中的目标位置
	const targetId = groupItems[newGroupIdx].id;
	const targetIdx = getItemIndex(targetId);
	const newItems = [...navItems];
	newItems.splice(idx, 1);
	newItems.splice(targetIdx, 0, item);
	navItems = newItems;
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
}

function changeNavItemParent(id: string, newParent: NavParent) {
	const idx = getItemIndex(id);
	if (idx === -1) return;
	navItems = navItems.map((n) =>
		n.id === id ? { ...n, parent: newParent } : n,
	);
	// 移动到对应分组的末尾
	const item = navItems[idx];
	const newItems = navItems.filter((n) => n.id !== id);
	// 找到目标分组的最后一项，插入到它之后
	let insertIdx = newItems.length;
	for (let i = newItems.length - 1; i >= 0; i--) {
		if (newItems[i].parent === newParent) {
			insertIdx = i + 1;
			break;
		}
	}
	newItems.splice(insertIdx, 0, { ...item, parent: newParent });
	navItems = newItems;
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
}

function toggleNavItemHidden(id: string) {
	const idx = getItemIndex(id);
	if (idx === -1) return;
	const item = navItems[idx];
	// 预设链接不能删除，只能隐藏/显示
	if (item.type === "preset") {
		const newParent: NavParent = item.parent === "hidden" ? "my" : "hidden";
		changeNavItemParent(id, newParent);
	}
}

function addCustomNavItem(parent: NavParent = "my") {
	const newItem: NavItem = {
		id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
		type: "custom",
		parent,
		name: "新链接",
		url: "/",
		icon: "",
		external: false,
	};
	// 插入到对应分组末尾
	const newItems = [...navItems];
	let insertIdx = newItems.length;
	for (let i = newItems.length - 1; i >= 0; i--) {
		if (newItems[i].parent === parent) {
			insertIdx = i + 1;
			break;
		}
	}
	newItems.splice(insertIdx, 0, newItem);
	navItems = newItems;
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
}

function updateCustomNavItem(id: string, field: string, value: any) {
	navItems = navItems.map((n) => (n.id === id ? { ...n, [field]: value } : n));
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
}

function removeCustomNavItem(id: string) {
	navItems = navItems.filter((n) => n.id !== id);
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
}

function resetNavItems() {
	navItems = getDefaultNavOrder();
	config.navbar = { ...(config.navbar || {}), navItems: [...navItems] };
	config = { ...config };
	showToast("已重置为默认导航顺序", "info");
}

function getItemDisplayName(item: NavItem): string {
	if (item.type === "preset") {
		return PRESET_META[item.id]?.label || item.id;
	}
	return item.name || "(未命名)";
}

function getItemIcon(item: NavItem): string {
	if (item.type === "preset") {
		return PRESET_META[item.id]?.icon || "material-symbols:link";
	}
	return item.icon || "material-symbols:link";
}

// ============ 代码模式切换 ============
function toggleCodeMode() {
	if (!codeMode) {
		codeContent = generateTsCode(config);
	}
	codeMode = !codeMode;
}

// ============ TypeScript 代码生成 ============
/**
 * 基于原始 siteConfig.ts 的模板结构生成完整 TypeScript 代码
 * 保留所有配置字段，仅替换可编辑部分的值
 */
function generateTsCode(cfg: FullConfig): string {
	const tc = cfg.themeColor || {};
	const nb = cfg.navbar || {};
	const logo = nb.logo || {};
	const pg = cfg.pages || {};
	const pl = cfg.postListLayout || {};
	const pn = cfg.pagination || {};
	const wh = cfg.workHours || {
		start: 9,
		end: 18,
		workDays: [1, 2, 3, 4, 5, 6],
	};
	const cc = cfg.card || { border: true, followTheme: false };
	const favicon = cfg.favicon || [];
	const rc = cfg.rehypeCallouts || { theme: "github" };
	const an = cfg.analytics || {};
	const hm = cfg.heatmap || {};
	const io = cfg.imageOptimization || {};
	const slm = cfg.showLastModified !== undefined ? cfg.showLastModified : true;
	const ot = cfg.outdatedThreshold !== undefined ? cfg.outdatedThreshold : 30;
	const sp = cfg.sharePoster !== undefined ? cfg.sharePoster : true;
	const goi = cfg.generateOgImages !== undefined ? cfg.generateOgImages : false;
	const doi = cfg.defaultOgImage || "/assets/images/aut.webp";
	const cb = cfg.categoryBar !== undefined ? cfg.categoryBar : true;
	const pw = cfg.pageWidth !== undefined ? cfg.pageWidth : 100;

	// 关键词数组
	const kw = cfg.keywords || [];
	const keywordsStr =
		kw.length > 0 ? kw.map((k: string) => `\t\t"${k}",`).join("\n") : "";

	// favicon 数组
	const faviconStr =
		favicon.length > 0
			? favicon
					.map((f: any) => {
						const parts: string[] = [];
						if (f.src !== undefined)
							parts.push(`src: ${JSON.stringify(f.src)}`);
						if (f.sizes !== undefined)
							parts.push(`sizes: ${JSON.stringify(f.sizes)}`);
						return `\t\t{ ${parts.join(", ")} },`;
					})
					.join("\n")
			: "";

	// pages 对象
	const pageKeys = Object.keys(pg);
	const pagesStr = pageKeys.map((k) => `\t\t${k}: ${pg[k]},`).join("\n");

	// workDays 数组
	const workDaysStr = (wh.workDays || [1, 2, 3, 4, 5, 6]).join(", ");

	// analytics 序列化
	const googleId = an.googleAnalyticsId || "";
	const msClarityId = an.microsoftClarityId || "";
	const umami = an.umamiAnalytics || {};
	const la51 = an.la51Analytics || {};
	const umamiReplays = umami.relpays || {};
	const ghHeatmap = hm.github || { enabled: true, username: "" };

	// 导航链接配置（完整控制导航结构）
	const navItemsForCode = navItems || [];
	const navItemsStr =
		navItemsForCode.length > 0
			? navItemsForCode
					.map((it: NavItem) => {
						const parts: string[] = [];
						parts.push(`\t\t\tid: ${JSON.stringify(it.id)}`);
						parts.push(`\t\t\ttype: ${JSON.stringify(it.type)}`);
						parts.push(`\t\t\tparent: ${JSON.stringify(it.parent)}`);
						if (it.type === "custom") {
							if (it.name) parts.push(`\t\t\tname: ${JSON.stringify(it.name)}`);
							if (it.url) parts.push(`\t\t\turl: ${JSON.stringify(it.url)}`);
							if (it.icon) parts.push(`\t\t\ticon: ${JSON.stringify(it.icon)}`);
							if (it.external) parts.push(`\t\t\texternal: true`);
						}
						return `\t\t{\n${parts.join(",\n")},\n\t\t}`;
					})
					.join(",\n")
			: "";

	return `import type { SiteConfig } from "@/types/config";
import { fontConfig } from "./fontConfig";

// 定义站点语言
// 语言代码，例如：'zh_CN', 'zh_TW', 'en', 'ja', 'ru'。
const SITE_LANG = ${JSON.stringify(cfg.lang || "zh_CN")};

export const siteConfig: SiteConfig = {
	// 站点标题
	title: ${JSON.stringify(cfg.title || "")},

	// 站点副标题
	subtitle: ${JSON.stringify(cfg.subtitle || "")},

	// 站点 URL
	site_url: ${JSON.stringify(cfg.site_url || "")},

	// 站点描述
	description: ${JSON.stringify(cfg.description || "")},

	// 站点关键词
	keywords: [
${keywordsStr}
	],

	// 主题色
	themeColor: {
		// 主题色的默认色相，范围从 0 到 360。例如：红色：0，青色：200，蓝绿色：250，粉色：345
		hue: ${tc.hue ?? 165},
		// 是否对访问者隐藏主题色选择器
		fixed: ${tc.fixed ?? false},
		// 默认模式："light" 亮色，"dark" 暗色
		defaultMode: ${JSON.stringify(tc.defaultMode || "light")},
	},

	// 页面整体宽度（单位：rem）
	pageWidth: ${pw},

	// 网站Card样式配置
	card: {
		// 是否开启卡片边框和阴影，开启后让网站更有立体感
		border: ${cc.border !== false},
		// 是否让卡片风格跟随主题色相
		followTheme: ${cc.followTheme ?? false},
	},

	// Favicon 配置
	favicon: [
${faviconStr}
	],

	// 导航栏配置
	navbar: {
		// 导航栏Logo
		logo: {
			type: ${JSON.stringify(logo.type || "icon")},
			value: ${JSON.stringify(logo.value || "")},
			alt: ${JSON.stringify(logo.alt || "logo")},
		},
		// 导航栏标题
		title: ${JSON.stringify(nb.title || "")},
		// 全宽导航栏，导航栏是否占满屏幕宽度
		widthFull: ${nb.widthFull ?? false},
		// 导航菜单对齐方式，left：左对齐，center：居中
		menuAlign: ${JSON.stringify(nb.menuAlign || "center")},
		// 导航栏图标和标题是否跟随主题色
		followTheme: ${nb.followTheme ?? false},
		// 导航栏是否固定在顶部并始终可见
		stickyNavbar: ${nb.stickyNavbar !== false},
		// 导航链接配置（完整控制导航结构）
		// parent 可选值: "top"(导航栏), "posts"(文章菜单), "contact"(联系我菜单), "my"(我的菜单), "hidden"(隐藏)
		// type: "preset"(预设链接，通过id引用) | "custom"(自定义链接，需提供name/url)
		navItems: [
${navItemsStr}
		],
	},

	// 站点开始日期，用于统计运行天数
	siteStartDate: ${JSON.stringify(cfg.siteStartDate || "")},

	// 站点时区（IANA 时区字符串），用于格式化bangumi、rss里的构建日期时间等等..
	timezone: ${JSON.stringify(cfg.timezone || "")},

	// 上下班时间配置（24小时制），用于首页头像涟漪动效和状态按钮
	workHours: {
		start: ${wh.start ?? 9}, // 上班时间
		end: ${wh.end ?? 18}, // 下班时间
		workDays: [${workDaysStr}],
	},

	// 提醒框（Admonitions）配置
	rehypeCallouts: {
		theme: ${JSON.stringify(rc.theme || "github")},
	},

	// 文章页底部的"上次编辑时间"卡片开关
	showLastModified: ${slm},

	// 文章过期阈值（天数），超过此天数才显示"上次编辑"卡片
	outdatedThreshold: ${ot},

	// 是否开启分享海报生成功能
	sharePoster: ${sp},

	// OpenGraph图片功能,注意开启后要渲染很长时间，不建议本地调试的时候开启
	generateOgImages: ${goi},

	defaultOgImage: ${JSON.stringify(doi)},

	// 页面开关配置 - 控制特定页面的访问权限，设为false会返回404
	pages: {
${pagesStr}
	},

	// 分类导航栏开关，在首页和归档页顶部显示分类快捷导航
	categoryBar: ${cb},

	// 文章列表布局配置
	postListLayout: {
		// 默认布局模式："list" 列表模式（单列布局），"grid" 网格模式（多列布局）
		defaultMode: ${JSON.stringify(pl.defaultMode || "list")},
		// 移动端默认布局模式，不设置则跟随 defaultMode
		mobileDefaultMode: ${JSON.stringify(pl.mobileDefaultMode || "list")},
		// 是否在文章列表中显示标签
		showTags: ${pl.showTags !== false},
		// 文章简介显示行数，设为 0 则不截断
		descriptionLines: ${pl.descriptionLines ?? 2},
		// 是否允许用户切换布局
		allowSwitch: ${pl.allowSwitch !== false},
		// 网格布局配置
		grid: {
			// 是否开启瀑布流布局
			masonry: ${pl.grid?.masonry ?? false},
			// 网格模式卡片最小宽度(px)
			columnWidth: ${pl.grid?.columnWidth ?? 320},
		},
	},

	// 分页配置
	pagination: {
		// 每页显示的文章数量
		postsPerPage: ${pn.postsPerPage ?? 10},
	},

	// 统计分析
	analytics: {
		// Google Analytics ID
		googleAnalyticsId: ${JSON.stringify(googleId)},
		// Microsoft Clarity ID
		microsoftClarityId: ${JSON.stringify(msClarityId)},
		// Umami 统计配置
		umamiAnalytics: {
			websiteId: ${JSON.stringify(umami.websiteId || "")},
			shareId: ${JSON.stringify(umami.shareId || "")},
			scriptUrl: ${JSON.stringify(umami.scriptUrl || "")},
			// 是否追踪出站链接
			trackOutboundLinks: ${umami.trackOutboundLinks !== false},
			// 是否收集浏览器性能指标
			collectWebVitals: ${umami.collectWebVitals ?? false},
			// 会话回放配置
			relpays: {
				// 是否启用会话回放
				enabled: ${umamiReplays.enabled ?? false},
				// 录制会话采样率，范围 0-1
				sampleRate: ${umamiReplays.sampleRate ?? 0.15},
				// 隐私遮罩级别
				maskLevel: ${JSON.stringify(umamiReplays.maskLevel || "moderate")},
				// 单次录制最大时长（毫秒）
				maxDuration: ${umamiReplays.maxDuration ?? 300000},
				// 需要排除录制的元素 CSS 选择器
				blockSelector: ${JSON.stringify(umamiReplays.blockSelector || "")},
			},
		},
		// 51la 统计配置
		la51Analytics: {
			// 51la 统计 ID
			Id: ${JSON.stringify(la51.Id || "")},
			// 自定义 SDK JS 地址
			sdkUrl: ${JSON.stringify(la51.sdkUrl || "")},
			// 多个统计 ID 的数据分离标识
			ck: ${JSON.stringify(la51.ck || "")},
			// 是否开启事件分析功能
			autoTrack: ${la51.autoTrack ?? false},
			// Hash路由模式
			hashMode: ${la51.hashMode ?? false},
			// 是否开启网站录屏功能
			screenRecord: ${la51.screenRecord !== false},
		},
	},

	// 热力图配置
	heatmap: {
		github: {
			enabled: ${ghHeatmap.enabled !== false},
			username: ${JSON.stringify(ghHeatmap.username || "")},
		},
	},

	// 图像优化及响应式配置
	imageOptimization: {
		// 输出图片格式
		formats: ${JSON.stringify(io.formats || "webp")},
		// 图片压缩质量 (1-100)
		quality: ${io.quality ?? 85},
		// 为特定域名的图片添加 referrerpolicy="no-referrer" 属性
		noReferrerDomains: ${JSON.stringify(io.noReferrerDomains || [])},
	},

	// 字体配置
	font: fontConfig,

	// 站点语言，在本配置文件顶部SITE_LANG定义
	lang: SITE_LANG,

	// 备案号配置，留空则不显示
	beian: ${JSON.stringify(cfg.beian || "")},

	// 公安网备号配置，留空则不显示
	policeBeian: ${JSON.stringify(cfg.policeBeian || "")},
};
`;
}

// ============ 保存到 GitHub ============
function handleSaveDraft() {
	drafts.saveToDrafts();
}

async function handleSubmit() {
	saving = true;
	try {
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

const huePreviewColor = $derived(`hsl(${getThemeColor().hue}, 70%, 50%)`);
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="config-edit-toolbar">
	<EditToolbar
		pageName="站点配置"
		pageKey="config"
		mountTo=".page-header-toolbar-slot"
		startInEditMode={true}
		persistentEdit={true}
		{saving}
		{hasChanges}
		showAddButton={false}
		on:modeChange={(e) => handleModeChange(e)}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
		on:cancel={() => handleCancel()}
	/>
</div>

<!-- 编辑模式内容 -->
{#if editMode}
	<button
		class="code-toggle-btn"
		class:code-toggle-btn-active={codeMode}
		onclick={toggleCodeMode}
		title={codeMode ? "切换到可视化编辑" : "切换到代码编辑"}
	>
		<iconify-icon icon={codeMode ? "material-symbols:visibility-rounded" : "material-symbols:code-rounded"} class="text-sm"></iconify-icon>
		{codeMode ? "可视化" : "代码"}
	</button>

	{#if codeMode}
		<!-- 代码编辑模式 -->
		<div class="config-card">
			<div class="config-card-header">
				<iconify-icon icon="material-symbols:code-rounded" class="text-lg"></iconify-icon>
				<h3>TypeScript 代码编辑</h3>
			</div>
			<div class="code-editor-wrap">
				<textarea
					bind:value={codeContent}
					class="code-textarea"
					spellcheck="false"
				></textarea>
			</div>
		</div>
	{:else}
		<!-- 可视化表单编辑模式 -->
		<div class="config-form">
			<!-- a. 基础信息 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-lg"></iconify-icon>
					<h3>基础信息</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点标题</label>
							<input
								type="text"
								value={config.title || ""}
								oninput={(e) => setConfig(["title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点标题"
							/>
						</div>
						<div class="form-group">
							<label>副标题</label>
							<input
								type="text"
								value={config.subtitle || ""}
								oninput={(e) => setConfig(["subtitle"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点副标题"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点 URL</label>
							<input
								type="url"
								value={config.site_url || ""}
								oninput={(e) => setConfig(["site_url"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="https://example.com/"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点描述</label>
							<textarea
								value={config.description || ""}
								oninput={(e) => setConfig(["description"], (e.target as HTMLTextAreaElement).value)}
								class="form-textarea"
								rows={2}
								placeholder="用于 SEO meta description"
							></textarea>
						</div>
						<div class="form-group form-group-full">
							<label>关键词（逗号分隔）</label>
							<input
								type="text"
								value={getKeywordsString()}
								oninput={(e) => updateKeywords((e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="关键词1, 关键词2, 关键词3"
							/>
						</div>
						<div class="form-group">
							<label>语言</label>
							<select
								value={config.lang || "zh_CN"}
								onchange={(e) => setConfig(["lang"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								{#each langOptions as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
			</div>

			<!-- b. 主题设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:palette-outline-rounded" class="text-lg"></iconify-icon>
					<h3>主题设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>
								主题色 Hue:
								<span class="hue-value" style="color:{huePreviewColor}">{getThemeColor().hue}</span>
							</label>
							<div class="hue-slider-wrap">
								<input
									type="range"
									min={0}
									max={360}
									value={getThemeColor().hue}
									oninput={(e) => setConfig(["themeColor", "hue"], parseInt((e.target as HTMLInputElement).value))}
									class="hue-slider"
									style={`--hue-preview:${huePreviewColor}`}
								/>
								<div class="hue-preview-dot" style={`background:${huePreviewColor}`}></div>
							</div>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getThemeColor().fixed}
									onchange={(e) => setConfig(["themeColor", "fixed"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>固定主题色（隐藏选择器）</span>
							</label>
						</div>
						<div class="form-group">
							<label>默认模式</label>
							<select
								value={getThemeColor().defaultMode || "light"}
								onchange={(e) => setConfig(["themeColor", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="light">浅色 (light)</option>
								<option value="dark">暗色 (dark)</option>
								<option value="auto">跟随系统 (auto)</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<!-- c. 导航栏设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:navigation-rounded" class="text-lg"></iconify-icon>
					<h3>导航栏设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>Logo 类型</label>
							<select
								value={getLogo().type || "icon"}
								onchange={(e) => setConfig(["navbar", "logo", "type"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="icon">图标 (icon)</option>
								<option value="image">本地图片 (image)</option>
								<option value="url">网络图片 (url)</option>
							</select>
						</div>
						<div class="form-group">
							<label>Logo 值</label>
							<input
								type="text"
								value={getLogo().value || ""}
								oninput={(e) => setConfig(["navbar", "logo", "value"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder={getLogo().type === "icon" ? "material-symbols:home" : "图片路径或URL"}
							/>
						</div>
						<div class="form-group">
							<label>导航标题</label>
							<input
								type="text"
								value={getNavbar().title || ""}
								oninput={(e) => setConfig(["navbar", "title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则使用站点标题"
							/>
						</div>
						<div class="form-group">
							<label>菜单对齐</label>
							<select
								value={getNavbar().menuAlign || "center"}
								onchange={(e) => setConfig(["navbar", "menuAlign"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="left">左对齐 (left)</option>
								<option value="center">居中 (center)</option>
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().widthFull ?? false}
									onchange={(e) => setConfig(["navbar", "widthFull"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>全宽导航栏</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().followTheme ?? false}
									onchange={(e) => setConfig(["navbar", "followTheme"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>图标标题跟随主题色</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().stickyNavbar !== false}
									onchange={(e) => setConfig(["navbar", "stickyNavbar"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>固定导航栏</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<!-- d. 导航栏链接管理 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:menu-open-rounded" class="text-lg"></iconify-icon>
					<h3>导航栏链接管理</h3>
					<div class="config-header-actions">
						<button class="config-btn-secondary" onclick={resetNavItems} title="恢复默认导航顺序">
							<iconify-icon icon="material-symbols:settings-backup-restore-rounded"></iconify-icon> 重置默认
						</button>
						<button class="config-add-btn" onclick={() => addCustomNavItem("my")} title="添加自定义链接">
							<iconify-icon icon="material-symbols:add-link-rounded"></iconify-icon> 添加链接
						</button>
					</div>
				</div>
				<div class="config-card-body">
					<p class="config-hint">
						完全控制导航栏链接：可以将预设链接（如"关于"、"友链"）移动到任意菜单，调整顺序，隐藏不需要的链接，或添加自定义链接。
						分组：导航栏（直接显示）| 文章 | 联系我 | 我的 | 已隐藏。
					</p>

					<div class="nav-groups">
						{#each ["top", "posts", "contact", "my", "hidden"] as p (p)}
							<div class="nav-group" data-parent={p}>
								<div class="nav-group-header" style={`--group-color: ${PARENT_LABELS[p].color}`}>
									<iconify-icon icon={PARENT_LABELS[p].icon}></iconify-icon>
									<span class="nav-group-title">{PARENT_LABELS[p].label}</span>
									<span class="nav-group-count">{getItemsByParent(p).length}</span>
									<button
										class="nav-group-add"
										onclick={() => addCustomNavItem(p)}
										title="在此分组添加自定义链接"
									>
										<iconify-icon icon="material-symbols:add-rounded"></iconify-icon>
									</button>
								</div>
								<div class="nav-group-body">
									{#if getItemsByParent(p).length === 0}
										<div class="nav-group-empty">
											<iconify-icon icon="material-symbols:drag-indicator-rounded" style="opacity:0.3"></iconify-icon>
											<span>移动链接到这里</span>
										</div>
									{:else}
										{#each getItemsByParent(p) as item, gIdx (item.id)}
											<div class="nav-item" class:nav-item-custom={item.type === "custom"} class:nav-item-disabled={item.type === "preset" && !isPresetEnabled(item.id)}>
												<div class="nav-item-drag">
													<iconify-icon icon="material-symbols:drag-indicator-rounded"></iconify-icon>
												</div>
												<div class="nav-item-icon">
													<iconify-icon icon={getItemIcon(item)}></iconify-icon>
												</div>
												<div class="nav-item-main">
													{#if item.type === "preset"}
														<span class="nav-item-name">{getItemDisplayName(item)}</span>
														{#if !isPresetEnabled(item.id)}
															<span class="nav-item-badge nav-item-badge-warn" title="对应页面未在页面开关中启用">
																<iconify-icon icon="material-symbols:warning-outline-rounded"></iconify-icon>
																页面未启用
															</span>
														{/if}
														<span class="nav-item-badge">预设</span>
													{:else}
														<div class="nav-custom-fields">
															<input
																type="text"
																class="nav-custom-input"
																value={item.name || ""}
																oninput={(e) => updateCustomNavItem(item.id, "name", (e.target as HTMLInputElement).value)}
																placeholder="链接名称"
															/>
															<input
																type="text"
																class="nav-custom-input"
																value={item.url || ""}
																oninput={(e) => updateCustomNavItem(item.id, "url", (e.target as HTMLInputElement).value)}
																placeholder="/path/ 或 https://..."
															/>
															<input
																type="text"
																class="nav-custom-input nav-custom-input-sm"
																value={item.icon || ""}
																oninput={(e) => updateCustomNavItem(item.id, "icon", (e.target as HTMLInputElement).value)}
																placeholder="图标 (可选)"
															/>
															<label class="nav-custom-check">
																<input
																	type="checkbox"
																	checked={!!item.external}
																	onchange={(e) => updateCustomNavItem(item.id, "external", (e.target as HTMLInputElement).checked)}
																/>
																<span>外链</span>
															</label>
														</div>
													{/if}
												</div>
												<div class="nav-item-controls">
													<select
														class="nav-parent-select"
														value={item.parent}
														onchange={(e) => changeNavItemParent(item.id, (e.target as HTMLSelectElement).value as NavParent)}
														title="移动到菜单"
													>
														<option value="top" disabled={item.id === "home"}>导航栏</option>
														<option value="posts">文章</option>
														<option value="contact">联系我</option>
														<option value="my">我的</option>
														<option value="hidden" disabled={item.id === "home"}>隐藏</option>
													</select>
													<div class="nav-item-btns">
														<button
															class="nav-ctrl-btn"
															onclick={() => moveNavItem(item.id, -1)}
															disabled={gIdx === 0}
															title="上移"
														>
															<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
														</button>
														<button
															class="nav-ctrl-btn"
															onclick={() => moveNavItem(item.id, 1)}
															disabled={gIdx === getItemsByParent(p).length - 1}
															title="下移"
														>
															<iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
														</button>
														{#if item.type === "custom"}
															<button
																class="nav-ctrl-btn nav-ctrl-btn-danger"
																onclick={() => removeCustomNavItem(item.id)}
																title="删除自定义链接"
															>
																<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
															</button>
														{:else if item.id !== "home"}
															<button
																class="nav-ctrl-btn"
																class:nav-ctrl-btn-active={item.parent === "hidden"}
																onclick={() => toggleNavItemHidden(item.id)}
																title={item.parent === "hidden" ? "显示此链接" : "隐藏此链接"}
															>
																<iconify-icon icon={item.parent === "hidden" ? "material-symbols:visibility-rounded" : "material-symbols:visibility-off-rounded"}></iconify-icon>
															</button>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- e. 页面开关 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:toggle-on-outline-rounded" class="text-lg"></iconify-icon>
					<h3>页面开关</h3>
				</div>
				<div class="config-card-body">
					<div class="pages-grid">
						{#each Object.entries(getPages()) as [key, val]}
							<label class="page-toggle-item" class:page-toggle-off={!val}>
								<input
									type="checkbox"
									checked={val}
									onchange={(e) => updatePageField(key, (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span class="page-toggle-label">{pageLabels[key] || key}</span>
								<span class="page-toggle-key">{key}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- f. 页脚信息 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:verified-outline-rounded" class="text-lg"></iconify-icon>
					<h3>页脚备案信息</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>ICP 备案号</label>
							<input
								type="text"
								value={config.beian || ""}
								oninput={(e) => setConfig(["beian"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则不显示"
							/>
						</div>
						<div class="form-group">
							<label>公安备案号</label>
							<input
								type="text"
								value={config.policeBeian || ""}
								oninput={(e) => setConfig(["policeBeian"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则不显示"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- g. 其他设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:settings-outline-rounded" class="text-lg"></iconify-icon>
					<h3>其他设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点开始日期</label>
							<input
								type="date"
								value={config.siteStartDate || ""}
								oninput={(e) => setConfig(["siteStartDate"], (e.target as HTMLInputElement).value)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>时区</label>
							<input
								type="text"
								value={config.timezone || ""}
								oninput={(e) => setConfig(["timezone"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Asia/Shanghai"
							/>
						</div>
						<div class="form-group">
							<label>每页文章数</label>
							<input
								type="number"
								min={1}
								max={50}
								value={config.pagination?.postsPerPage ?? 10}
								oninput={(e) => setConfig(["pagination", "postsPerPage"], parseInt((e.target as HTMLInputElement).value) || 10)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>文章列表默认模式</label>
							<select
								value={config.postListLayout?.defaultMode || "list"}
								onchange={(e) => setConfig(["postListLayout", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="list">列表模式 (list)</option>
								<option value="grid">网格模式 (grid)</option>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* 工具栏区域 */
	.config-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.code-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 14px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1.5px solid var(--border, #e5e7eb);
		background: var(--card-bg, white);
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
	}
	.code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 60%, 50%);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.code-toggle-btn-active {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%) !important;
		color: hsl(var(--theme-hue, 165), 70%, 45%) !important;
		background: color-mix(in srgb, hsl(var(--theme-hue, 165), 70%, 50%) 8%, transparent) !important;
	}
	:global(.dark) .code-toggle-btn {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.7);
	}
	:global(.dark) .code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 60%, 60%);
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}

	/* 配置卡片 */
	.config-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.config-card {
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: border-color 0.2s;
	}
	:global(.dark) .config-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.config-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.2);
	}

	.config-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		font-weight: 600;
		font-size: 15px;
	}
	:global(.dark) .config-card-header {
		border-bottom-color: rgba(255, 255, 255, 0.06);
	}
	.config-card-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.config-card-body {
		padding: 18px 20px;
	}

	/* 表单网格 */
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 14px;
	}
	.form-group-full {
		grid-column: 1 / -1;
	}

	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 5px;
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}

	.hue-value {
		font-weight: 700;
		margin-left: 6px;
		font-variant-numeric: tabular-nums;
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
		transition: border-color 0.2s, box-shadow 0.2s;
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
		min-height: 50px;
	}

	/* Hue 滑块 */
	.hue-slider-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.hue-slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			hsl(0, 70%, 50%),
			hsl(60, 70%, 50%),
			hsl(120, 70%, 50%),
			hsl(180, 70%, 50%),
			hsl(240, 70%, 50%),
			hsl(300, 70%, 50%),
			hsl(360, 70%, 50%)
		);
		outline: none;
		cursor: pointer;
	}
	.hue-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(165, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		transition: transform 0.15s;
	}
	.hue-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}
	.hue-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(165, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
	}
	.hue-preview-dot {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		flex-shrink: 0;
		border: 2px solid var(--border, rgba(0,0,0,0.1));
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
	}
	:global(.dark) .hue-preview-dot {
		border-color: rgba(255,255,255,0.15);
	}

	/* 复选框 */
	.form-check-group {
		display: flex;
		align-items: center;
	}
	.form-check-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text-color, #1f2937);
		margin-top: 20px;
		font-weight: 500;
	}
	:global(.dark) .form-check-label {
		color: #d1d5db;
	}
	.form-check {
		width: 18px;
		height: 18px;
		accent-color: hsl(var(--theme-hue, 165), 70%, 50%);
		cursor: pointer;
		border-radius: 4px;
	}

	/* 添加按钮 */
	.config-add-btn {
		margin-left: auto;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 12px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		border: 1.5px solid hsla(var(--theme-hue, 165), 70%, 50%, 0.4);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.08);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		transition: all 0.15s;
		font-family: inherit;
	}
	.config-add-btn:hover {
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}

	/* 配置提示文字 */
	.config-hint {
		margin: 0 0 12px;
		font-size: 12px;
		color: var(--content-meta, #6b7280);
		line-height: 1.5;
	}
	:global(.dark) .config-hint {
		color: #9ca3af;
	}

	/* 空状态提示 */
	.config-empty-hint {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 24px;
		color: var(--content-meta, #9ca3af);
		font-size: 13px;
		border-radius: 10px;
		border: 1.5px dashed var(--border, rgba(0,0,0,0.1));
	}

	/* ============ 导航栏链接管理器 ============ */
	.config-header-actions {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.config-btn-secondary {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 5px 12px;
		border-radius: 8px;
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		background: var(--btn-plain-bg, rgba(0,0,0,0.04));
		color: var(--text-secondary, #6b7280);
		font-size: 13px;
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.config-btn-secondary:hover {
		background: var(--btn-plain-bg-hover, rgba(0,0,0,0.08));
		color: var(--text-color, #1f2937);
	}

	.nav-groups {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.nav-group {
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		border-radius: 12px;
		overflow: hidden;
		background: var(--bg-secondary, rgba(0,0,0,0.015));
	}
	:global(.dark) .nav-group {
		border-color: rgba(255,255,255,0.06);
		background: rgba(255,255,255,0.015);
	}
	.nav-group-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 14px;
		background: var(--group-color);
		color: #fff;
		font-weight: 600;
		font-size: 13px;
	}
	.nav-group-header iconify-icon {
		font-size: 18px;
	}
	.nav-group-title {
		flex: 1;
	}
	.nav-group-count {
		background: rgba(255,255,255,0.25);
		padding: 1px 8px;
		border-radius: 10px;
		font-size: 11px;
		font-weight: 500;
		min-width: 22px;
		text-align: center;
	}
	.nav-group-add {
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 6px;
		background: rgba(255,255,255,0.2);
		color: #fff;
		cursor: pointer;
		font-size: 18px;
		transition: all 0.15s;
	}
	.nav-group-add:hover {
		background: rgba(255,255,255,0.35);
	}
	.nav-group-body {
		display: flex;
		flex-direction: column;
		padding: 6px;
		gap: 4px;
		min-height: 40px;
	}
	.nav-group-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 16px;
		color: var(--text-muted, #9ca3af);
		font-size: 12px;
	}
	.nav-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid transparent;
		background: var(--bg-color, #fff);
		transition: all 0.15s;
	}
	:global(.dark) .nav-item {
		background: rgba(255,255,255,0.03);
	}
	.nav-item:hover {
		border-color: var(--border, rgba(0,0,0,0.1));
		background: var(--bg-hover, rgba(0,0,0,0.02));
	}
	:global(.dark) .nav-item:hover {
		background: rgba(255,255,255,0.05);
		border-color: rgba(255,255,255,0.1);
	}
	.nav-item-custom {
		border-color: rgba(59,130,246,0.2);
		background: rgba(59,130,246,0.03);
	}
	:global(.dark) .nav-item-custom {
		border-color: rgba(59,130,246,0.3);
		background: rgba(59,130,246,0.06);
	}
	.nav-item-disabled {
		opacity: 0.55;
	}
	.nav-item-drag {
		color: var(--text-muted, #9ca3af);
		cursor: grab;
		font-size: 18px;
		display: flex;
		align-items: center;
		flex-shrink: 0;
	}
	.nav-item-icon {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: var(--bg-secondary, rgba(0,0,0,0.04));
		font-size: 18px;
		color: var(--text-secondary, #6b7280);
		flex-shrink: 0;
	}
	:global(.dark) .nav-item-icon {
		background: rgba(255,255,255,0.06);
	}
	.nav-item-main {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}
	.nav-item-name {
		font-size: 14px;
		font-weight: 500;
		color: var(--text-color, #1f2937);
	}
	.nav-item-badge {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 7px;
		border-radius: 6px;
		font-size: 11px;
		font-weight: 500;
		background: rgba(0,0,0,0.06);
		color: var(--text-muted, #6b7280);
		white-space: nowrap;
	}
	:global(.dark) .nav-item-badge {
		background: rgba(255,255,255,0.08);
		color: #9ca3af;
	}
	.nav-item-badge-warn {
		background: rgba(245,158,11,0.12);
		color: #d97706;
	}
	:global(.dark) .nav-item-badge-warn {
		background: rgba(245,158,11,0.15);
		color: #fbbf24;
	}
	.nav-custom-fields {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		flex: 1;
		align-items: center;
	}
	.nav-custom-input {
		flex: 1;
		min-width: 80px;
		padding: 4px 8px;
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		border-radius: 6px;
		font-size: 12px;
		background: var(--bg-color, #fff);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.15s;
	}
	:global(.dark) .nav-custom-input {
		background: rgba(0,0,0,0.2);
		border-color: rgba(255,255,255,0.1);
		color: #e5e7eb;
	}
	.nav-custom-input:focus {
		border-color: var(--primary, #14b8a6);
	}
	.nav-custom-input-sm {
		flex: 0 0 140px;
		min-width: 100px;
	}
	.nav-custom-check {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
		cursor: pointer;
		margin: 0 !important;
	}
	.nav-custom-check input {
		width: 14px;
		height: 14px;
		accent-color: var(--primary, #14b8a6);
	}
	.nav-item-controls {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}
	.nav-parent-select {
		padding: 4px 6px;
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		border-radius: 6px;
		font-size: 11px;
		background: var(--bg-color, #fff);
		color: var(--text-color, #1f2937);
		cursor: pointer;
		outline: none;
	}
	:global(.dark) .nav-parent-select {
		background: rgba(0,0,0,0.2);
		border-color: rgba(255,255,255,0.1);
		color: #e5e7eb;
	}
	.nav-item-btns {
		display: flex;
		gap: 2px;
	}
	.nav-ctrl-btn {
		width: 28px;
		height: 28px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--text-muted, #9ca3af);
		cursor: pointer;
		font-size: 17px;
		transition: all 0.15s;
	}
	.nav-ctrl-btn:hover:not(:disabled) {
		background: var(--btn-plain-bg-hover, rgba(0,0,0,0.08));
		color: var(--text-color, #1f2937);
	}
	.nav-ctrl-btn:disabled {
		opacity: 0.25;
		cursor: not-allowed;
	}
	.nav-ctrl-btn-danger:hover:not(:disabled) {
		background: rgba(239,68,68,0.1) !important;
		color: #ef4444 !important;
	}
	.nav-ctrl-btn-active {
		color: var(--primary, #14b8a6) !important;
		background: rgba(20,184,166,0.1) !important;
	}

	/* 页面开关网格 */
	.pages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 8px;
	}
	.page-toggle-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border, rgba(0,0,0,0.06));
		background: var(--bg-color, #fafafa);
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.dark) .page-toggle-item {
		background: rgba(255,255,255,0.03);
		border-color: rgba(255,255,255,0.06);
	}
	.page-toggle-item:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		background: color-mix(in srgb, hsl(var(--theme-hue, 165), 70%, 50%) 5%, transparent);
	}
	.page-toggle-off {
		opacity: 0.6;
	}
	.page-toggle-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-color, #1f2937);
		flex: 1;
	}
	:global(.dark) .page-toggle-label {
		color: #d1d5db;
	}
	.page-toggle-key {
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		font-family: monospace;
	}

	/* 代码编辑器 */
	.code-editor-wrap {
		padding: 16px 20px;
	}
	.code-textarea {
		width: 100%;
		min-height: 500px;
		padding: 14px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 10px;
		font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
		font-size: 13px;
		line-height: 1.6;
		background: var(--bg-color, #fafafa);
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
		tab-size: 2;
		box-sizing: border-box;
		white-space: pre;
		overflow: auto;
	}
	:global(.dark) .code-textarea {
		background: #0d0d18;
		border-color: #374151;
		color: #e5e7eb;
	}
	.code-textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
</style>
