<script lang="ts">
	import { onMount, tick } from "svelte";
	import EditToast from "./EditToast.svelte";
	import {
		getStoredToken,
		setStoredToken,
		hasValidToken,
		readFileAsText,
		validateToken,
		showToast,
		ensureIconify,
		getRepoFile,
		createRepoFile,
		updateRepoFile,
	} from "@/utils/editMode";
	import { repoConfig } from "@/config/editConfig";

	// ============ State (Svelte 5 runes) ============
	let title = $state("");
	let content = $state("");
	let coverUrl = $state("");
	let description = $state("");
	let tagsInput = $state("");
	let category = $state("");
	let pubDate = $state("");
	let isDraft = $state(false);
	let isPinned = $state(false);
	let slug = $state("");

	let hasToken = $state(false);
	let saving = $state(false);
	let loading = $state(false);
	let editMode = $state(false);
	let existingSha = $state<string | null>(null);
	let existingExt = $state<".md" | ".mdx">(".md");
	let savePath = $state<string>("");
	let showPreview = $state(false);
	let showTokenModal = $state(false);
	let tokenInput = $state("");
	let validatingToken = $state(false);

	// Refs
	let mdFileInput: HTMLInputElement | undefined;
	let keyFileInput: HTMLInputElement | undefined;
	let contentTextarea: HTMLTextAreaElement | undefined;
	let titleInput: HTMLInputElement | undefined;

	// ============ Derived ============
	let tags = $derived(
		tagsInput
			.split(/[,，]/)
			.map((t) => t.trim())
			.filter(Boolean),
	);

	let wordCount = $derived(content.length);

	let today = $derived(new Date().toISOString().slice(0, 10));

	// ============ Frontmatter Generation ============
	function generateFrontmatter(): string {
		const dateVal = pubDate || today;
		const lines: string[] = ["---"];
		lines.push(`title: "${escapeYaml(title)}"`);
		lines.push(`published: ${dateVal}`);
		lines.push(`updated: ${dateVal}`);
		if (description) {
			lines.push(`description: "${escapeYaml(description)}"`);
		}
		if (coverUrl) {
			lines.push(`image: "${escapeYaml(coverUrl)}"`);
		}
		if (tags.length > 0) {
			lines.push("tags:");
			for (const t of tags) {
				lines.push(`  - ${escapeYaml(t)}`);
			}
		}
		if (category) {
			lines.push(`category: ${escapeYaml(category)}`);
		}
		lines.push(`draft: ${isDraft}`);
		lines.push(`pinned: ${isPinned}`);
		lines.push(`author: fqzlr`);
		lines.push("---");
		return lines.join("\n");
	}

	function escapeYaml(s: string): string {
		return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
	}

	function buildFullContent(): string {
		const fm = generateFrontmatter();
		const body = content.trimStart();
		return `${fm}\n\n${body}`;
	}

	// ============ Slug Generation ============
	function generateSlugFromTitle(t: string): string {
		return t
			.toLowerCase()
			.trim()
			.replace(/[\s]+/g, "-")
			.replace(/[^\w\u4e00-\u9fff-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "");
	}

	function autoFillSlug() {
		if (!slug && title) {
			slug = generateSlugFromTitle(title);
		}
	}

	// ============ Parse existing markdown frontmatter ============
	function parseFrontmatter(raw: string): {
		data: Record<string, any>;
		body: string;
	} {
		const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
		if (!match) {
			return { data: {}, body: raw };
		}
		const fmBlock = match[1];
		const body = match[2];
		const data: Record<string, any> = {};

		// Simple YAML frontmatter parser (handles the fields we need)
		const lines = fmBlock.split("\n");
		let currentArrayKey: string | null = null;
		for (const line of lines) {
			// Array item (starts with "  - ")
			const arrMatch = line.match(/^\s*-\s+(.+)$/);
			if (arrMatch && currentArrayKey) {
				if (!Array.isArray(data[currentArrayKey])) {
					data[currentArrayKey] = [];
				}
				data[currentArrayKey].push(parseYamlValue(arrMatch[1]));
				continue;
			}
			// Key-value pair
			const kvMatch = line.match(/^(\w+)\s*:\s*(.*)$/);
			if (kvMatch) {
				const key = kvMatch[1];
				const val = kvMatch[2].trim();
				currentArrayKey = null;
				if (val === "" || val === "[]") {
					data[key] = [];
					currentArrayKey = key;
				} else {
					data[key] = parseYamlValue(val);
				}
			}
		}
		return { data, body };
	}

	function parseYamlValue(v: string): any {
		v = v.trim();
		if (v === "true") return true;
		if (v === "false") return false;
		if (v === "null" || v === "~") return null;
		// Quoted string
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			return v.slice(1, -1);
		}
		// Date (YYYY-MM-DD)
		if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
			return v;
		}
		// Number
		if (/^-?\d+(\.\d+)?$/.test(v)) {
			return Number(v);
		}
		return v;
	}

	// ============ Load article from sessionStorage (passed from article page) ============
	function loadArticleFromSession(data: any): boolean {
		if (!data || !data.rawContent) return false;
		try {
			const rawContent: string = data.rawContent;
			const { data: fmData, body } = parseFrontmatter(rawContent);

			// Determine file extension from fullPath
			const fullPath: string = data.fullPath || "";
			existingExt = fullPath.endsWith(".mdx") ? ".mdx" : ".md";
			slug = data.slug || "";
			savePath = `src/content/${fullPath.replace(/\.(md|mdx)$/, "")}`;
			editMode = true;

			title = data.title || fmData.title || "";
			content = body || "";
			description = data.description || fmData.description || "";
			coverUrl = data.image || fmData.image || "";
			category = data.category || fmData.category || "";
			isDraft = data.draft !== undefined ? !!data.draft : !!fmData.draft;
			isPinned = data.pinned !== undefined ? !!data.pinned : !!fmData.pinned;

			const tags = data.tags || fmData.tags;
			if (Array.isArray(tags)) {
				tagsInput = tags.join(", ");
			}

			const pubDateVal = data.published || fmData.published;
			if (pubDateVal) {
				pubDate = typeof pubDateVal === "string" ? pubDateVal.slice(0, 10) : today;
			}

			showToast("文章已加载", "success");
			return true;
		} catch (err) {
			console.error("Failed to parse session article data:", err);
			return false;
		}
	}

	// Try to get file SHA from GitHub for saving (best effort, in background)
	async function tryGetShaFromGitHub(pathParam: string) {
		try {
			let paths: { path: string; ext: ".md" | ".mdx" }[] = [];
			if (pathParam.includes("/")) {
				const basePath = `src/content/${pathParam}`;
				paths.push({ path: basePath + ".md", ext: ".md" });
				paths.push({ path: basePath + ".mdx", ext: ".mdx" });
			} else {
				paths.push({ path: `src/content/posts/${pathParam}.md`, ext: ".md" });
				paths.push({ path: `src/content/posts/${pathParam}.mdx`, ext: ".mdx" });
				paths.push({ path: `src/content/posts/blog/${pathParam}.md`, ext: ".md" });
				paths.push({ path: `src/content/posts/blog/${pathParam}.mdx`, ext: ".mdx" });
			}
			for (const p of paths) {
				const result = await getRepoFile(p.path, repoConfig);
				if (result) {
					existingSha = result.sha;
					if (p.ext !== existingExt) {
						existingExt = p.ext;
						savePath = p.path.replace(/\.(md|mdx)$/, "");
					}
					break;
				}
			}
		} catch(e) {
			console.warn("Could not fetch SHA from GitHub:", e);
		}
	}

	// ============ Load article for edit mode ============
	async function loadArticle(pathParam: string) {
		loading = true;
		try {
			// First try to load from sessionStorage (passed directly from article page)
			try {
				const sessionData = sessionStorage.getItem("write-editor-article");
				if (sessionData) {
					const parsed = JSON.parse(sessionData);
					sessionStorage.removeItem("write-editor-article");
					if (parsed.fullPath && pathParam.includes(parsed.slug || "")) {
						if (loadArticleFromSession(parsed)) {
							loading = false;
							// Still try to get SHA from GitHub for saving
							tryGetShaFromGitHub(pathParam);
							return;
						}
					}
				}
			} catch(e) {
				console.warn("SessionStorage parse error:", e);
			}

			// pathParam can be:
			// - "posts/blog/slug" (full path without extension and src/content/)
			// - "slug" (just filename, tries multiple locations)
			let paths: { path: string; ext: ".md" | ".mdx" }[] = [];

			if (pathParam.includes("/")) {
				// Full path provided
				const basePath = `src/content/${pathParam}`;
				paths.push({ path: basePath + ".md", ext: ".md" });
				paths.push({ path: basePath + ".mdx", ext: ".mdx" });
			} else {
				// Just slug, try common locations
				paths.push({ path: `src/content/posts/${pathParam}.md`, ext: ".md" });
				paths.push({ path: `src/content/posts/${pathParam}.mdx`, ext: ".mdx" });
				paths.push({ path: `src/content/posts/blog/${pathParam}.md`, ext: ".md" });
				paths.push({ path: `src/content/posts/blog/${pathParam}.mdx`, ext: ".mdx" });
			}

			let result: { content: string; sha: string } | null = null;
			let ext: ".md" | ".mdx" = ".md";
			let foundPath = "";

			for (const p of paths) {
				result = await getRepoFile(p.path, repoConfig);
				if (result) {
					ext = p.ext;
					foundPath = p.path;
					break;
				}
			}

			if (!result) {
				showToast(`未找到文章: ${pathParam}`, "error");
				loading = false;
				return;
			}

			existingSha = result.sha;
			existingExt = ext;
			// Extract slug from path (filename without extension)
			const pathParts = foundPath.split("/");
			const fileName = pathParts[pathParts.length - 1];
			slug = fileName.replace(/\.(md|mdx)$/, "");
			// Store the full relative path for saving
			savePath = foundPath.replace(/\.(md|mdx)$/, "");
			editMode = true;

			const { data, body } = parseFrontmatter(result.content);
			title = data.title || "";
			content = body || "";
			description = data.description || "";
			coverUrl = data.image || "";
			category = data.category || "";
			isDraft = !!data.draft;
			isPinned = !!data.pinned;

			if (Array.isArray(data.tags)) {
				tagsInput = data.tags.join(", ");
			}

			if (data.published) {
				pubDate = typeof data.published === "string" ? data.published.slice(0, 10) : today;
			}

			showToast("文章已加载", "success");
		} catch (err) {
			showToast("加载文章失败", "error");
		} finally {
			loading = false;
		}
	}

	// ============ Save / Publish ============
	async function handlePublish() {
		if (!title.trim()) {
			showToast("请输入标题", "warning");
			titleInput?.focus();
			return;
		}
		if (!content.trim()) {
			showToast("请输入文章内容", "warning");
			contentTextarea?.focus();
			return;
		}
		if (!slug.trim()) {
			autoFillSlug();
			if (!slug.trim()) {
				showToast("请输入文章 slug", "warning");
				return;
			}
		}

		if (!hasValidToken()) {
			showToast("请先导入密钥", "warning");
			keyFileInput?.click();
			return;
		}

		saving = true;
		try {
			const fullContent = buildFullContent();
			// Use savePath if editing existing article, otherwise default to posts/blog/
			let filePath: string;
			if (editMode && savePath) {
				filePath = `${savePath}${existingExt}`;
			} else {
				filePath = `src/content/posts/blog/${slug}${existingExt}`;
			}
			const commitMsg = editMode
				? `chore(posts): update "${title}"`
				: `chore(posts): create "${title}"`;

			let ok = false;
			if (editMode && existingSha) {
				ok = await updateRepoFile(
					filePath,
					fullContent,
					existingSha,
					commitMsg,
					repoConfig,
				);
			} else {
				ok = await createRepoFile(filePath, fullContent, commitMsg, repoConfig);
			}

			if (ok) {
				showToast(editMode ? "文章已更新！" : "文章已发布！", "success");
				editMode = true;
				// Reload to get new SHA
				const result = await getRepoFile(filePath, repoConfig);
				if (result) {
					existingSha = result.sha;
				}
			} else {
				showToast("保存失败，请检查Token权限（需要repo权限）", "error");
			}
		} catch (err) {
			showToast("保存出错，请检查网络连接", "error");
		} finally {
			saving = false;
		}
	}

	// ============ Token handling ============
	function handleImportKey() {
		if (hasToken) {
			if (confirm("已导入密钥。点击确定重新导入，点击取消保留当前密钥。")) {
				keyFileInput?.click();
			}
			return;
		}
		keyFileInput?.click();
	}

	async function handleKeyFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			input.value = "";
			return;
		}
		try {
			const text = await readFileAsText(file);
			if (text.includes("-----BEGIN") && text.includes("PRIVATE KEY-----")) {
				showToast("检测到PEM私钥，请导入包含GitHub PAT Token的文本文件", "warning");
				input.value = "";
				tokenInput = "";
				showTokenModal = true;
				return;
			}
			const token = text.trim();
			if (!token) {
				showToast("文件内容为空", "error");
				input.value = "";
				return;
			}
			await saveTokenValue(token);
		} catch {
			showToast("读取文件失败", "error");
		}
		input.value = "";
	}

	async function saveTokenValue(token: string) {
		const trimmed = token.trim();
		if (!trimmed) {
			showToast("请输入Token", "warning");
			return;
		}
		validatingToken = true;
		const ok = await validateToken(trimmed);
		validatingToken = false;
		if (!ok) {
			showToast("Token验证失败，请检查Token权限（需要repo权限）", "error");
			return;
		}
		setStoredToken(trimmed);
		hasToken = true;
		showTokenModal = false;
		showToast("密钥导入成功！", "success");
	}

	async function handleSaveToken() {
		await saveTokenValue(tokenInput);
	}

	// ============ Import MD file ============
	function handleImportMd() {
		mdFileInput?.click();
	}

	async function handleMdFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			input.value = "";
			return;
		}
		try {
			const text = await readFileAsText(file);
			const { data, body } = parseFrontmatter(text);

			if (data.title) title = data.title;
			if (body) content = body;
			if (data.description) description = data.description;
			if (data.image) coverUrl = data.image;
			if (data.category) category = data.category;
			if (typeof data.draft === "boolean") isDraft = data.draft;
			if (typeof data.pinned === "boolean") isPinned = data.pinned;
			if (Array.isArray(data.tags)) tagsInput = data.tags.join(", ");
			if (data.published) {
				pubDate = typeof data.published === "string" ? data.published.slice(0, 10) : "";
			}

			// Auto-generate slug from filename if empty
			if (!slug) {
				const name = file.name.replace(/\.(md|markdown|mdx)$/i, "");
				slug = generateSlugFromTitle(name);
			}

			showToast("Markdown 文件已导入", "success");
		} catch {
			showToast("读取文件失败", "error");
		}
		input.value = "";
	}

	// ============ Markdown editor shortcuts ============
	function handleEditorKeydown(e: KeyboardEvent) {
		const textarea = e.currentTarget as HTMLTextAreaElement;
		const ctrl = e.ctrlKey || e.metaKey;

		if (ctrl && !e.shiftKey && !e.altKey) {
			switch (e.key.toLowerCase()) {
				case "b":
					e.preventDefault();
					applyFormat("bold");
					break;
				case "i":
					e.preventDefault();
					applyFormat("italic");
					break;
				case "k":
					e.preventDefault();
					applyFormat("link");
					break;
				case "s":
					e.preventDefault();
					handlePublish();
					break;
			}
		}
	}

	function applyFormat(format: string) {
		const textarea = contentTextarea;
		if (!textarea) return;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		const selected = content.substring(start, end);
		let before = "";
		let after = "";
		let placeholder = "";
		let cursorOffset = 0;

		switch (format) {
			case "bold":
				before = "**";
				after = "**";
				placeholder = "加粗文本";
				break;
			case "italic":
				before = "*";
				after = "*";
				placeholder = "斜体文本";
				break;
			case "strikethrough":
				before = "~~";
				after = "~~";
				placeholder = "删除线文本";
				break;
			case "h2":
				before = "## ";
				after = "";
				placeholder = "二级标题";
				if (start > 0 && content.charAt(start - 1) !== "\n") before = "\n## ";
				break;
			case "h3":
				before = "### ";
				after = "";
				placeholder = "三级标题";
				if (start > 0 && content.charAt(start - 1) !== "\n") before = "\n### ";
				break;
			case "quote":
				before = "> ";
				after = "";
				placeholder = "引用文本";
				if (start > 0 && content.charAt(start - 1) !== "\n") before = "\n> ";
				break;
			case "code":
				before = "`";
				after = "`";
				placeholder = "代码";
				break;
			case "codeblock":
				before = "\n```\n";
				after = "\n```\n";
				placeholder = "代码块";
				cursorOffset = -1;
				break;
			case "ul":
				before = "- ";
				after = "";
				placeholder = "列表项";
				if (start > 0 && content.charAt(start - 1) !== "\n") before = "\n- ";
				break;
			case "ol":
				before = "1. ";
				after = "";
				placeholder = "列表项";
				if (start > 0 && content.charAt(start - 1) !== "\n") before = "\n1. ";
				break;
			case "link": {
				const url = prompt("请输入链接地址:", "https://");
				if (url === null) return;
				const linkText = selected || "链接文本";
				const markdown = `[${linkText}](${url})`;
				const newText = content.substring(0, start) + markdown + content.substring(end);
				content = newText;
				tick().then(() => {
					textarea.focus();
					textarea.setSelectionRange(start + 1, start + 1 + linkText.length);
				});
				return;
			}
			case "image": {
				const url = prompt("请输入图片 URL:", "https://");
				if (url === null) return;
				const altText = selected || "图片描述";
				const markdown = `![${altText}](${url})`;
				const newText = content.substring(0, start) + markdown + content.substring(end);
				content = newText;
				tick().then(() => {
					textarea.focus();
					textarea.setSelectionRange(start + 2, start + 2 + altText.length);
				});
				return;
			}
			case "hr":
				before = "\n---\n";
				after = "";
				placeholder = "";
				break;
		}

		const insertText = selected || placeholder;
		const newText = content.substring(0, start) + before + insertText + after + content.substring(end);
		content = newText;
		tick().then(() => {
			textarea.focus();
			const selectStart = start + before.length;
			const selectEnd = selectStart + insertText.length + cursorOffset;
			textarea.setSelectionRange(selectStart, selectEnd > selectStart ? selectEnd : selectStart);
		});
	}

	function handlePaste(e: ClipboardEvent) {
		const items = e.clipboardData?.items;
		if (!items) return;
		for (let i = 0; i < items.length; i++) {
			if (items[i].type.startsWith("image/")) {
				e.preventDefault();
				showToast("检测到图片粘贴，请先上传图片到图床获取URL后插入", "warning");
				return;
			}
		}
	}

	// ============ Preview (simple markdown rendering) ============
	function renderMarkdown(md: string): string {
		if (!md) return "";
		let html = md;
		// Escape HTML first
		html = html
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
		// Headers
		html = html.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
		html = html.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
		html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
		html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
		html = html.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
		html = html.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");
		// Bold & italic
		html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
		html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
		html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
		// Code
		html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
		// Links
		html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
		// Images
		html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" />');
		// Line breaks
		html = html.replace(/\n\n/g, "</p><p>");
		html = html.replace(/\n/g, "<br/>");
		return `<p>${html}</p>`;
	}

	// ============ Tab key support ============
	function handleTextareaKeydown(e: KeyboardEvent) {
		if (e.key === "Tab") {
			e.preventDefault();
			const textarea = e.currentTarget as HTMLTextAreaElement;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			content = content.substring(0, start) + "  " + content.substring(end);
			tick().then(() => {
				textarea.focus();
				textarea.setSelectionRange(start + 2, start + 2);
			});
		}
	}

	// ============ Init ============
	onMount(() => {
		ensureIconify();
		hasToken = hasValidToken();
		tokenInput = getStoredToken();

		// Check URL params for edit mode (?path=xxx or ?slug=xxx)
		const params = new URLSearchParams(window.location.search);
		const pathParam = params.get("path");
		const slugParam = params.get("slug");
		if (pathParam) {
			loadArticle(pathParam);
		} else if (slugParam) {
			loadArticle(slugParam);
		} else {
			// New article: set default date
			pubDate = today;
		}
	});
