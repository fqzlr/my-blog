const fs = require("fs");
let c = fs.readFileSync("src/styles/main.css", "utf8");
c = c.replace("/* === 页面层 === */", "/* === 功能特性层 === */\n@import './features/movies-games.css';\n\n/* === 页面层 === */");
fs.writeFileSync("src/styles/main.css", c, "utf8");
console.log("main.css import added");
