import type { FriendLink, FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,

	// 友链申请链接，填写后会在友链页面显示申请按钮
	// 使用模板参数直接跳转到友链申请模板
	applyLink:
		"https://github.com/fqzlr/my-blog/issues/new?template=friend-link.yml",

	// 本站信息，用于友链申请指南弹窗中的站点信息展示
	siteInfo: {
		name: "fqzlr",
		desc: "躬身入局，心为主理，行有尺度，自持本心",
		url: "https://fqzlr.com",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		email: "20447289@qq.com",
	},

	// 注意事项，用于友链申请指南弹窗中的注意事项展示
	notes: [
		{
			title: "互换原则",
			content: "请先将本站添加到您的友链页面，确认后会添加您的友链",
		},
		{
			title: "链接维护",
			content: "友链网站长期无法访问或内容违规，将会被移除",
		},
		{
			title: "内容要求",
			content: "内容积极向上，不含有任何含色情/反动/暴力等违法违规内容",
		},
		{
			title: "站点要求",
			content: "支持 HTTPS，以原创内容为主，能够正常访问且有持续更新",
		},
	],
};

// 友链配置
export const friendsConfig: FriendLink[] = [
		{
		  "title": "番茄主理人",
		  "imgurl": "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		  "desc": "坐而言不如起而行.",
		  "siteurl": "https://fqzlr.com/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "夏夜流萤",
		  "imgurl": "https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
		  "desc": "飞萤之火自无梦的长夜亮起，绽放在终竟的明天。",
		  "siteurl": "https://blog.cuteleaf.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "椰汁の主页",
		  "imgurl": "https://free.picui.cn/free/2026/03/23/69c12fe83f7a4.jpg",
		  "desc": "关关难过关关过,前路漫漫亦灿灿.",
		  "siteurl": "https://home.132614.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "UpXuu",
		  "imgurl": "https://upxuu.com/images/20260214145619.jpg",
		  "desc": "逐光而上！",
		  "siteurl": "https://upxuu.com/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "Re.Y.Ju.hao | 个人主页",
		  "imgurl": "https://img.cdn1.vip/i/69f03a1c79908_1777351196.webp",
		  "desc": "先活着吧，其他的再想想",
		  "siteurl": "http://irehao.42web.io/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "大熊",
		  "imgurl": "https://halo.aizaibao.cn/upload/%E5%A4%B4%E5%83%8F-AHbr.jpg",
		  "desc": "日常随笔与灵感收集小角落",
		  "siteurl": "https://halo.aizaibao.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "xf_blog",
		  "imgurl": "https://github.com/xfcnl/xfcnl.github.io/blob/main/image/MEITU_20260128_220225596.jpg?raw=true",
		  "desc": "立志用 cloudflare workers，GitHub pages 和 vercel 做出整个互联网的up（虽然不会成功",
		  "siteurl": "https://xfcnl.github.io/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "年华",
		  "imgurl": "https://q1.qlogo.cn/g?b=qq&nk=1323860289&s=640",
		  "desc": "分享生活和技术。",
		  "siteurl": "https://blog.520781.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "团子和蛋糕",
		  "imgurl": "https://re.tsh520.cn/zl/tx.webp",
		  "desc": "如果你喜欢那么欢迎来到我的世界！",
		  "siteurl": "https://blog.tsh520.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "yukino",
		  "imgurl": "https://tu.ztyukino.com/file/1778322126543_%E5%BE%AE%E4%BF%A1%E5%9B%BE%E7%89%87_2026-05-09_182135_917.jpg",
		  "desc": "一个现充的个人博客网站！",
		  "siteurl": "https://blog.ztyukino.com/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "king-blog",
		  "imgurl": "https://pan.lingview.xyz/d/%E9%9B%A8%E4%BA%91%E8%8A%82%E7%82%B9/%E5%9B%BE%E5%BA%93/%E5%A4%A9%E4%BE%9D/Image_1721230292906.png?sign=JU30z6z_RsZ3Vv7HB_5D3msYRneiga5NLjhN3EpL-3w=:0",
		  "desc": "这是一个很随便的网站",
		  "siteurl": "https://www.888721.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "Mizuki Docs",
		  "imgurl": "https://i.stardots.io/784774835/StarDots-2026052116374135506.jpg",
		  "desc": "Mizuki User Manual",
		  "siteurl": "https://docs.mizuki.mysqil.com/",
		  "tags": [
		    "Docs"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "冬月",
		  "imgurl": "https://dongyue.org/avatar.webp",
		  "desc": "分享自己的一些学习心得和生活琐事",
		  "siteurl": "https://dongyue.org/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "ZSSO",
		  "imgurl": "https://z.wiki/u/bV2PV5yR9",
		  "desc": "一步一印，自成风景。",
		  "siteurl": "https://www.zsso.net/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "versus0",
		  "imgurl": "https://img.542000.xyz/file/friend_avatar/1778931720838_f167cb95af9d881f4378b92b3e181d89_4647054993754934443.jpg",
		  "desc": "技术个人博客",
		  "siteurl": "https://blog.542000.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "星遐蝶梦",
		  "imgurl": "https://blog.casto.top/assets/images/icon.png",
		  "desc": "星穹漫遐，蝶携清梦。",
		  "siteurl": "https://blog.casto.top/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "晴宙",
		  "imgurl": "https://pilvocmbhhgywprdywkx.supabase.co/storage/v1/object/public/images/avatar/avatar.jpg",
		  "desc": "保持热爱，持续创造",
		  "siteurl": "https://qingzhou.dpdns.org/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "Saimen blog",
		  "imgurl": "https://img.z2m.store/file/1779081943822_butterfly-icon.png",
		  "desc": "读史可以明智,知古方能鉴今",
		  "siteurl": "https://com.z2m.store/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "MmzMing的知识库",
		  "imgurl": "https://i.stardots.io/784774835/StarDots-2026052116374135506.jpg",
		  "desc": "哈基米，南北绿豆",
		  "siteurl": "https://tblog.mmzhiku.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "miuo",
		  "imgurl": "https://blog.miuo.me/avatar.avif",
		  "desc": "记录文章、笔记、实验和暂时不想丢掉的内容。",
		  "siteurl": "https://blog.miuo.me/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "my.vueko",
		  "imgurl": "https://q1.qlogo.cn/g?b=qq&nk=2710155768&s=640",
		  "desc": "来了",
		  "siteurl": "https://vuekoo.com/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "YFBLOG - 幻新至简",
		  "imgurl": "https://cdn.yfblog.asia/image/favicon.ico",
		  "desc": "随手笔记，技术心得分享.",
		  "siteurl": "https://yfblog.asia/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "十三",
		  "imgurl": "https://img.nw177.cn/blog/100.assets/avatar.webp",
		  "desc": "欲买桂花同载酒，终不似，少年游。",
		  "siteurl": "https://blog.nw177.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "ZhiJing’s Blog",
		  "imgurl": "https://iwexe.top/avatar.svg",
		  "desc": "Go with the flow.",
		  "siteurl": "https://iwexe.top/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "Sigrika-善良耙耙柑🍊",
		  "imgurl": "https://weavatar.com/avatar/bc0dba25ea5949e8290d012e081ceec669aa7784c7ad765173473c80cbaee404:tv_%E5%A4%A7%E5%93%AD",
		  "desc": "记录我的二次元之旅",
		  "siteurl": "https://qwq.sigrika.cc/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "L!!!!ght",
		  "imgurl": "https://easyimg.kejk.cn/i/4484873c-c2cc-4b3d-bc35-5c72ed01cfd9.webp",
		  "desc": "阳光正好，慢慢前行。",
		  "siteurl": "https://sunlight.kejk.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "拾光の博客",
		  "imgurl": "https://weavatar.com/api/avatar/ff2a232e034fb7677c9f211c5979619f3f4818302ae2cf2a11ea74af530e7758?s=50&t=1780753762637",
		  "desc": "拾取散落的时光碎片",
		  "siteurl": "https://mistfly.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "冰汐梦",
		  "imgurl": "https://tu.irier0023.xyz/file/1780921907488_avatar.avif",
		  "desc": "当所有剑都归鞘时，真正的较量才刚刚开始——那是人心与天地的对弈。",
		  "siteurl": "https://blog.irier0023.xyz/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "ysdy~Blog",
		  "imgurl": "https://i.stardots.io/366046882645/StarDots-2026052814483375536.png",
		  "desc": "人生苦短，摆烂优先",
		  "siteurl": "https://ysdyblog.ccwu.cc/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "风起",
		  "imgurl": "https://blog.windstart.top/_astro/xiao.DZR3cwiW_1XI6Uv.webp",
		  "desc": "无善无恶心之体，有善有恶意之动",
		  "siteurl": "https://blog.windstart.top/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "小生",
		  "imgurl": "https://t.alcy.cc/tx",
		  "desc": "天生我材必有用，千金散尽还复来。",
		  "siteurl": "https://www.zsso.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "Hyde Blog",
		  "imgurl": "https://seasir.top/assets/avatar.avif",
		  "desc": "人心中的成见是一座大山",
		  "siteurl": "https://seasir.top/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "ZSSO",
		  "imgurl": "https://t.alcy.cc/tx",
		  "desc": "天生我材必有用，千金散尽还复来。",
		  "siteurl": "https://www.zsso.cn/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "gc的小站",
		  "imgurl": "https://www.gcweb.cc/static/img/pig.jpg",
		  "desc": "综合性网站，希望对你有帮助",
		  "siteurl": "https://gcweb.cc/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
		{
		  "title": "他说",
		  "imgurl": "https://090909.top/assets/images/logo.ico",
		  "desc": "梁栋烨的博客网站。",
		  "siteurl": "https://090909.top/",
		  "tags": [
		    "Blog"
		  ],
		  "weight": 10,
		  "enabled": true
		},
	];

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
