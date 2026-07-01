import type { SponsorConfig } from "../types/config";

export const sponsorConfig: SponsorConfig = {
	title: "赞助",

	description: "感谢您的支持，您的赞助将帮助我持续创作优质内容",

	usage: "",

	showSponsorsList: true,

	showComment: true,

	showButtonInPost: true,

	methods: [
		{
			name: "爱发电",
			enabled: false,
		},
		{
			name: "微信支付",
			qrCode: "/assets/images/wechat.png",
			enabled: true,
		},
		{
			name: "支付宝支付",
			qrCode: "/assets/images/alipay.png",
			enabled: true,
		},
	],

	sponsors: [
		{
			name: "番茄主理人",
			avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
			amount: "¥50",
			date: "10/1/2025",
		},
		{
			name: "214556787",
			avatar: "https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640",
			amount: "¥1",
			date: "10/1/2025",
		},
		{
			name: "哈基墩",
			avatar: "https://i.stardots.io/784774835/StarDots-2026060803504474780.png",
			amount: "¥0.01",
			date: "1/1/2026",
		},
	],
};
