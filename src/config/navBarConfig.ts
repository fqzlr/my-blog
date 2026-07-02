import { LinkPresets } from "../constants/link-presets";
import {
	LinkPreset,
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/config";
import { siteConfig } from "./siteConfig";

/**
 * 预设链接的key到LinkPreset枚举的映射
 * key名称与LinkPreset枚举名小写一致（用于配置编辑器中的标识）
 */
const PRESET_KEY_MAP: Record<string, LinkPreset> = {
	home: LinkPreset.Home,
	archive: LinkPreset.Archive,
	about: LinkPreset.About,
	friends: LinkPreset.Friends,
	sponsor: LinkPreset.Sponsor,
	guestbook: LinkPreset.Guestbook,
	bangumi: LinkPreset.Bangumi,
	gallery: LinkPreset.Gallery,
	collections: LinkPreset.Collections,
	stats: LinkPreset.Stats,
	calendar: LinkPreset.Calendar,
	categories: LinkPreset.Categories,
	tags: LinkPreset.Tags,
	postlist: LinkPreset.PostList,
	fhome: LinkPreset.Fhome,
	contactme: LinkPreset.ContactMe,
	qqgroup: LinkPreset.QQGroup,
	navposts: LinkPreset.NavPosts,
	navmy: LinkPreset.NavMy,
	fnote: LinkPreset.Fnote,
	books: LinkPreset.Books,
	moviesgames: LinkPreset.MoviesGames,
	musicpage: LinkPreset.MusicPage,
	changelog: LinkPreset.Changelog,
	moments: LinkPreset.Moments,
	admin: LinkPreset.Admin,
	routines: LinkPreset.Routines,
	places: LinkPreset.Places,
	notebooks: LinkPreset.Notebooks,
};

/**
 * 根据页面开关，获取某个预设链接是否可用（是否应出现在导航中）
 * 注意：home/navposts/navmy 等总是可用；其余受 siteConfig.pages 控制
 */
function isPresetAvailable(key: string): boolean {
	switch (key) {
		case "home":
		case "archive":
		case "categories":
		case "postlist":
		case "navposts":
		case "navmy":
		case "contactme":
		case "qqgroup":
		case "about":
		case "fhome":
		case "fnote":
			return true;
		case "collections":
			return !!siteConfig.pages.collections;
		case "friends":
			return !!siteConfig.pages.friends;
		case "guestbook":
			return !!siteConfig.pages.guestbook;
		case "sponsor":
			return !!siteConfig.pages.sponsor;
		case "bangumi":
			return !!siteConfig.pages.bangumi;
		case "gallery":
			return !!siteConfig.pages.gallery;
		case "calendar":
			return !!siteConfig.pages.calendar;
		case "books":
			return !!siteConfig.pages.books;
		case "moviesgames":
			return !!siteConfig.pages.moviesGames;
		case "musicpage":
			return !!siteConfig.pages.musicPage;
		case "changelog":
			return !!siteConfig.pages.changelog;
		case "moments":
			return !!siteConfig.pages.moments;
		case "routines":
			return !!siteConfig.pages.lifeRoutines;
		case "places":
			return !!siteConfig.pages.lifePlaces;
		case "notebooks":
			return !!siteConfig.pages.lifeNotebooks;
		default:
			return true;
	}
}

/**
 * 获取预设链接的显示名称
 */
function getPresetDisplayName(key: string): string {
	const lp = PRESET_KEY_MAP[key];
	if (lp !== undefined) {
		return LinkPresets[lp].name;
	}
	return key;
}

/**
 * 获取预设链接的图标
 */
function getPresetIcon(key: string): string | undefined {
	const lp = PRESET_KEY_MAP[key];
	if (lp !== undefined) {
		return LinkPresets[lp].icon;
	}
	return undefined;
}

/**
 * 默认导航项顺序（当没有 navItems 配置时使用）
 * 这是默认的导航结构
 */
function getDefaultNavItems(): { id: string; type: "preset" | "custom"; parent: "top" | "posts" | "contact" | "my" | "hidden" }[] {
	const items: { id: string; type: "preset" | "custom"; parent: "top" | "posts" | "contact" | "my" | "hidden" }[] = [];

	// 顶级导航
	items.push({ id: "home", type: "preset", parent: "top" });
	if (isPresetAvailable("collections")) items.push({ id: "collections", type: "preset", parent: "top" });

	// 文章下拉（下拉头本身不算items，其children是posts组）
	items.push({ id: "archive", type: "preset", parent: "posts" });
	items.push({ id: "categories", type: "preset", parent: "posts" });
	items.push({ id: "postlist", type: "preset", parent: "posts" });

	// 联系我下拉
	if (isPresetAvailable("friends")) items.push({ id: "friends", type: "preset", parent: "contact" });
	if (isPresetAvailable("guestbook")) items.push({ id: "guestbook", type: "preset", parent: "contact" });
	items.push({ id: "qqgroup", type: "preset", parent: "contact" });

	// 我的下拉
	if (isPresetAvailable("fhome")) items.push({ id: "fhome", type: "preset", parent: "my" });
	if (isPresetAvailable("fnote")) items.push({ id: "fnote", type: "preset", parent: "my" });
	if (isPresetAvailable("calendar")) items.push({ id: "calendar", type: "preset", parent: "my" });
	if (isPresetAvailable("bangumi")) items.push({ id: "bangumi", type: "preset", parent: "my" });
	if (isPresetAvailable("books")) items.push({ id: "books", type: "preset", parent: "my" });
	if (isPresetAvailable("moviesgames")) items.push({ id: "moviesgames", type: "preset", parent: "my" });
	if (isPresetAvailable("musicpage")) items.push({ id: "musicpage", type: "preset", parent: "my" });
	if (isPresetAvailable("changelog")) items.push({ id: "changelog", type: "preset", parent: "my" });
	if (isPresetAvailable("moments")) items.push({ id: "moments", type: "preset", parent: "my" });
	if (isPresetAvailable("routines")) items.push({ id: "routines", type: "preset", parent: "my" });
	if (isPresetAvailable("places")) items.push({ id: "places", type: "preset", parent: "my" });
	if (isPresetAvailable("notebooks")) items.push({ id: "notebooks", type: "preset", parent: "my" });
	if (isPresetAvailable("gallery")) items.push({ id: "gallery", type: "preset", parent: "my" });
	if (isPresetAvailable("sponsor")) items.push({ id: "sponsor", type: "preset", parent: "my" });
	items.push({ id: "about", type: "preset", parent: "my" });

	return items;
}

/**
 * 构建导航栏链接配置
 *
 * 支持两种模式：
 * 1. 默认模式（无navItems配置）：按代码硬编码的默认顺序构建
 * 2. 自定义模式（有navItems配置）：根据配置完全控制导航结构，支持：
 *    - 移动预设链接到不同分组
 *    - 隐藏/显示链接
 *    - 调整链接顺序
 *    - 添加自定义链接
 */
const buildNavBarConfig = (): NavBarConfig => {
	const navItemsConfig = siteConfig.navbar?.navItems;

	// 如果没有自定义导航配置，使用默认结构（向后兼容旧版customLinks）
	if (!navItemsConfig || navItemsConfig.length === 0) {
		return buildDefaultNavBarConfig();
	}

	// 按分组收集链接
	const topItems: (NavBarLink | LinkPreset)[] = [];
	const postsChildren: (NavBarLink | LinkPreset)[] = [];
	const contactChildren: (NavBarLink | LinkPreset)[] = [];
	const myChildren: (NavBarLink | LinkPreset)[] = [];

	for (const item of navItemsConfig) {
		if (item.parent === "hidden") continue;

		let link: NavBarLink | LinkPreset;
		if (item.type === "preset") {
			const lp = PRESET_KEY_MAP[item.id];
			if (lp === undefined) continue;
			// 页面未启用的预设链接跳过
			if (!isPresetAvailable(item.id)) continue;
			link = lp;
		} else {
			// 自定义链接
			if (!item.name || !item.url) continue;
			const customLink: NavBarLink = {
				name: item.name,
				url: item.url,
				external: item.external ?? item.url.startsWith("http"),
				icon: item.icon,
			};
			link = customLink;
		}

		switch (item.parent) {
			case "top":
				// home总是在顶级导航的最前面
				if (item.id === "home") {
					topItems.unshift(link);
				} else {
					topItems.push(link);
				}
				break;
			case "posts":
				postsChildren.push(link);
				break;
			case "contact":
				contactChildren.push(link);
				break;
			case "my":
				myChildren.push(link);
				break;
		}
	}

	// 构建文章下拉（仅当有子项时）
	const postsNav: NavBarLink | null =
		postsChildren.length > 0
			? { ...LinkPresets[LinkPreset.NavPosts], children: postsChildren }
			: null;

	// 构建联系我下拉（仅当有子项时）
	const contactNav: NavBarLink | null =
		contactChildren.length > 0
			? { ...LinkPresets[LinkPreset.ContactMe], children: contactChildren }
			: null;

	// 构建我的下拉（总是存在）
	const myNav: NavBarLink = {
		...LinkPresets[LinkPreset.NavMy],
		children: myChildren,
	};

	// 组装顶级导航链接
	const links: (NavBarLink | LinkPreset)[] = [];
	// 先放顶级链接（home已在最前）
	for (const item of topItems) {
		links.push(item);
	}
	// 文章下拉
	if (postsNav) links.push(postsNav);
	// 联系我下拉
	if (contactNav) links.push(contactNav);
	// 我的下拉
	links.push(myNav);

	return { links };
};

/**
 * 默认导航栏构建（无自定义navItems时使用）
 * 同时兼容旧版 customLinks 配置
 */
function buildDefaultNavBarConfig(): NavBarConfig {
	// 兼容旧版 customLinks
	const customLinks = (siteConfig.navbar as { customLinks?: { name: string; url: string; icon?: string; external?: boolean; parent?: string }[] })?.customLinks || [];
	const customTopLinks: NavBarLink[] = [];
	const customPostsLinks: NavBarLink[] = [];
	const customContactLinks: NavBarLink[] = [];
	const customMyLinks: NavBarLink[] = [];

	for (const cl of customLinks) {
		if (!cl.name || !cl.url) continue;
		const link: NavBarLink = {
			name: cl.name,
			url: cl.url,
			external: cl.external ?? cl.url.startsWith("http"),
			icon: cl.icon,
		};
		const parent = cl.parent || "my";
		if (parent === "top") customTopLinks.push(link);
		else if (parent === "posts") customPostsLinks.push(link);
		else if (parent === "contact") customContactLinks.push(link);
		else customMyLinks.push(link);
	}

	// 1. 构建文章下拉菜单
	const postsNav: NavBarLink = {
		...LinkPresets[LinkPreset.NavPosts],
		children: [LinkPreset.Archive, LinkPreset.Categories, LinkPreset.PostList, ...customPostsLinks],
	};

	// 2. 构建联系我下拉菜单
	const contactChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.friends) {
		contactChildren.push(LinkPreset.Friends);
	}
	if (siteConfig.pages.guestbook) {
		contactChildren.push(LinkPreset.Guestbook);
	}
	contactChildren.push(LinkPreset.QQGroup);
	contactChildren.push(...customContactLinks);

	const contactNav: NavBarLink | null =
		contactChildren.length > 0
			? {
					...LinkPresets[LinkPreset.ContactMe],
					children: contactChildren,
				}
			: null;

	// 3. 构建我的下拉菜单
	const myChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Fhome);
	}
	if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Fnote);
	}
	if (siteConfig.pages.calendar) {
		myChildren.push(LinkPreset.Calendar);
	}
	if (siteConfig.pages.bangumi) {
		myChildren.push(LinkPreset.Bangumi);
	}
	if (siteConfig.pages.books) {
		myChildren.push(LinkPreset.Books);
	}
	if (siteConfig.pages.moviesGames) {
		myChildren.push(LinkPreset.MoviesGames);
	}
	if (siteConfig.pages.musicPage) {
		myChildren.push(LinkPreset.MusicPage);
	}
	if (siteConfig.pages.changelog) {
		myChildren.push(LinkPreset.Changelog);
	}
	if (siteConfig.pages.moments) {
		myChildren.push(LinkPreset.Moments);
	}
	if (siteConfig.pages.lifeRoutines) {
		myChildren.push(LinkPreset.Routines);
	}
	if (siteConfig.pages.lifePlaces) {
		myChildren.push(LinkPreset.Places);
	}
	if (siteConfig.pages.lifeNotebooks) {
		myChildren.push(LinkPreset.Notebooks);
	}
	if (siteConfig.pages.gallery) {
		myChildren.push(LinkPreset.Gallery);
	}
	if (siteConfig.pages.sponsor) {
		myChildren.push(LinkPreset.Sponsor);
	}
	myChildren.push(...customMyLinks);
	myChildren.push(LinkPreset.About);

	const myNav: NavBarLink = {
		...LinkPresets[LinkPreset.NavMy],
		children: myChildren,
	};

	// 4. 统一组装导航栏链接
	const links: (NavBarLink | LinkPreset)[] = [
		LinkPreset.Home,
		...customTopLinks,
		postsNav,
		...(siteConfig.pages.collections ? [LinkPreset.Collections] : []),
		...(contactNav ? [contactNav] : []),
		myNav,
	];

	return { links };
}

// 导出辅助函数供ConfigEditor使用
export { PRESET_KEY_MAP, isPresetAvailable, getPresetDisplayName, getPresetIcon, getDefaultNavItems };

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = buildNavBarConfig();
