const fs = require("fs");

// 1. i18nKey.ts
let c = fs.readFileSync("src/i18n/i18nKey.ts", "utf8");
c = c.replace('navMy = "navMy",', 'navMy = "navMy",\n\n\tbooks = "books",\n\tmoviesGames = "moviesGames",\n\tmusicPage = "musicPage",\n\tchangelog = "changelog",\n\tmoments = "moments",\n\tadmin = "admin",\n\troutines = "routines",\n\tplaces = "places",\n\tnotebooks = "notebooks",\n\n\tbookshelf = "bookshelf",\n\tadminPanel = "adminPanel",');
fs.writeFileSync("src/i18n/i18nKey.ts", c, "utf8");
console.log("1 done");
