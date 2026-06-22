const fs = require("fs");
let c = fs.readFileSync("src/config/navBarConfig.ts", "utf8");

// Add new page checks to myChildren
const myChildrenInsert = `	if (siteConfig.pages.bangumi) {
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
`;

c = c.replace("if (siteConfig.pages.gallery) {", myChildrenInsert + "	if (siteConfig.pages.gallery) {");
fs.writeFileSync("src/config/navBarConfig.ts", c, "utf8");
console.log("navBarConfig done");