</script>

<EditToast />

<!-- 顶部浮动工具栏 -->
<div class="write-toolbar">
	<div class="toolbar-left">
		<a href="/" class="toolbar-btn toolbar-back" title="返回首页" data-no-swup>
			<iconify-icon icon="material-symbols:arrow-back-rounded" class="text-lg"></iconify-icon>
			<span class="btn-text">返回</span>
		</a>
	</div>
	<div class="toolbar-center">
		<span class="toolbar-title">{editMode ? "编辑文章" : "写文章"}</span>
	</div>
	<div class="toolbar-right">
		<button class="toolbar-btn" onclick={handleImportMd} title="导入Markdown文件">
			<iconify-icon icon="material-symbols:upload-file-rounded" class="text-lg"></iconify-icon>
			<span class="btn-text">导入MD</span>
		</button>
		<button
			class="toolbar-btn"
			class:active={showPreview}
			onclick={() => (showPreview = !showPreview)}
			title="预览"
		>
			<iconify-icon
				icon={showPreview ? "material-symbols:edit-rounded" : "material-symbols:visibility-rounded"}
				class="text-lg"
			></iconify-icon>
			<span class="btn-text">{showPreview ? "编辑" : "预览"}</span>
		</button>
		<button
			class="toolbar-btn toolbar-publish"
			onclick={handlePublish}
			disabled={saving || loading}
			title={hasToken ? "发布文章" : "导入密钥后发布"}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-lg animate-spin"></iconify-icon>
				<span class="btn-text">发布中...</span>
			{:else}
				<iconify-icon icon={hasToken ? "material-symbols:send-rounded" : "material-symbols:key-rounded"} class="text-lg"></iconify-icon>
				<span class="btn-text">{hasToken ? "发布" : "导入密钥"}</span>
			{/if}
		</button>

		<!-- 隐藏的MD文件选择器 -->
		<input
			bind:this={mdFileInput}
			type="file"
			accept=".md,.markdown,.mdx"
			style="display:none"
			onchange={handleMdFileSelect}
		/>
		<!-- 隐藏的密钥文件选择器 -->
		<input
			bind:this={keyFileInput}
			type="file"
			accept=".txt,.pem,.key,text/plain"
			style="display:none"
			onchange={handleKeyFileSelect}
		/>
	</div>
