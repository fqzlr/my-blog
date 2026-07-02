import {
	LinkPreset,
	type NavBarConfig,
	type NavBarLink,
	type NavBarSearchConfig,
	NavBarSearchMethod,
} from "../types/config";
import { siteConfig } from "./siteConfig";

// 根据页面开关动态生成导航栏配置
const getDynamicNavBarConfig = (): NavBarConfig => {
	// 基础导航栏链接
	const links: (NavBarLink | LinkPreset)[] = [
		// 主页
		LinkPreset.Home,

		// 文章（带下拉子菜单）
		{
			name: "文章",
			url: "/posts/",
			icon: "material-symbols:article",
			children: [
				// 文章列表
				LinkPreset.Posts,

				// 文章分类
				{
					name: "分类",
					url: "/categories/",
					icon: "material-symbols:folder-open",
				},

				// 归档
				LinkPreset.Archive,
			],
		},

		// 网站导航
		{
			name: "网站导航",
			url: "/projects/",
			icon: "material-symbols:public",
		},
	];

	// 动态（带下拉子菜单）
	links.push({
		name: "动态",
		url: "/moments/",
		icon: "material-symbols:local-cafe",
		children: [
			{
				name: "说说",
				url: "/moments/",
				icon: "material-symbols:chat-bubble-outline",
			},
			{
				name: "相册",
				url: "/album/",
				icon: "material-symbols:photo-album-outline",
			},
			{
				name: "留言板",
				url: "/guestbook/",
				icon: "material-symbols:edit-outline",
			},
			{
				name: "笔记本",
				url: "/life/notebooks/",
				icon: "material-symbols:menu-book-outline",
			},
		],
	});

	// 记录入口 - 书架、影视与游戏、音乐、规划、足迹
	const recordChildren: (NavBarLink | LinkPreset)[] = [];
	if (siteConfig.pages.books) {
		recordChildren.push(LinkPreset.Books);
	}
	if (siteConfig.pages.moviesGames) {
		recordChildren.push(LinkPreset.MoviesGames);
	}
	if (siteConfig.pages.musicPage) {
		recordChildren.push(LinkPreset.MusicPage);
	}
	if (siteConfig.pages.changelog) {
		recordChildren.push(LinkPreset.Changelog);
	}
	// 规划 & 足迹
	recordChildren.push({
		name: "规划",
		url: "/life/routines/",
		icon: "material-symbols:list-alt",
	});
	recordChildren.push({
		name: "足迹",
		url: "/life/places/",
		icon: "material-symbols:location-on",
	});

	if (recordChildren.length > 0) {
		const defaultUrl = siteConfig.pages.books
			? "/books/"
			: siteConfig.pages.moviesGames
				? "/movies-games/"
				: "/music/";

		links.push({
			name: "记录",
			url: defaultUrl,
			icon: "material-symbols:camera-outdoor",
			children: recordChildren,
		});
	}

	// 关于及其子菜单
	links.push({
		name: "关于",
		url: "/about/",
		icon: "material-symbols:info",
		children: [
			// 关于页面
			LinkPreset.About,

			// 友链
			LinkPreset.Friends,

			// 赞助
			...(siteConfig.pages.sponsor ? [LinkPreset.Sponsor] : []),
		],
	});

	// 仅返回链接，其它导航搜索相关配置在模块顶层常量中独立导出
	return { links } as NavBarConfig;
};

// 导航搜索配置
export const navBarSearchConfig: NavBarSearchConfig = {
	method: NavBarSearchMethod.PageFind,
};

export const navBarConfig: NavBarConfig = getDynamicNavBarConfig();
