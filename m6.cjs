const fs = require("fs");
let c = fs.readFileSync("src/utils/setting-utils.ts", "utf8");
// Find the import from constants/constants
const marker = '} from "@constants/constants"';
const idx = c.indexOf(marker);
if (idx > -1) {
  let start = idx;
  while (start > 0 && c[start] !== "{") start--;
  const oldImport = c.substring(start - 7, idx + marker.length);
  const newImport = oldImport.replace(
    "DEFAULT_THEME,",
    "DEFAULT_THEME,\n\tWALLPAPER_BANNER,\n\tWALLPAPER_NONE,\n\tWALLPAPER_OVERLAY,"
  );
  c = c.replace(oldImport, newImport);
  fs.writeFileSync("src/utils/setting-utils.ts", c, "utf8");
  console.log("updated constants import");
}
