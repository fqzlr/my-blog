const fs = require("fs");
let c = fs.readFileSync("src/constants/link-presets.ts", "utf8");
c = c.replace("};", `	[LinkPreset.Books]: {
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
	},
};`);
fs.writeFileSync("src/constants/link-presets.ts", c, "utf8");
console.log("2 done");
