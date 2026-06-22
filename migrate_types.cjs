const fs = require("fs");

let content = fs.readFileSync("src/types/config.ts", "utf8");

// Add new LinkPreset enum values
content = content.replace(
  "NavMy = 18,",
  "NavMy = 18,\n\tFnote = 19,\n\tBooks = 20,\n\tMoviesGames = 21,\n\tMusicPage = 22,\n\tChangelog = 23,\n\tMoments = 24,\n\tAdmin = 25,\n\tRoutines = 26,\n\tPlaces = 27,\n\tNotebooks = 28,"
);

// Add new pages config fields
const target = "calendar: boolean;";
const replacement = "calendar: boolean;\n\t\tbangumi: boolean;\n\t\tbooks: boolean;\n\t\tmoviesGames: boolean;\n\t\tmusicPage: boolean;\n\t\tchangelog: boolean;\n\t\tmoments: boolean;\n\t\tadmin: boolean;\n\t\tlifeRoutines: boolean;\n\t\tlifePlaces: boolean;\n\t\tlifeNotebooks: boolean;";
content = content.replace(target, replacement);

fs.writeFileSync("src/types/config.ts", content, "utf8");
console.log("types/config.ts done");
