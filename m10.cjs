const fs = require("fs");
let c = fs.readFileSync("src/content.config.ts", "utf8");
// Remove stray ");" lines (multiple consecutive ones)
c = c.replace(/\n\);(\n\);)+/g, "\n);");
// Remove single stray ");" at the end of what was the routinesCollection
// Actually let's just remove all lines that are only ");" between collection definitions
c = c.replace(/\n\);\n\);\n\);\n\);/g, "\n);");
fs.writeFileSync("src/content.config.ts", c, "utf8");
console.log("fixed stray parens");
