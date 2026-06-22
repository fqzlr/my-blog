const fs = require("fs");
let c = fs.readFileSync("src/content.config.ts", "utf8");
// Remove all lines that are just ");" (stray closing parens)
c = c.replace(/^\s*\);\s*$/gm, "");
// Remove blank lines between collection functions (but keep single blank lines for readability)
c = c.replace(/\n{3,}/g, "\n\n");
fs.writeFileSync("src/content.config.ts", c, "utf8");
console.log("cleaned up stray parens");
