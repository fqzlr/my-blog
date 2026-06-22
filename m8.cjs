const fs = require("fs");
let c = fs.readFileSync("src/types/config.ts", "utf8");
// Remove the duplicate Fnote line (the one preceded by 28,)
c = c.replace("Notebooks = 28,\r\n\tFnote = 19,", "Notebooks = 28,");
fs.writeFileSync("src/types/config.ts", c, "utf8");
console.log("done");
