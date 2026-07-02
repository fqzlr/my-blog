// 此文件由编辑器自动生成，请勿手动修改

export interface MomentItem {
	id: string;
	content: string;
	published: string;
	images: string[];
	tags: string[];
	location?: string;
	pinned: boolean;
	author: string;
	avatar: string;
}

export const momentsPageConfig = {
	enable: true,
	editable: true,
};

export const momentsConfig: MomentItem[] = [
	{
		id: "wx-1782900912669-lojlca",
		content: "44444顶顶顶",
		published: "2026-07-01T10:15:12.669Z",
		images: [],
		tags: [],
		pinned: false,
		author: "fqzlr",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},
	{
		id: "wx-1782895892505-dvcpb2",
		content: "55555555555",
		published: "2026-07-01T08:51:32.505Z",
		images: [],
		tags: [],
		pinned: false,
		author: "fqzlr",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},
	{
		id: "wx-1782894586318-o75i6w",
		content: "测试2",
		published: "2026-07-01T08:29:46.318Z",
		images: [],
		tags: [],
		pinned: false,
		author: "fqzlr",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},
	{
		id: "wx-test-20260701",
		content: "测试",
		published: "2026-07-01T00:00:00.000Z",
		images: [],
		tags: ["测试"],
		location: "测试",
		pinned: false,
		author: "fqzlr",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},
	{
		id: "wx-note-20260510",
		content: "笔记命名就是title属性\n其他采用功能属性+日期的方式",
		published: "2026-05-10T00:00:00.000Z",
		images: [],
		tags: ["想法"],
		location: "河南-郑州",
		pinned: false,
		author: "番茄主理人",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
	},
];
