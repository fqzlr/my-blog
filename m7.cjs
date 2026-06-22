const fs = require("fs");
let c = fs.readFileSync("src/types/config.ts", "utf8");
// Remove the duplicate Fnote line
c = c.replace(
  "\tFnote = 19,\n\tBooks = 20,\n\tMoviesGames = 21,\n\tMusicPage = 22,\n\tChangelog = 23,\n\tMoments = 24,\n\tAdmin = 25,\n\tRoutines = 26,\n\tPlaces = 27,\n\tNotebooks = 28,\n\tFnote = 19,",
  "\tFnote = 19,\n\tBooks = 20,\n\tMoviesGames = 21,\n\tMusicPage = 22,\n\tChangelog = 23,\n\tMoments = 24,\n\tAdmin = 25,\n\tRoutines = 26,\n\tPlaces = 27,\n\tNotebooks = 28,"
);
fs.writeFileSync("src/types/config.ts", c, "utf8");
console.log("fixed duplicate");