</div>

<!-- 主体区域 -->
{#if loading}
	<div class="loading-state">
		<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-4xl animate-spin"></iconify-icon>
		<p>加载文章中...</p>
	</div>
{:else}
	<div class="write-container" class:preview-mode={showPreview}>
		<!-- 左侧：主编辑区 -->
		<div class="editor-panel">
			{#if !showPreview}
				<input
					bind:this={titleInput}
					bind:value={title}
					class="title-input"
					type="text"
					placeholder="输入文章标题..."
					onblur={autoFillSlug}
				/>
				<div class="md-toolbar">
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("bold")} title="加粗 (Ctrl+B)">
						<iconify-icon icon="material-symbols:format-bold-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("italic")} title="斜体 (Ctrl+I)">
						<iconify-icon icon="material-symbols:format-italic-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("strikethrough")} title="删除线">
						<iconify-icon icon="material-symbols:format-strikethrough-rounded"></iconify-icon>
					</button>
					<span class="md-toolbar-divider"></span>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("h2")} title="二级标题">
						<iconify-icon icon="material-symbols:format-h2-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("h3")} title="三级标题">
						<iconify-icon icon="material-symbols:format-h3-rounded"></iconify-icon>
					</button>
					<span class="md-toolbar-divider"></span>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("quote")} title="引用">
						<iconify-icon icon="material-symbols:format-quote-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("code")} title="行内代码">
						<iconify-icon icon="material-symbols:code-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("codeblock")} title="代码块">
						<iconify-icon icon="material-symbols:data-object-rounded"></iconify-icon>
					</button>
					<span class="md-toolbar-divider"></span>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("ul")} title="无序列表">
						<iconify-icon icon="material-symbols:format-list-bulleted-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("ol")} title="有序列表">
						<iconify-icon icon="material-symbols:format-list-numbered-rounded"></iconify-icon>
					</button>
					<span class="md-toolbar-divider"></span>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("link")} title="链接 (Ctrl+K)">
						<iconify-icon icon="material-symbols:link-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("image")} title="图片">
						<iconify-icon icon="material-symbols:image-rounded"></iconify-icon>
					</button>
					<button type="button" class="md-toolbar-btn" onclick={() => applyFormat("hr")} title="分割线">
						<iconify-icon icon="material-symbols:horizontal-rule-rounded"></iconify-icon>
					</button>
				</div>
				<textarea
					bind:this={contentTextarea}
					bind:value={content}
					class="content-textarea"
					placeholder="开始写作...&#10;&#10;支持 Markdown 语法&#10;快捷键: Ctrl+B 加粗 / Ctrl+I 斜体 / Ctrl+K 链接 / Ctrl+S 保存"
					onkeydown={(e) => {
						handleEditorKeydown(e);
						handleTextareaKeydown(e);
					}}
					onpaste={handlePaste}
					spellcheck={false}
				></textarea>
			{:else}
				<div class="preview-panel">
					{#if title}
						<h1 class="preview-title">{title}</h1>
					{/if}
					{@html renderMarkdown(content)}
				</div>
			{/if}
			<div class="editor-footer">
				<span class="word-count">{wordCount} 字</span>
				<span class="shortcuts-hint">Ctrl+B 加粗 | Ctrl+I 斜体 | Ctrl+K 链接 | Ctrl+S 保存</span>
			</div>
		</div>

		<!-- 右侧：边栏 -->
		<div class="sidebar-panel">
			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:image-rounded" class="text-sm"></iconify-icon>
					封面图片 URL
				</label>
				<input
					bind:value={coverUrl}
					type="text"
					class="sidebar-input"
					placeholder="https://example.com/cover.jpg"
				/>
				{#if coverUrl}
					<div class="cover-preview">
						<img src={coverUrl} alt="封面预览" loading="lazy" />
					</div>
				{/if}
			</div>

			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:description-rounded" class="text-sm"></iconify-icon>
					文章描述
				</label>
				<textarea
					bind:value={description}
					class="sidebar-textarea"
					placeholder="简短描述文章内容，用于SEO和列表展示"
					rows={3}
				></textarea>
			</div>

			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:tag-rounded" class="text-sm"></iconify-icon>
					标签（逗号分隔）
				</label>
				<input
					bind:value={tagsInput}
					type="text"
					class="sidebar-input"
					placeholder="Astro, 博客, 教程"
				/>
				{#if tags.length > 0}
					<div class="tag-list">
						{#each tags as tag (tag)}
							<span class="tag-chip">{tag}</span>
						{/each}
					</div>
				{/if}
			</div>

			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:folder-rounded" class="text-sm"></iconify-icon>
					分类
				</label>
				<input
					bind:value={category}
					type="text"
					class="sidebar-input"
					placeholder="教程"
				/>
			</div>

			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:calendar-today-rounded" class="text-sm"></iconify-icon>
					发布日期
				</label>
				<input
					bind:value={pubDate}
					type="date"
					class="sidebar-input"
				/>
			</div>

			<div class="sidebar-section">
				<label class="sidebar-label">
					<iconify-icon icon="material-symbols:link-rounded" class="text-sm"></iconify-icon>
					文章 Slug
				</label>
				<input
					bind:value={slug}
					type="text"
					class="sidebar-input"
					placeholder="article-slug"
				/>
				<p class="sidebar-hint">留空将自动从标题生成</p>
			</div>

			<div class="sidebar-section checkbox-section">
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={isDraft} />
					<span class="checkbox-custom"></span>
					<iconify-icon icon="material-symbols:draft-rounded" class="text-sm"></iconify-icon>
					草稿（不发布）
				</label>
				<label class="checkbox-label">
					<input type="checkbox" bind:checked={isPinned} />
					<span class="checkbox-custom"></span>
					<iconify-icon icon="material-symbols:push-pin-rounded" class="text-sm"></iconify-icon>
					置顶文章
				</label>
			</div>

			<div class="sidebar-section token-status">
				<div class="token-indicator">
					<span class="status-dot" class:ok={hasToken}></span>
					<span>{hasToken ? "已连接GitHub" : "未导入密钥"}</span>
				</div>
				{#if !hasToken}
					<button class="sidebar-btn" onclick={handleImportKey}>
						<iconify-icon icon="material-symbols:key-rounded" class="text-sm"></iconify-icon>
						导入密钥
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Token手动输入弹窗 -->
{#if showTokenModal}
	<div class="modal-overlay" onclick={() => (showTokenModal = false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:key-rounded" class="text-lg"></iconify-icon>
					输入 GitHub Token
				</h3>
				<button class="modal-close" onclick={() => (showTokenModal = false)}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body">
				<p class="modal-desc">
					请输入您的 GitHub Personal Access Token。Token 需要有 <strong>repo</strong> 权限。
				</p>
				<input
					type="password"
					bind:value={tokenInput}
					placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
					class="modal-input"
					onkeydown={(e) => e.key === "Enter" && handleSaveToken()}
				/>
				<div class="modal-help">
					<a
						href="https://github.com/settings/tokens/new?scopes=repo&description=Blog%20Write%20Token"
						target="_blank"
						rel="noopener noreferrer"
					>
						<iconify-icon icon="material-symbols:open-in-new-rounded" class="text-sm"></iconify-icon>
						点击生成Token（需勾选 repo 权限）
					</a>
				</div>
			</div>
			<div class="modal-footer">
				<button class="modal-btn modal-btn-cancel" onclick={() => (showTokenModal = false)}>取消</button>
				<button class="modal-btn modal-btn-confirm" onclick={handleSaveToken} disabled={validatingToken}>
					{#if validatingToken}
						<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-sm animate-spin"></iconify-icon>
						验证中...
					{:else}
						确认
					{/if}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* ===== 基础布局 ===== */
	:global(body) {
		overflow: hidden;
	}

	.write-toolbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 20px;
		background: rgba(255, 255, 255, 0.85);
		backdrop-filter: blur(16px);
		-webkit-backdrop-filter: blur(16px);
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		height: 56px;
		box-sizing: border-box;
	}
	:global(.dark) .write-toolbar {
		background: rgba(20, 20, 30, 0.85);
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-center {
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		font-size: 15px;
		font-weight: 600;
		color: var(--text-color, #1a1a2e);
		pointer-events: none;
	}
	:global(.dark) .toolbar-center {
		color: #f0f0f0;
	}

	.toolbar-title {
		white-space: nowrap;
	}

	.toolbar-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		padding: 7px 14px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1.5px solid transparent;
		background: transparent;
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
		text-decoration: none;
		font-family: inherit;
	}
	.toolbar-btn:hover {
		background: rgba(0, 0, 0, 0.05);
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .toolbar-btn {
		color: rgba(255, 255, 255, 0.7);
	}
	:global(.dark) .toolbar-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: white;
	}

	.toolbar-btn.active {
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
	}
	:global(.dark) .toolbar-btn.active {
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}

	.toolbar-publish {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white !important;
		font-weight: 600;
		box-shadow: 0 2px 8px hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
	}
	.toolbar-publish:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%) !important;
		transform: translateY(-1px);
		box-shadow: 0 4px 16px hsla(var(--theme-hue, 165), 70%, 50%, 0.4);
	}
	.toolbar-publish:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	/* ===== 主体容器 ===== */
	.write-container {
		display: flex;
		height: calc(100vh - 56px);
		margin-top: 56px;
	}

	/* ===== 左侧编辑面板 ===== */
	.editor-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		border-right: 1px solid rgba(0, 0, 0, 0.06);
		background: var(--bg-color, #fafafa);
	}
	:global(.dark) .editor-panel {
		border-right-color: rgba(255, 255, 255, 0.08);
		background: #0f0f1a;
	}

	.title-input {
		width: 100%;
		padding: 28px 40px 16px;
		border: none;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		background: transparent;
		font-size: 28px;
		font-weight: 700;
		color: var(--text-color, #1a1a2e);
		outline: none;
		font-family: inherit;
		box-sizing: border-box;
	}
	.title-input::placeholder {
		color: #c0c0c0;
	}
	:global(.dark) .title-input {
		color: #f0f0f0;
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
	:global(.dark) .title-input::placeholder {
		color: #555;
	}

	.md-toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 8px 20px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.06);
		background: rgba(0, 0, 0, 0.02);
		flex-wrap: wrap;
	}

	.md-toolbar-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: none;
		background: transparent;
		border-radius: 6px;
		cursor: pointer;
		color: #666;
		font-size: 18px;
		transition: all 0.15s ease;
		padding: 0;
	}

	.md-toolbar-btn:hover {
		background: rgba(102, 126, 234, 0.1);
		color: #667eea;
	}

	.md-toolbar-btn:active {
		background: rgba(102, 126, 234, 0.2);
	}

	.md-toolbar-divider {
		width: 1px;
		height: 20px;
		background: rgba(0, 0, 0, 0.1);
		margin: 0 4px;
	}

	:global(.dark) .md-toolbar {
		border-bottom-color: rgba(255, 255, 255, 0.08);
		background: rgba(255, 255, 255, 0.03);
	}

	:global(.dark) .md-toolbar-btn {
		color: #888;
	}

	:global(.dark) .md-toolbar-btn:hover {
		background: rgba(102, 126, 234, 0.2);
		color: #8b9cf7;
	}

	:global(.dark) .md-toolbar-divider {
		background: rgba(255, 255, 255, 0.1);
	}

	.content-textarea {
		flex: 1;
		width: 100%;
		padding: 24px 40px;
		border: none;
		background: transparent;
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-color, #1f2937);
		outline: none;
		resize: none;
		font-family: "JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", Consolas, "Courier New", monospace;
		box-sizing: border-box;
		tab-size: 2;
	}
	.content-textarea::placeholder {
		color: #b0b0b0;
	}
	:global(.dark) .content-textarea {
		color: #e0e0e0;
	}
	:global(.dark) .content-textarea::placeholder {
		color: #505060;
	}

	.editor-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 8px 40px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
		font-size: 12px;
		color: #999;
		background: var(--card-bg, white);
	}
	:global(.dark) .editor-footer {
		border-top-color: rgba(255, 255, 255, 0.08);
		background: #141420;
		color: #666;
	}

	.shortcuts-hint {
		font-family: monospace;
		font-size: 11px;
	}

	/* ===== 预览面板 ===== */
	.preview-panel {
		flex: 1;
		padding: 28px 40px;
		overflow-y: auto;
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .preview-panel {
		color: #e0e0e0;
	}

	.preview-title {
		font-size: 28px;
		font-weight: 700;
		margin: 0 0 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .preview-title {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}

	.preview-panel :global(h1),
	.preview-panel :global(h2),
	.preview-panel :global(h3) {
		margin-top: 1.5em;
		margin-bottom: 0.5em;
	}
	.preview-panel :global(h1) { font-size: 1.8em; }
	.preview-panel :global(h2) { font-size: 1.5em; }
	.preview-panel :global(h3) { font-size: 1.25em; }
	.preview-panel :global(code) {
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.06);
		font-family: "JetBrains Mono", Consolas, monospace;
		font-size: 0.9em;
	}
	:global(.dark) .preview-panel :global(code) {
		background: rgba(255, 255, 255, 0.1);
	}
	.preview-panel :global(a) {
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		text-decoration: none;
	}
	.preview-panel :global(a:hover) {
		text-decoration: underline;
	}
	.preview-panel :global(img) {
		max-width: 100%;
		border-radius: 8px;
		margin: 12px 0;
	}

	/* ===== 右侧边栏 ===== */
	.sidebar-panel {
		width: 320px;
		flex-shrink: 0;
		padding: 20px;
		overflow-y: auto;
		background: var(--card-bg, white);
		box-sizing: border-box;
	}
	:global(.dark) .sidebar-panel {
		background: #141420;
	}

	.sidebar-section {
		margin-bottom: 20px;
	}

	.sidebar-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-color, #1a1a2e);
		margin-bottom: 8px;
	}
	:global(.dark) .sidebar-label {
		color: #d0d0d0;
	}

	.sidebar-input {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--border, #e5e7eb);
		border-radius: 8px;
		font-size: 13px;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.2s;
		box-sizing: border-box;
		font-family: inherit;
	}
	.sidebar-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	:global(.dark) .sidebar-input {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}

	.sidebar-textarea {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--border, #e5e7eb);
		border-radius: 8px;
		font-size: 13px;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
		transition: border-color 0.2s;
		box-sizing: border-box;
		font-family: inherit;
		line-height: 1.6;
	}
	.sidebar-textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	:global(.dark) .sidebar-textarea {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}

	.sidebar-hint {
		margin: 4px 0 0;
		font-size: 11px;
		color: #999;
	}
	:global(.dark) .sidebar-hint {
		color: #666;
	}

	.cover-preview {
		margin-top: 8px;
		border-radius: 8px;
		overflow: hidden;
		border: 1px solid var(--border, #e5e7eb);
	}
	.cover-preview img {
		width: 100%;
		height: 120px;
		object-fit: cover;
		display: block;
	}
	:global(.dark) .cover-preview {
		border-color: #374151;
	}

	.tag-list {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.tag-chip {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border-radius: 20px;
		font-size: 12px;
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		border: 1px solid hsla(var(--theme-hue, 165), 70%, 50%, 0.2);
	}
	:global(.dark) .tag-chip {
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}

	.checkbox-section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-color, #374151);
		cursor: pointer;
		user-select: none;
	}
	:global(.dark) .checkbox-label {
		color: #d0d0d0;
	}

	.checkbox-label input[type="checkbox"] {
		display: none;
	}

	.checkbox-custom {
		width: 18px;
		height: 18px;
		border-radius: 5px;
		border: 2px solid var(--border, #d1d5db);
		background: var(--bg-color, white);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
		flex-shrink: 0;
	}
	:global(.dark) .checkbox-custom {
		background: #0f0f1a;
		border-color: #4b5563;
	}

	.checkbox-label input[type="checkbox"]:checked + .checkbox-custom {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.checkbox-label input[type="checkbox"]:checked + .checkbox-custom::after {
		content: "";
		width: 5px;
		height: 9px;
		border: solid white;
		border-width: 0 2px 2px 0;
		transform: rotate(45deg);
		margin-top: -2px;
	}

	/* Token status */
	.token-status {
		padding: 12px;
		border-radius: 10px;
		background: var(--bg-secondary, #f9fafb);
		border: 1px solid var(--border, #e5e7eb);
	}
	:global(.dark) .token-status {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.1);
	}

	.token-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
		margin-bottom: 8px;
	}
	:global(.dark) .token-indicator {
		color: #9ca3af;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ef4444;
		flex-shrink: 0;
	}
	.status-dot.ok {
		background: #22c55e;
	}

	.sidebar-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		border: none;
		transition: all 0.15s;
		font-family: inherit;
	}
	.sidebar-btn:hover {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}

	/* ===== Loading ===== */
	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100vh;
		gap: 16px;
		color: var(--text-secondary, #6b7280);
		font-size: 14px;
	}

	/* ===== Modal ===== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.modal-content {
		background: var(--card-bg, white);
		border-radius: 16px;
		width: 100%;
		max-width: 420px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.25s ease;
		overflow: hidden;
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
	}
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .modal-content {
		background: #1a1a2e;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
	}
	:global(.dark) .modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--text-color, #1a1a2e);
	}
	:global(.dark) .modal-header h3 {
		color: #f0f0f0;
	}
	.modal-close {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		transition: all 0.15s;
	}
	.modal-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #333;
	}
	:global(.dark) .modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.modal-body {
		padding: 16px 20px;
	}
	.modal-desc {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--text-secondary, #666);
		line-height: 1.6;
	}
	:global(.dark) .modal-desc {
		color: #aaa;
	}
	.modal-desc strong {
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.modal-input {
		width: 100%;
		padding: 10px 14px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 10px;
		font-size: 13px;
		font-family: monospace;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.2s;
		box-sizing: border-box;
	}
	.modal-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	:global(.dark) .modal-input {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.modal-help {
		margin-top: 10px;
	}
	.modal-help a {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		text-decoration: none;
	}
	.modal-help a:hover {
		text-decoration: underline;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 20px;
		border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
	}
	:global(.dark) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.1);
	}
	.modal-btn {
		padding: 8px 18px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-family: inherit;
	}
	.modal-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.modal-btn-cancel:hover {
		background: var(--border, #e5e7eb);
	}
	:global(.dark) .modal-btn-cancel {
		background: #2d2d44;
		color: #d1d5db;
	}
	:global(.dark) .modal-btn-cancel:hover {
		background: #3d3d55;
	}
	.modal-btn-confirm {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.modal-btn-confirm:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.modal-btn-confirm:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* ===== 响应式 ===== */
	@media (max-width: 768px) {
		.write-container {
			flex-direction: column;
			height: auto;
			min-height: calc(100vh - 56px);
		}
		.editor-panel {
			border-right: none;
			border-bottom: 1px solid rgba(0, 0, 0, 0.06);
			min-height: 50vh;
		}
		:global(.dark) .editor-panel {
			border-bottom-color: rgba(255, 255, 255, 0.08);
		}
		.sidebar-panel {
			width: 100%;
		}
		.title-input {
			padding: 20px 20px 12px;
			font-size: 22px;
		}
		.content-textarea {
			padding: 16px 20px;
		}
		.editor-footer {
			padding: 8px 20px;
		}
		.preview-panel {
			padding: 20px;
		}
		.btn-text {
			display: none;
		}
		.toolbar-btn {
			padding: 7px 10px;
		}
	}

	/* ===== 动画 ===== */
	.animate-spin {
		animation: spin 0.8s linear infinite;
	}
	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}
</style>
