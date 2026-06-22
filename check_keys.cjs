const fs = require("fs");

// 1. Get all I18nKeys from source
const src = fs.readFileSync("C:\\2\\dumplingandcakeblog\\src\\i18n\\i18nKey.ts", "utf8");
const srcKeys = new Set();
src.split("\n").forEach(line => {
  const m = line.match(/^\t(\w+) = /);
  if (m) srcKeys.add(m[1]);
});

// 2. Get all I18nKeys from target
const tgt = fs.readFileSync("src/i18n/i18nKey.ts", "utf8");
const tgtKeys = new Set();
tgt.split("\n").forEach(line => {
  const m = line.match(/^\t(\w+) = /);
  if (m) tgtKeys.add(m[1]);
});

// 3. Find missing keys
const missing = [...srcKeys].filter(k => !tgtKeys.has(k));
console.log("Missing keys (" + missing.length + "):");
missing.forEach(k => console.log("  " + k));
