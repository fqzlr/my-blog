#!/usr/bin/env node

/**
 * 补充下载 Bangumi 封面图（TMDB → 本地）
 * 从迁移时记录的原始 TMDB URL 下载图片到 img-anime/
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const IMG_DIR = path.join(ROOT, "scripts/fetch-media/img-anime");
const BANGUMI_DIR = path.join(ROOT, "src/content/bangumi");

// dry-run 记录的 TMDB poster_path，用 w500 高清下载
const IMAGE_MAP = {
	"斗罗大陆": "o80kcyeLqMHggWtcskg2E9hLQGB.jpg",   // 已修正：之前错用了完美世界的
	"完美世界": "gGhqTA28FH9EITIq27CWmeXC3KZ.jpg",
	"画江湖之不良人": "9NaAIq970v66BSUvJyGUuxeZx5f.jpg",
	"星辰变": "i5l3cYbXYOlHWabtyexmVafxuL8.jpg",
	"吞噬星空": "3iPt9bIPNYmhqQ3BVU4plRkkDbf.jpg",
	"仙逆": "6AVM12M6UunFmX0bSmP2o4N5Bnt.jpg",
	"遮天": "6sBen6GdYUx90CcVNAcFb4HlepM.jpg",
	"神印王座": "l73nSjpGliYSrg7W7gSg5sxQjQa.jpg",
	"大王饶命": "jO4DI02wo9hqimvELQGPa44T47Q.jpg",
	"紫川": "8VzCvYYkpojS4fB1QEThdY17Ri0.jpg",
	"镖人": "q2DIWEYarSTU2WkjovWw2UIJkbq.jpg",
};

const TMDB_BASE = "https://image.tmdb.org/t/p/w500/";

function getImageExt(url) {
	try {
		const pathname = new URL(url).pathname;
		const ext = path.extname(pathname).toLowerCase();
		if ([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"].includes(ext)) return ext;
	} catch {}
	return ".jpg";
}

function safeFilename(str) {
	return str
		.replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
		.replace(/\s+/g, " ")
		.trim()
		.substring(0, 100);
}

async function downloadImage(title, url) {
	const ext = getImageExt(url);
	const filename = safeFilename(title) + ext;
	const dest = path.join(IMG_DIR, filename);

	if (fs.existsSync(dest)) {
		console.log(`  ⏭ 已存在: ${filename}`);
		return true;
	}

	try {
		console.log(`  ⬇ 下载中: ${filename} ...`);
		const resp = await fetch(url, {
			headers: {
				"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
				Accept: "image/*",
			},
		});
		if (!resp.ok) {
			console.log(`  ✗ HTTP ${resp.status}: ${url}`);
			return false;
		}
		const buffer = Buffer.from(await resp.arrayBuffer());
		fs.mkdirSync(IMG_DIR, { recursive: true });
		fs.writeFileSync(dest, buffer);
		console.log(`  ✓ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
		return true;
	} catch (e) {
		console.log(`  ✗ ${e.message}`);
		return false;
	}
}

async function main() {
	console.log("📷 下载 Bangumi 封面图...\n");

	let ok = 0;
	let fail = 0;

	for (const [title, posterPath] of Object.entries(IMAGE_MAP)) {
		const url = TMDB_BASE + posterPath;
		const success = await downloadImage(title, url);
		if (success) ok++;
		else fail++;
	}

	console.log(`\n完成: ${ok} 成功, ${fail} 失败`);
	console.log(`图片保存到: ${path.relative(ROOT, IMG_DIR)}`);
	console.log(`\n下一步: 将 img-anime/ 中的图片上传到 ph.0824.uk/file/anime/`);
}

main().catch((e) => {
	console.error("失败:", e);
	process.exit(1);
});
