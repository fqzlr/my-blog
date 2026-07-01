/**
 * 将 src/content/ 下的 Markdown 内容转换为 public/*.json
 * 运行: node scripts/convert-content-to-json.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "src", "content");
const PUBLIC = path.join(ROOT, "public");

function readMd(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);
  const html = content.trim() ? marked.parse(content.trim()) : "";
  return { data, content: content.trim(), html };
}

function walk(dir, ext = [".md", ".mdx"], _baseDir = null) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const base = _baseDir || dir;
  const normalizedBase = base.endsWith(path.sep) ? base : base + path.sep;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, ext, base));
    } else if (ext.includes(path.extname(entry.name).toLowerCase())) {
      // Always compute relative path from the original base directory
      const relPath = full.substring(normalizedBase.length);
      results.push({ path: full, relPath });
    }
  }
  return results;
}

function toDateStr(d) {
  if (!d) return "";
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return new Date(d).toISOString();
  return "";
}

function resolveImage(img) {
  if (!img) return "";
  if (typeof img === "string") return img;
  if (typeof img === "object" && img.src) return img.src;
  return "";
}

// ========== 1. changelog ==========
function convertChangelog() {
  const dir = path.join(CONTENT, "changelog");
  const files = walk(dir);
  const items = files.map((f) => {
    const { data, html } = readMd(f.path);
    return {
      id: path.basename(f.relPath, path.extname(f.relPath)),
      version: data.version || "",
      date: toDateStr(data.date),
      time: data.time || "",
      type: data.type || "feature",
      description: data.description || "",
      contentHtml: html,
    };
  });
  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return items;
}

// ========== 2. bangumi ==========
function convertBangumi() {
  const dir = path.join(CONTENT, "bangumi");
  const files = walk(dir, [".md", ".mdx", ".yaml", ".yml"]);
  const items = files.map((f) => {
    const relPath = f.relPath.replace(/\\/g, "/");
    // category from first directory segment
    const parts = relPath.split("/");
    const category = parts.length > 1 ? parts[0] : "anime";

    let data, content;
    const ext = path.extname(f.path).toLowerCase();
    if (ext === ".yaml" || ext === ".yml") {
      const raw = fs.readFileSync(f.path, "utf-8");
      const parsed = matter(raw);
      data = parsed.data;
      content = parsed.content;
    } else {
      const parsed = readMd(f.path);
      data = parsed.data;
      content = parsed.content;
    }

    const id = relPath.replace(/\.(md|mdx|yaml|yml)$/i, "");
    const image = resolveImage(data.image);

    return {
      id,
      title: data.title || "",
      name_cn: data.name_cn || data.title || "",
      category,
      subcategory: data.subcategory || "",
      status: data.status || 2,
      image,
      link: data.link || "",
      score: data.score || 0,
      comment: data.comment || "",
      tags: data.tags || [],
      published: toDateStr(data.published),
      // Music fields
      artist: data.artist || "",
      audioUrl: data.audioUrl || "",
    };
  });
  items.sort(
    (a, b) => new Date(b.published).getTime() - new Date(a.published).getTime()
  );
  return items;
}

// ========== 3. routines ==========
function convertRoutines() {
  const dir = path.join(CONTENT, "life", "routines");
  const files = walk(dir);
  const items = files
    .filter((f) => !f.relPath.toLowerCase().includes("readme"))
    .map((f) => {
      const { data, html } = readMd(f.path);
      return {
        id: path.basename(f.relPath, path.extname(f.relPath)),
        name: data.name || "未命名",
        time: data.time || "",
        description: data.description || "",
        icon: data.icon || "📋",
        color: data.color || "var(--primary)",
        updatedAt: toDateStr(data.updatedAt),
        contentHtml: html,
      };
    });
  items.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return items;
}

// ========== 4. places ==========
function convertPlaces() {
  const dir = path.join(CONTENT, "life", "places");
  const files = walk(dir);
  const items = files
    .filter((f) => !f.relPath.toLowerCase().includes("readme"))
    .map((f) => {
      const { data } = readMd(f.path);
      return {
        id: path.basename(f.relPath, path.extname(f.relPath)),
        province: data.province || "",
        city: data.city || "",
        district: data.district || "",
        experience: data.experience || "",
        visitCount: data.visitCount || 1,
        date: data.date
          ? data.date instanceof Date
            ? data.date.toISOString().split("T")[0]
            : String(data.date)
          : "",
        lat: data.lat || null,
        lng: data.lng || null,
      };
    });
  items.sort(
    (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
  );
  return items;
}

// ========== 5. notebooks ==========
function convertNotebooks() {
  const baseDir = path.join(CONTENT, "life", "notebooks");
  if (!fs.existsSync(baseDir)) return [];

  const allFiles = walk(baseDir, [".md", ".json"]);  // Find notebook folders (those with _index.json or _index.md)
  const notebookFolders = [];

  for (const f of allFiles) {
    const rel = f.relPath.replace(/\\/g, "/");
    const match = rel.match(/^([^/]+)\/_index\.(json|md)$/);
    if (match) {
      notebookFolders.push({
        folderName: match[1],
        indexPath: f.path,
        ext: path.extname(f.path),
      });
    }
  }

  const notebooks = [];
  for (const nb of notebookFolders) {
    let indexData;
    if (nb.ext === ".json") {
      indexData = JSON.parse(fs.readFileSync(nb.indexPath, "utf-8"));
    } else {
      const { data } = readMd(nb.indexPath);
      indexData = data;
    }

    // Find entries in this folder
    const entryFiles = allFiles.filter((f) => {
      const rel = f.relPath.replace(/\\/g, "/");
      return (
        rel.startsWith(nb.folderName + "/") &&
        !rel.includes("_index") &&
        f.path.endsWith(".md")
      );
    });

    const entries = entryFiles.map((f) => {
      const { data, html } = readMd(f.path);
      return {
        id: path.basename(f.relPath, path.extname(f.relPath)),
        title: data.title || data.name || "",
        date: toDateStr(data.date),
        tags: data.tags || [],
        contentHtml: html,
      };
    });

    entries.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    notebooks.push({
      folderName: nb.folderName,
      name: indexData.name || "未命名笔记本",
      cover: indexData.cover || "",
      summary: indexData.summary || "",
      entries: entries.length,
      updatedAt: entries[0]?.date || "",
      entryList: entries,
    });
  }

  notebooks.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  return notebooks;
}

// ========== 6. about ==========
function convertAbout() {
  const filePath = path.join(CONTENT, "spec", "about.md");
  if (!fs.existsSync(filePath)) {
    console.log("  ⚠️ about.md not found");
    return { content: "", contentHtml: "" };
  }
  const { content, html } = readMd(filePath);
  return { content, contentHtml: html };
}

// ========== Write all ==========
function writeJson(filename, data) {
  const outPath = path.join(PUBLIC, filename);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`  ✅ ${filename} (${Array.isArray(data) ? data.length : 1} items)`);
}

console.log("🔄 Converting content to JSON...\n");

console.log("📝 Changelog:");
writeJson("changelog.json", convertChangelog());

console.log("📺 Bangumi:");
writeJson("bangumi.json", convertBangumi());

console.log("📋 Routines:");
writeJson("routines.json", convertRoutines());

console.log("📍 Places:");
writeJson("places.json", convertPlaces());

console.log("📓 Notebooks:");
writeJson("notebooks.json", convertNotebooks());
console.log("👤 About:");
writeJson("about.json", convertAbout());

// ========== 7. sponsor ==========
function convertSponsor() {
  // Read sponsorConfig.ts and extract data
  const configPath = path.join(ROOT, "src", "config", "sponsorConfig.ts");
  if (!fs.existsSync(configPath)) {
    console.log("  ⚠️ sponsorConfig.ts not found");
    return {};
  }
  const raw = fs.readFileSync(configPath, "utf-8");
  // Extract the config object using a simple approach: eval the TS as JS after stripping types
  // Instead, we'll parse it manually with regex
  const title = raw.match(/title:\s*"([^"]*)"/)?.[1] || "";
  const description = raw.match(/description:\s*"([^"]*)"/)?.[1] || "";
  const usage = raw.match(/usage:\s*"([^"]*)"/)?.[1] || "";
  const showSponsorsList = !raw.match(/showSponsorsList:\s*false/);

  // Extract methods
  const methods = [];
  const methodsMatch = raw.match(/methods:\s*\[([\s\S]*?)\],\s*\/\/\s*赞助者列表/s);
  if (methodsMatch) {
    const methodsStr = methodsMatch[1];
    const methodBlocks = methodsStr.match(/\{[\s\S]*?\}/g) || [];
    for (const block of methodBlocks) {
      const name = block.match(/name:\s*"([^"]*)"/)?.[1] || "";
      const icon = block.match(/icon:\s*"([^"]*)"/)?.[1] || "";
      const qrCode = block.match(/qrCode:\s*"([^"]*)"/)?.[1] || "";
      const link = block.match(/link:\s*"([^"]*)"/)?.[1] || "";
      const desc = block.match(/description:\s*"([^"]*)"/)?.[1] || "";
      const enabled = !block.match(/enabled:\s*false/);
      if (name) methods.push({ name, icon, qrCode, link, description: desc, enabled });
    }
  }

  // Extract sponsors
  const sponsors = [];
  const sponsorsMatch = raw.match(/sponsors:\s*\[([\s\S]*?)\],?\s*\};/);
  if (sponsorsMatch) {
    const sponsorsStr = sponsorsMatch[1];
    const sponsorBlocks = sponsorsStr.match(/\{[\s\S]*?\}/g) || [];
    for (const block of sponsorBlocks) {
      const name = block.match(/name:\s*"([^"]*)"/)?.[1] || "";
      const avatar = block.match(/avatar:\s*\n?\s*"([^"]*)"/)?.[1] || "";
      const amount = block.match(/amount:\s*"([^"]*)"/)?.[1] || "";
      const date = block.match(/date:\s*"([^"]*)"/)?.[1] || "";
      if (name) sponsors.push({ name, avatar, amount, date });
    }
  }

  return { title, description, usage, showSponsorsList, methods, sponsors };
}

console.log("💰 Sponsor:");
writeJson("sponsor.json", convertSponsor());

console.log("\n✅ Done! All JSON files written to public/");
