import type { AnnouncementConfig } from "../types/config";

export const announcementConfig: AnnouncementConfig = {
	// 公告标题
	title: "公告",

	// 公告列表
	items: [
		{
			tag: "欢迎",
			title: "关于我的介绍",
			content:
				"欢迎来到我的博客。",
			time: "2025-06-01",
			link: "/about/",
			sort: 1,
		},
		// {
		// 	tag: "友链",
		// 	title: "互换友链",
		// 	content: "正在招募技术类博客友链，要求原创、稳定更新。点击了解更多。",
		// 	time: "2025-06-05",
		// 	link: "/friends/",
		// 	sort: 4,
		// },
	],

	// 是否允许用户关闭公告
	closable: true,
};
