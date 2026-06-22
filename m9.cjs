const fs = require("fs");
let c = fs.readFileSync("src/content.config.ts", "utf8");
const removeEntries = ["album", "daohang", "ziyuan", "friends", "danmu"];
removeEntries.forEach(name => {
  const regex = new RegExp(`\\t${name}: ${name}Collection,\\n`, "g");
  c = c.replace(regex, "");
});
fs.writeFileSync("src/content.config.ts", c, "utf8");
console.log("cleaned export entries");
