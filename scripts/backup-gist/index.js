#!/usr/bin/env node

/**
 * Gist → 本地迁移脚本
 *
 * 功能：
 *   1. 从 GitHub Gist 读取数据
 *   2. 写入本地 content collection 对应目录
 *   3. 从 Gist 中删除已迁移的条目
 *   4. Bangumi 封面图下载到本地 + 重写 URL
 *
 * 用法：
 *   node scripts/backup-gist/index.js              # 迁移所有
 *   node scripts/backup-gist/index.js moments       # 仅迁移说说
 *   node scripts/backup-gist/index.js friends       # 仅迁移友链
 *   node scripts/backup-gist/index.js bangumi       # 仅迁移影视
 *   node scripts/backup-gist/index.js notebooks     # 仅迁移笔记本
 *   node scripts/backup-gist/index.js --dry-run     # 仅预览，不写入不删除
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");

// ═══════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════

const EXTERNAL_MOMENTS_CONFIG = {
	gistId: "562ca26ed50f406e0814cd5fd06866d3",
	fileName: "moments.json",
};

const EXTERNAL_NOTEBOOKS_CONFIG = {
	notebookGists: {
		每日总结: "85e22c520b3ea86d80d0a2f7f5154a67",
		日记本: "04da78da60cd6363041605ee65f56bdb",
		日常随笔: "a3707e728f5797612a0b8a9560035686",
		喜马拉雅: "f189e7928f9d5e98700eb17c0b5853fa",
		我和宝宝的日常: "5cabb89043f03efa0099f828505fd9ea",
		记录100件事: "05da9de9c20e47f14849a4937b715d65",
	},
};

const EXTERNAL_FRIENDS_CONFIG = {
	gistId: "a55519b0f88adac957889eddd6c1db53",
	fileName: "friends.json",
};

const EXTERNAL_BANGUMI_CONFIG = {
	gistId: "6045e8306c907fbe7962f507c45dc1dc",
	fileName: "bangumi.json",
};

const CONTENT_DIR = path.join(ROOT, "src/content");
const IMG_DIR = path.join(ROOT, "scripts/fetch-media/img-anime");
const IMG_URL_PREFIX = "https://ph.0824.uk/file/anime/";

// ═══════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════

function loadGithubToken() {
	const envToken = process.env.GITHUB_TOKEN;
	if (envToken) return envToken;
	// 尝试从 externalMomentsConfig 读取（构建时注入的环境变量）
	try {
		const configPath = path.join(ROOT, "src/config/externalMomentsConfig.ts");
		const content = fs.readFileSync(configPath, "utf-8");
		// 注意：githubToken 来自 process.env，配置文件中不会硬编码
	} catch {}
	return "";
}

const GITHUB_TOKEN = loadGithubToken();
const DRY_RUN = process.argv.slice(2).includes("--dry-run");

function safeFilename(str) {
	return str
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.substring(0, 100);
}

function slugify(str) {
	return str
		.toLowerCase()
		.replace(/[^a-z0-9一-鿿]+/g, "-")
		.replace(/^-|-$/g, "")
		.substring(0, 60);
}

function momentFilepath(published) {
	const d = new Date(published);
	const dateStr = d.toISOString().slice(0, 10);
	const dir = path.join(CONTENT_DIR, "moments");
	let filename = `${dateStr}.md`;
	let filepath = path.join(dir, filename);
	let i = 2;
	while (fs.existsSync(filepath)) {
		filename = `${dateStr}-${i}.md`;
		filepath = path.join(dir, filename);
		i++;
	}
	return filepath;
}

function friendFilepath(title, index) {
	const slug = slugify(title) || `friend-${index}`;
	return path.join(CONTENT_DIR, "friends", `${String(index).padStart(2, "0")}-${slug}.md`);
}

function bangumiFilepath(entry) {
	const category = entry.category || "anime";
	const subcategory = entry.subcategory;
	// movie/tv/documentary 不是有效 category，映射到 anime
	const VALID_CATEGORIES = ["book", "anime", "music", "game", "real"];
	const mappedCategory = VALID_CATEGORIES.includes(category) ? category : "anime";
	let dir;
	if (mappedCategory === "book" && subcategory) {
		dir = path.join(CONTENT_DIR, "bangumi", "book", safeFilename(subcategory));
	} else {
		dir = path.join(CONTENT_DIR, "bangumi", mappedCategory);
	}
	const filename = safeFilename(entry.title || entry.name_cn || "untitled") + ".md";
	return path.join(dir, filename);
}

function notebookFilepath(notebookName, entry) {
	const dir = path.join(CONTENT_DIR, "life/notebooks", notebookName);
	const title = entry.title || entry.date || `entry-${entry.id || Date.now()}`;
	const filename = safeFilename(title) + ".md";
	return path.join(dir, filename);
}

// 读取已有本地文件的 frontmatter 用于去重
function readExistingFrontmatter(dir, field) {
	const result = new Map();
	if (!fs.existsSync(dir)) return result;
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dir, file), "utf-8");
			const match = content.match(/^---\n([\s\S]*?)\n---/);
			if (!match) continue;
			const fm = match[1];
			// 简单解析 YAML
			const fieldMatch = fm.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
			if (fieldMatch) {
				let value = fieldMatch[1].trim().replace(/^["']|["']$/g, "");
				if (field === "published" || field === "date") {
					value = new Date(value).toISOString().slice(0, 10);
				}
				result.set(value, file);
			}
		} catch {}
	}
	return result;
}

function readExistingUrls(dir) {
	const result = new Set();
	if (!fs.existsSync(dir)) return result;
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dir, file), "utf-8");
			const match = content.match(/^---\n([\s\S]*?)\n---/);
			if (!match) continue;
			const urlMatch = match[1].match(/^siteurl:\s*(.+)$/m);
			if (urlMatch) result.add(urlMatch[1].trim().replace(/^["']|["']$/g, ""));
		} catch {}
	}
	return result;
}

function readExistingTitles(dir) {
	const result = new Set();
	if (!fs.existsSync(dir)) return result;
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dir, file), "utf-8");
			const match = content.match(/^---\n([\s\S]*?)\n---/);
			if (!match) continue;
			const titleMatch = match[1].match(/^title:\s*(.+)$/m);
			if (titleMatch) result.add(titleMatch[1].trim().replace(/^["']|["']$/g, ""));
		} catch {}
	}
	return result;
}

function readExistingIds(dir) {
	const result = new Set();
	if (!fs.existsSync(dir)) return result;
	const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
	for (const file of files) {
		try {
			const content = fs.readFileSync(path.join(dir, file), "utf-8");
			const match = content.match(/^---\n([\s\S]*?)\n---/);
			if (!match) continue;
			const idMatch = match[1].match(/^# id:\s*(.+)$/m);
			if (idMatch) result.add(idMatch[1].trim());
		} catch {}
	}
	return result;
}

// 写入 .md 文件
function writeMarkdownFile(filepath, frontmatter, body) {
	if (DRY_RUN) {
		console.log(`  [dry-run] 将写入: ${path.relative(ROOT, filepath)}`);
		return true;
	}
	fs.mkdirSync(path.dirname(filepath), { recursive: true });
	const fmLines = ["---"];
	for (const [key, value] of Object.entries(frontmatter)) {
		if (value === undefined || value === null || value === "") continue;
		if (Array.isArray(value)) {
			if (value.length === 0) continue;
			fmLines.push(`${key}:`);
			for (const item of value) {
				fmLines.push(`  - ${item}`);
			}
		} else if (typeof value === "boolean") {
			fmLines.push(`${key}: ${value}`);
		} else if (typeof value === "number") {
			fmLines.push(`${key}: ${value}`);
		} else {
			// 日期字段不加引号（Astro date schema 要求）
			const strValue = String(value);
			const isDateField = ["published", "date", "updatedAt"].includes(key);
			if (!isDateField && (/[:#\n"'{}[\],&*?|>!%`@]/.test(strValue) || strValue.includes("\n"))) {
				fmLines.push(`${key}: "${strValue.replace(/"/g, '\\"')}"`);
			} else {
				fmLines.push(`${key}: ${strValue}`);
			}
		}
	}
	fmLines.push("---");
	const content = fmLines.join("\n") + "\n\n" + (body || "");
	fs.writeFileSync(filepath, content, "utf-8");
	return true;
}

// 下载图片到本地
async function downloadImage(url, destPath) {
	if (DRY_RUN) {
		console.log(`  [dry-run] 将下载: ${url}`);
		return true;
	}
	try {
		const resp = await fetch(url);
		if (!resp.ok) {
			console.log(`  ⚠ 图片下载失败 (${resp.status}): ${url}`);
			return false;
		}
		const buffer = Buffer.from(await resp.arrayBuffer());
		fs.mkdirSync(path.dirname(destPath), { recursive: true });
		fs.writeFileSync(destPath, buffer);
		return true;
	} catch (e) {
		console.log(`  ⚠ 图片下载异常: ${e.message}`);
		return false;
	}
}

// 从 URL 提取文件扩展名
function getImageExt(url) {
	try {
		const pathname = new URL(url).pathname;
		const ext = path.extname(pathname).toLowerCase();
		if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
	} catch {}
	return ".jpg";
}

// Gist 读取（Raw URL，无需认证）
async function fetchGistRaw(gistId) {
	const url = `https://gist.githubusercontent.com/raw/${gistId}?t=${Date.now()}`;
	const resp = await fetch(url);
	if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
	const text = await resp.text();
	return JSON.parse(text);
}

// Gist PATCH（删除条目，需要 Token）
async function updateGist(gistId, fileName, data) {
	if (DRY_RUN) {
		console.log(`  [dry-run] 将更新 Gist ${gistId.slice(0, 8)}... (剩余 ${data.length} 条)`);
		return true;
	}
	if (!GITHUB_TOKEN) {
		console.log("  ⚠ 未设置 GITHUB_TOKEN，无法更新 Gist");
		return false;
	}
	const resp = await fetch(`https://api.github.com/gists/${gistId}`, {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${GITHUB_TOKEN}`,
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			files: {
				[fileName]: {
					content: JSON.stringify(data, null, 2),
				},
			},
		}),
	});
	if (!resp.ok) {
		console.log(`  ⚠ Gist 更新失败: HTTP ${resp.status}`);
		return false;
	}
	return true;
}

// ═══════════════════════════════════════════════════
// Moments 迁移
// ═══════════════════════════════════════════════════

async function migrateMoments() {
	console.log("\n📝 迁移 Moments (说说)...");
	const config = EXTERNAL_MOMENTS_CONFIG;
	const momentsDir = path.join(CONTENT_DIR, "moments");

	let data;
	try {
		data = await fetchGistRaw(config.gistId);
	} catch (e) {
		console.log(`  ✗ 获取失败: ${e.message}`);
		return 0;
	}

	if (!Array.isArray(data) || data.length === 0) {
		console.log("  (空，无需迁移)");
		return 0;
	}
	console.log(`  Gist 中有 ${data.length} 条`);

	// 去重：用 published 日期
	const existingDates = readExistingFrontmatter(momentsDir, "published");
	let migrated = 0;
	let skipped = 0;
	const remaining = [];

	for (const entry of data) {
		if (!entry.published) {
			console.log(`  ⚠ 跳过无日期条目: ${(entry.content || "").slice(0, 30)}`);
			remaining.push(entry);
			continue;
		}

		const dateKey = new Date(entry.published).toISOString().slice(0, 10);
		if (existingDates.has(dateKey)) {
			skipped++;
			// 本地已存在，仍然从 Gist 删除（已迁移过）
			continue;
		}

		const fm = {
			published: entry.published.replace("T", " ").replace("Z", "").slice(0, 19),
			author: entry.author || "团子和蛋糕",
			avatar: entry.avatar || "https://re.tsh520.cn/zl/tx.webp",
		};
		if (entry.pinned) fm.pinned = true;
		if (entry.tags?.length) fm.tags = entry.tags;
		if (entry.location) fm.location = entry.location;
		if (entry.device) fm.device = entry.device;
		if (entry.images?.length) fm.images = entry.images;

		const filepath = momentFilepath(entry.published);
		if (writeMarkdownFile(filepath, fm, entry.content || "")) {
			migrated++;
			console.log(`  ✓ ${path.basename(filepath)}`);
		} else {
			remaining.push(entry);
		}
	}

	// 更新 Gist（移除已迁移的）
	if (remaining.length < data.length) {
		await updateGist(config.gistId, config.fileName, remaining);
	}

	console.log(`  结果: 迁移 ${migrated}, 跳过 ${skipped}, Gist 剩余 ${remaining.length}`);
	return migrated;
}

// ═══════════════════════════════════════════════════
// Friends 迁移
// ═══════════════════════════════════════════════════

async function migrateFriends() {
	console.log("\n🤝 迁移 Friends (友链)...");
	const config = EXTERNAL_FRIENDS_CONFIG;
	const friendsDir = path.join(CONTENT_DIR, "friends");

	let data;
	try {
		data = await fetchGistRaw(config.gistId);
	} catch (e) {
		console.log(`  ✗ 获取失败: ${e.message}`);
		return 0;
	}

	if (!Array.isArray(data) || data.length === 0) {
		console.log("  (空，无需迁移)");
		return 0;
	}
	console.log(`  Gist 中有 ${data.length} 条`);

	// 去重：用 siteurl
	const existingUrls = readExistingUrls(friendsDir);
	const existingCount = fs.existsSync(friendsDir)
		? fs.readdirSync(friendsDir).filter((f) => f.endsWith(".md")).length
		: 0;

	let migrated = 0;
	let skipped = 0;
	const remaining = [];

	for (let i = 0; i < data.length; i++) {
		const entry = data[i];
		if (!entry.siteurl) {
			console.log(`  ⚠ 跳过无 URL 条目: ${entry.title || "?"}`);
			remaining.push(entry);
			continue;
		}

		if (existingUrls.has(entry.siteurl)) {
			skipped++;
			continue;
		}

		const index = existingCount + migrated + 1;
		const fm = {
			title: entry.title || "未知",
			imgurl: entry.imgurl || "",
			desc: entry.desc || "",
			siteurl: entry.siteurl,
		};
		if (entry.tags?.length) fm.tags = entry.tags;
		if (entry.weight) fm.weight = entry.weight;
		if (entry.enabled === false) fm.enabled = false;

		const filepath = friendFilepath(entry.title || "unknown", index);
		if (writeMarkdownFile(filepath, fm, "")) {
			migrated++;
			console.log(`  ✓ ${path.basename(filepath)}`);
		} else {
			remaining.push(entry);
		}
	}

	if (remaining.length < data.length) {
		await updateGist(config.gistId, config.fileName, remaining);
	}

	console.log(`  结果: 迁移 ${migrated}, 跳过 ${skipped}, Gist 剩余 ${remaining.length}`);
	return migrated;
}

// ═══════════════════════════════════════════════════
// Bangumi 迁移（含封面图下载）
// ═══════════════════════════════════════════════════

async function migrateBangumi() {
	console.log("\n🎬 迁移 Bangumi (影视/书籍/音乐/游戏)...");
	const config = EXTERNAL_BANGUMI_CONFIG;
	const bangumiDir = path.join(CONTENT_DIR, "bangumi");

	let data;
	try {
		data = await fetchGistRaw(config.gistId);
	} catch (e) {
		console.log(`  ✗ 获取失败: ${e.message}`);
		return 0;
	}

	if (!Array.isArray(data) || data.length === 0) {
		console.log("  (空，无需迁移)");
		return 0;
	}
	console.log(`  Gist 中有 ${data.length} 条`);

	// 去重：用 title
	const existingTitles = readExistingTitles(bangumiDir);
	// 也检查子目录
	const subdirs = ["anime", "book", "game", "music", "real"];
	for (const sub of subdirs) {
		const subDir = path.join(bangumiDir, sub);
		if (fs.existsSync(subDir)) {
			const titles = readExistingTitles(subDir);
			for (const t of titles) existingTitles.add(t);
		}
	}

	let migrated = 0;
	let skipped = 0;
	let imgDownloaded = 0;
	let imgFailed = 0;
	const remaining = [];

	for (const entry of data) {
		const title = entry.title || entry.name_cn;
		if (!title) {
			console.log(`  ⚠ 跳过无标题条目`);
			remaining.push(entry);
			continue;
		}

		if (existingTitles.has(title)) {
			skipped++;
			continue;
		}

		// 下载封面图并重写 URL（所有类别都处理）
		let imageUrl = entry.image || "";
		const category = entry.category || "anime";

		if (imageUrl) {
			const ext = getImageExt(imageUrl);
			const imgFilename = safeFilename(title) + ext;
			const imgDest = path.join(IMG_DIR, imgFilename);

			if (!fs.existsSync(imgDest)) {
				const ok = await downloadImage(imageUrl, imgDest);
				if (ok) {
					imgDownloaded++;
					console.log(`  📷 ${imgFilename}`);
				} else {
					imgFailed++;
				}
			}
			// 重写 URL 为自定义图床地址（中文文件名不 encode，与现有本地格式一致）
			imageUrl = `${IMG_URL_PREFIX}${imgFilename}`;
		}

		// category 映射：movie/tv/documentary 不是有效 category，转为 anime + subcategory
		const VALID_CATEGORIES = ["book", "anime", "music", "game", "real"];
		let mappedCategory = category;
		let mappedSubcategory = entry.subcategory;
		if (!VALID_CATEGORIES.includes(category)) {
			mappedCategory = "anime";
			mappedSubcategory = category; // movie/tv/documentary → subcategory
		}

		const fm = {
			title: title,
		};
		if (entry.name_cn && entry.name_cn !== title) fm.name_cn = entry.name_cn;
		if (mappedCategory !== "anime") fm.category = mappedCategory;
		if (mappedSubcategory) fm.subcategory = mappedSubcategory;
		if (entry.status) fm.status = entry.status;
		if (imageUrl) fm.image = imageUrl;
		if (entry.link) fm.link = entry.link;
		if (entry.score) fm.score = entry.score;
		if (entry.comment) fm.comment = entry.comment;
		if (entry.tags?.length) fm.tags = entry.tags;
		if (entry.published) fm.published = entry.published;
		if (entry.artist) fm.artist = entry.artist;
		if (entry.audioUrl) fm.audioUrl = entry.audioUrl;
		if (entry.lrcUrl) fm.lrcUrl = entry.lrcUrl;
		if (entry.metingServer) fm.metingServer = entry.metingServer;
		if (entry.metingId) fm.metingId = entry.metingId;

		const filepath = bangumiFilepath(entry);
		if (writeMarkdownFile(filepath, fm, entry.comment || "")) {
			migrated++;
			console.log(`  ✓ ${path.relative(path.join(CONTENT_DIR, "bangumi"), filepath)}`);
		} else {
			remaining.push(entry);
		}
	}

	if (remaining.length < data.length) {
		await updateGist(config.gistId, config.fileName, remaining);
	}

	console.log(`  结果: 迁移 ${migrated}, 跳过 ${skipped}, 图片 ${imgDownloaded}↓/${imgFailed}✗, Gist 剩余 ${remaining.length}`);
	return migrated;
}

// ═══════════════════════════════════════════════════
// Notebooks 迁移
// ═══════════════════════════════════════════════════

async function migrateNotebooks() {
	console.log("\n📓 迁移 Notebooks (笔记本)...");
	const config = EXTERNAL_NOTEBOOKS_CONFIG;
	let totalMigrated = 0;

	for (const [notebookName, gistId] of Object.entries(config.notebookGists)) {
		if (!gistId) {
			console.log(`  [${notebookName}] 无 Gist ID，跳过`);
			continue;
		}

		console.log(`\n  ── ${notebookName} ──`);

		let data;
		try {
			data = await fetchGistRaw(gistId);
		} catch (e) {
			console.log(`  ✗ 获取失败: ${e.message}`);
			continue;
		}

		if (!Array.isArray(data) || data.length === 0) {
			console.log("  (空，无需迁移)");
			continue;
		}
		console.log(`  Gist 中有 ${data.length} 条`);

		// 只处理属于当前笔记本的条目
		const entries = data.filter((e) => !e.notebook || e.notebook === notebookName);

		// 去重：用 id
		const notebookDir = path.join(CONTENT_DIR, "life/notebooks", notebookName);
		const existingIds = readExistingIds(notebookDir);

		let migrated = 0;
		let skipped = 0;
		const remaining = [];

		for (const entry of data) {
			// 不属于当前笔记本的条目保留
			if (entry.notebook && entry.notebook !== notebookName) {
				remaining.push(entry);
				continue;
			}

			if (entry.id && existingIds.has(entry.id)) {
				skipped++;
				continue;
			}

			const fm = {};
			if (entry.date) fm.date = entry.date;
			if (entry.title) fm.name = entry.title;

			const body = entry.content || "";
			const filepath = notebookFilepath(notebookName, entry);

			if (writeMarkdownFile(filepath, fm, body)) {
				migrated++;
				console.log(`  ✓ ${path.basename(filepath)}`);
			} else {
				remaining.push(entry);
			}
		}

		if (remaining.length < data.length) {
			await updateGist(gistId, "notebooks-entries.json", remaining);
		}

		console.log(`  结果: 迁移 ${migrated}, 跳过 ${skipped}, Gist 剩余 ${remaining.length}`);
		totalMigrated += migrated;
	}

	return totalMigrated;
}

// ═══════════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════════

async function main() {
	const args = process.argv.slice(2);
	const target = args.find((a) => !a.startsWith("--"));

	console.log("╔══════════════════════════════════════╗");
	console.log("║   Gist → 本地迁移工具                ║");
	console.log("╚══════════════════════════════════════╝");

	if (DRY_RUN) {
		console.log("⚠  DRY-RUN 模式：仅预览，不写入文件，不修改 Gist");
	}

	if (!GITHUB_TOKEN && !DRY_RUN) {
		console.log("\n⚠  未设置 GITHUB_TOKEN 环境变量");
		console.log("   数据将写入本地，但无法从 Gist 中删除已迁移条目");
		console.log("   设置方式: export GITHUB_TOKEN=ghp_xxxxx\n");
	}

	let total = 0;

	const targets = {
		moments: migrateMoments,
		friends: migrateFriends,
		bangumi: migrateBangumi,
		notebooks: migrateNotebooks,
	};

	if (target && targets[target]) {
		total = await targets[target]();
	} else if (target && !targets[target]) {
		console.log(`\n未知类型: ${target}`);
		console.log("可选: moments, friends, bangumi, notebooks");
		process.exit(1);
	} else if (!target) {
		total += await migrateMoments();
		total += await migrateFriends();
		total += await migrateBangumi();
		total += await migrateNotebooks();
	}

	console.log(`\n════════════════════════════════════════`);
	console.log(`迁移完成，共处理 ${total} 条数据`);
	if (DRY_RUN) console.log("(DRY-RUN 模式，未实际写入)");
	console.log("════════════════════════════════════════\n");
}

main().catch((e) => {
	console.error("迁移失败:", e);
	process.exit(1);
});
