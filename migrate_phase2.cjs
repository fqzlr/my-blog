const fs = require("fs");

// 1. i18nKey.ts - Add new keys after navMy
let i18nKey = fs.readFileSync("src/i18n/i18nKey.ts", "utf8");
const newKeys = `
	books = "books",
	moviesGames = "moviesGames",
	musicPage = "musicPage",
	changelog = "changelog",
	moments = "moments",
	admin = "admin",
	routines = "routines",
	places = "places",
	notebooks = "notebooks",

	bookshelf = "bookshelf",
	music = "music",
	adminPanel = "adminPanel",`;
i18nKey = i18nKey.replace("navMy = \"navMy\",", "navMy = \"navMy\"," + newKeys);
fs.writeFileSync("src/i18n/i18nKey.ts", i18nKey, "utf8");
console.log("i18nKey.ts done");

// 2. link-presets.ts - Add new LinkPreset entries
let linkPresets = fs.readFileSync("src/constants/link-presets.ts", "utf8");
const newPresets = `
	[LinkPreset.Books]: {
		name: i18n(I18nKey.bookshelf),
		url: "/books/",
		icon: "material-symbols:book-5",
	},
	[LinkPreset.MoviesGames]: {
		name: i18n(I18nKey.moviesGames),
		url: "/movies-games/",
		icon: "material-symbols:movie",
	},
	[LinkPreset.MusicPage]: {
		name: i18n(I18nKey.musicPage),
		url: "/music/",
		icon: "material-symbols:music-note",
	},
	[LinkPreset.Changelog]: {
		name: i18n(I18nKey.changelog),
		url: "/changelog/",
		icon: "material-symbols:history",
	},
	[LinkPreset.Moments]: {
		name: i18n(I18nKey.moments),
		url: "/moments/",
		icon: "material-symbols:local-cafe",
	},
	[LinkPreset.Admin]: {
		name: i18n(I18nKey.adminPanel),
		url: "/admin/",
		icon: "material-symbols:admin-panel-settings",
	},
	[LinkPreset.Routines]: {
		name: i18n(I18nKey.routines),
		url: "/life/routines/",
		icon: "material-symbols:list-alt",
	},
	[LinkPreset.Places]: {
		name: i18n(I18nKey.places),
		url: "/life/places/",
		icon: "material-symbols:location-on",
	},
	[LinkPreset.Notebooks]: {
		name: i18n(I18nKey.notebooks),
		url: "/life/notebooks/",
		icon: "material-symbols:menu-book",
	},`;
linkPresets = linkPresets.replace("NavMy = 19,", "NavMy = 19," + newPresets);
// Actually insert before the closing };
const lastBrace = linkPresets.lastIndexOf("};");
linkPresets = linkPresets.slice(0, lastBrace) + newPresets + linkPresets.slice(lastBrace);
fs.writeFileSync("src/constants/link-presets.ts", linkPresets, "utf8");
console.log("link-presets.ts done");

// Wait, let me redo link-presets properly
linkPresets = fs.readFileSync("src/constants/link-presets.ts", "utf8");
// Remove what we just added
const closingIdx = linkPresets.lastIndexOf("};");
linkPresets = linkPresets.slice(0, closingIdx) + linkPresets.slice(closingIdx);
// Now add properly before the closing
linkPresets = fs.readFileSync("src/constants/link-presets.ts", "utf8");
// Find the line with [LinkPreset.NavMy] and add after it
linkPresets = linkPresets.replace(
  "};",
  newPresets + "\n};"
);
fs.writeFileSync("src/constants/link-presets.ts", linkPresets, "utf8");
console.log("link-presets.ts done correctly");

console.log("Phase 2 base config done");
