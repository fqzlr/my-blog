const fs = require("fs");

// zh_CN.ts - add translations after navMy entry
let c = fs.readFileSync("src/i18n/languages/zh_CN.ts", "utf8");
const zhKeys = `	[Key.bookshelf]: "书架",
	[Key.moviesGames]: "影视游戏",
	[Key.musicPage]: "音乐",
	[Key.changelog]: "更新日志",
	[Key.moments]: "动态",
	[Key.routines]: "日常规划",
	[Key.places]: "旅行足迹",
	[Key.notebooks]: "笔记本",
	[Key.adminPanel]: "后台管理",

	[Key.books]: "书籍",
	[Key.admin]: "管理",`;
c = c.replace("[Key.navMy]:", zhKeys + "\n\n\t[Key.navMy]:");
fs.writeFileSync("src/i18n/languages/zh_CN.ts", c, "utf8");
console.log("zh_CN done");

// en.ts
let e = fs.readFileSync("src/i18n/languages/en.ts", "utf8");
const enKeys = `	[Key.bookshelf]: "Bookshelf",
	[Key.moviesGames]: "Movies & Games",
	[Key.musicPage]: "Music",
	[Key.changelog]: "Changelog",
	[Key.moments]: "Moments",
	[Key.routines]: "Routines",
	[Key.places]: "Places",
	[Key.notebooks]: "Notebooks",
	[Key.adminPanel]: "Admin Panel",

	[Key.books]: "Books",
	[Key.admin]: "Admin",`;
e = e.replace("[Key.navMy]:", enKeys + "\n\n\t[Key.navMy]:");
fs.writeFileSync("src/i18n/languages/en.ts", e, "utf8");
console.log("en done");
