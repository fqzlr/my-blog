import I18nKey from "../i18n/i18nKey";
import { i18n } from "../i18n/translation";
import { LinkPreset, type NavBarLink } from "../types/config";

export const LinkPresets: { [key in LinkPreset]: NavBarLink } = {
	[LinkPreset.Home]: {
		name: i18n(I18nKey.home),
		url: "/",
		icon: "material-symbols:home",
	},
	[LinkPreset.About]: {
		name: i18n(I18nKey.about),
		url: "/about/",
		icon: "material-symbols:person",
	},
	[LinkPreset.Archive]: {
		name: i18n(I18nKey.archive),
		url: "/archive/",
		icon: "material-symbols:schedule-outline-rounded",
	},
	[LinkPreset.PostList]: {
		name: i18n(I18nKey.postList),
		url: "/list/",
		icon: "material-symbols:list-alt-outline-rounded",
	},
	[LinkPreset.Friends]: {
		name: i18n(I18nKey.friends),
		url: "/friends/",
		icon: "material-symbols:group",
	},
	[LinkPreset.Sponsor]: {
		name: i18n(I18nKey.sponsor),
		url: "/sponsor/",
		icon: "material-symbols:favorite",
	},
	[LinkPreset.Guestbook]: {
		name: i18n(I18nKey.guestbook),
		url: "/guestbook/",
		icon: "material-symbols:chat",
	},
	[LinkPreset.Bangumi]: {
		name: i18n(I18nKey.bangumi),
		url: "/bangumi/",
		icon: "material-symbols:movie",
	},
	[LinkPreset.Gallery]: {
		name: i18n(I18nKey.gallery),
		url: "/gallery/",
		icon: "material-symbols:photo-library",
	},
	[LinkPreset.Collections]: {
		name: i18n(I18nKey.collections),
		url: "/collections/",
		icon: "material-symbols:bookmark",
	},
	[LinkPreset.Stats]: {
		name: i18n(I18nKey.stats),
		url: "/stats/",
		icon: "material-symbols:bar-chart",
	},
	[LinkPreset.Calendar]: {
		name: i18n(I18nKey.calendar),
		url: "/calendar/",
		icon: "material-symbols:calendar-today",
	},
	[LinkPreset.Categories]: {
		name: "分类标签",
		url: "/categories/",
		icon: "material-symbols:category",
	},
	[LinkPreset.Tags]: {
		name: i18n(I18nKey.tags),
		url: "/tags/",
		icon: "material-symbols:label",
	},
	[LinkPreset.Fhome]: {
		name: i18n(I18nKey.Fhome),
		url: "https://home.fqzlr.com/",
		icon: "material-symbols:link",
		external: true,
	},
	[LinkPreset.Fnote]: {
		name: i18n(I18nKey.Fnote),
		url: "https://bj.fqzlr.com/",
		icon: "material-symbols:link",
		external: true,
	},
	[LinkPreset.ContactMe]: {
		name: i18n(I18nKey.contactMe),
		url: "/contact/",
		icon: "material-symbols:mail",
	},
	[LinkPreset.QQGroup]: {
		name: i18n(I18nKey.qqGroup),
		url: "https://qm.qq.com/q/2R07cjGTZ0",
		icon: "fa7-brands:qq",
		external: true,
	},
	[LinkPreset.NavPosts]: {
		name: i18n(I18nKey.navPosts),
		url: "/list/",
		icon: "material-symbols:article",
	},
	[LinkPreset.NavMy]: {
		name: i18n(I18nKey.navMy),
		url: "/my/",
		icon: "material-symbols:person",
	},
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
	},
};
