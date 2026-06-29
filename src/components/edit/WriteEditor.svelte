<script lang="ts">
	import { onMount, tick } from "svelte";
	import EditToast from "./EditToast.svelte";
	import { marked } from "marked";
	import {
		checkProxyConfigured,
		showToast,
		ensureIconify,
		getRepoFile,
		createRepoFile,
		updateRepoFile,
		readFileAsText,
	} from "@/utils/editMode";
	import { repoConfig } from "@/config/editConfig";

	const postFiles = import.meta.glob("../../content/posts/**/*.{md,mdx}", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

	// ============ State ============
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

	let proxyReady = $state(false);
	let checkingProxy = $state(false);
	let saving = $state(false);
	let loading = $state(false);
	let editMode = $state(false);
	let existingSha = $state<string | null>(null);
	let existingExt = $state<".md" | ".mdx">(".md");
	let savePath = $state<string>("");
	let showPreview = $state(false);
	let showConfigHint = $state(false);
	let saveSuccess = $state(false);

	// Refs
	let mdFileInput: HTMLInputElement | undefined;
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

	let articleUrl = $derived.by(() => {
		if (editMode && savePath) {
			const pathParts = savePath.replace(/^src\/content\//, "").split("/");
			if (pathParts[0] === "posts") {
				pathParts.shift();
			}
			return `/posts/${pathParts.join("/")}/`;
		}
		return `/posts/blog/${slug}/`;
	});

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
		const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
		if (!match) {
			return { data: {}, body: normalized };
		}
		const fmBlock = match[1];
		const body = match[2];
		const data: Record<string, any> = {};

		const lines = fmBlock.split("\n");
		let currentArrayKey: string | null = null;
		for (const line of lines) {
			const arrMatch = line.match(/^\s*-\s+(.+)$/);
			if (arrMatch && currentArrayKey) {
				if (!Array.isArray(data[currentArrayKey])) {
					data[currentArrayKey] = [];
				}
				data[currentArrayKey].push(parseYamlValue(arrMatch[1]));
				continue;
			}
			const kvMatch = line.match(/^([\w-]+)\s*:\s*(.*)$/);
			if (kvMatch) {
				const key = kvMatch[1];
				const val = kvMatch[2].trim();
				currentArrayKey = null;
				if (val === "" || val === "[]") {
					data[key] = [];
					currentArrayKey = key;
				} else if (val.startsWith("[") && val.endsWith("]")) {
					const inner = val.slice(1, -1).trim();
					if (inner === "") {
						data[key] = [];
					} else {
						data[key] = inner.split(",").map(s => parseYamlValue(s.trim())).filter(v => v !== "");
					}
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
		if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
			return v.slice(1, -1);
		}
		if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
			return v;
		}
		if (/^-?\d+(\.\d+)?$/.test(v)) {
			return Number(v);
		}
		return v;
	}

	// ============ Load article from local files ============
	function loadArticleFromLocal(pathParam: string): boolean {
		const possibleKeys: string[] = [];
		const baseRelPath = `../../content/${pathParam}`;
		possibleKeys.push(baseRelPath + ".md");
		possibleKeys.push(baseRelPath + ".mdx");
		if (!pathParam.includes("/")) {
			possibleKeys.push(`../../content/posts/${pathParam}.md`);
			possibleKeys.push(`../../content/posts/${pathParam}.mdx`);
			possibleKeys.push(`../../content/posts/blog/${pathParam}.md`);
			possibleKeys.push(`../../content/posts/blog/${pathParam}.mdx`);
		}

		for (const key of possibleKeys) {
			if (postFiles[key]) {
				const rawContent = postFiles[key];
				const ext = key.endsWith(".mdx") ? ".mdx" : ".md";
				const { data: fmData, body } = parseFrontmatter(rawContent);

				existingExt = ext;
				slug = pathParam.includes("/") ? pathParam.split("/").pop() || "" : pathParam;
				savePath = `src/content/${pathParam}`;
				editMode = true;

				title = fmData.title || "";
				content = body || "";
				description = fmData.description || "";
				coverUrl = fmData.image || "";
				category = fmData.category || "";
				isDraft = !!fmData.draft;
				isPinned = !!fmData.pinned;

				if (Array.isArray(fmData.tags)) {
					tagsInput = fmData.tags.join(", ");
				}

				if (fmData.published) {
					const d = fmData.published instanceof Date ? fmData.published : new Date(fmData.published);
					pubDate = isNaN(d.getTime()) ? today : d.toISOString().slice(0, 10);
				}

				showToast("文章已加载", "success");
				return true;
			}
		}
		return false;
	}

	// ============ Load article from sessionStorage ============
	function loadArticleFromSession(data: any): boolean {
		if (!data || !data.rawContent) return false;
		try {
			const rawContent: string = data.rawContent;
			const { data: fmData, body } = parseFrontmatter(rawContent);

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

			const tagList = data.tags || fmData.tags;
			if (Array.isArray(tagList)) {
				tagsInput = tagList.join(", ");
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
			if (loadArticleFromLocal(pathParam)) {
				loading = false;
				tryGetShaFromGitHub(pathParam);
				return;
			}

			try {
				const sessionData = sessionStorage.getItem("write-editor-article");
				if (sessionData) {
					const parsed = JSON.parse(sessionData);
					sessionStorage.removeItem("write-editor-article");
					if (parsed.fullPath && pathParam.includes(parsed.slug || "")) {
						if (loadArticleFromSession(parsed)) {
							loading = false;
							tryGetShaFromGitHub(pathParam);
							return;
						}
					}
				}
			} catch(e) {
				console.warn("SessionStorage parse error:", e);
			}

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
			const pathParts = foundPath.split("/");
			const fileName = pathParts[pathParts.length - 1];
			slug = fileName.replace(/\.(md|mdx)$/, "");
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

		checkingProxy = true;
		proxyReady = await checkProxyConfigured();
		checkingProxy = false;

		if (!proxyReady) {
			showToast("GitHub 代理未配置，请联系管理员设置环境变量", "error");
			showConfigHint = true;
			return;
		}

		saving = true;
		try {
			const fullContent = buildFullContent();
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
				saveSuccess = true;
				setTimeout(() => (saveSuccess = false), 5000);
				const result = await getRepoFile(filePath, repoConfig);
				if (result) {
					existingSha = result.sha;
				}
			} else {
				showToast("保存失败，请检查 GitHub App 权限配置", "error");
			}
		} catch (err) {
			showToast("保存出错，请检查网络连接", "error");
		} finally {
			saving = false;
		}
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

	function renderMarkdown(md: string): string {
		if (!md) return "";
		try {
			return marked.parse(md, {
				gfm: true,
				breaks: true,
			}) as string;
		} catch (e) {
			console.error("Markdown parse error:", e);
			return `<p>${md}</p>`;
		}
	}

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
	onMount(async () => {
		ensureIconify();
		checkingProxy = true;
		proxyReady = await checkProxyConfigured();
		checkingProxy = false;

		const params = new URLSearchParams(window.location.search);
		const pathParam = params.get("path");
		const slugParam = params.get("slug");
		if (pathParam) {
			loadArticle(pathParam);
		} else if (slugParam) {
			loadArticle(slugParam);
		} else {
			pubDate = today;
		}
	});
</script>

<EditToast />

<div class="write-toolbar">
	<div class="toolbar-left">
		<a href="/list/" class="toolbar-btn toolbar-back" title="返回文章列表" data-no-swup>
			<iconify-icon icon="material-symbols:arrow-back-rounded" class="text-lg"></iconify-icon>
			<span class="btn-text">返回列表</span>
		</a>
	</div>
	<div class="toolbar-right">
		{#if saveSuccess && proxyReady && editMode}
			<a href={articleUrl} class="toolbar-btn toolbar-view" target="_blank" title="在新窗口预览文章">
				<iconify-icon icon="material-symbols:open-in-new-rounded" class="text-lg"></iconify-icon>
				<span class="btn-text">查看文章</span>
			</a>
		{/if}
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
			title={editMode ? "保存文章" : "发布文章"}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-lg animate-spin"></iconify-icon>
				<span class="btn-text">{editMode ? "保存中..." : "发布中..."}</span>
			{:else}
				<iconify-icon icon={editMode ? "material-symbols:save-rounded" : "material-symbols:send-rounded"} class="text-lg"></iconify-icon>
				<span class="btn-text">{editMode ? "保存" : "发布"}</span>
			{/if}
		</button>

		<input
			bind:this={mdFileInput}
			type="file"
			accept=".md,.markdown,.mdx"
			style="display:none"
			onchange={handleMdFileSelect}
		/>
	</div>
</div>

{#if loading}
	<div class="loading-state">
		<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-4xl animate-spin"></iconify-icon>
		<p>加载文章中...</p>
	</div>
{:else}
	<div class="write-container" class:preview-mode={showPreview}>
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

			<div class="sidebar-section proxy-status" onclick={() => (showConfigHint = !showConfigHint)} role="button" tabindex="0">
				<div class="proxy-indicator">
					{#if checkingProxy}
						<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-base animate-spin"></iconify-icon>
						<span>检测中...</span>
					{:else if proxyReady}
						<iconify-icon icon="material-symbols:cloud-done-rounded" class="text-base" style="color:#22c55e"></iconify-icon>
						<span>GitHub 代理已连接</span>
					{:else}
						<iconify-icon icon="material-symbols:cloud-off-rounded" class="text-base" style="color:#f59e0b"></iconify-icon>
						<span>代理未配置 - 点击查看帮助</span>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

{#if showConfigHint}
	<div class="hint-overlay" onclick={() => (showConfigHint = false)}>
		<div class="hint-card" onclick={(e) => e.stopPropagation()}>
			<div class="hint-header">
				<h3>
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-lg mr-2"></iconify-icon>
					GitHub 代理配置说明
				</h3>
				<button class="hint-close" onclick={() => (showConfigHint = false)}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="hint-body">
				<p>
					在线编辑功能使用 <strong>服务端 GitHub App 代理</strong> 进行认证，无需在浏览器导入密钥。
					站点管理员需在部署平台添加以下环境变量：
				</p>
				<div class="env-table">
					<div class="env-row env-row-head">
						<span>变量名</span><span>说明</span>
					</div>
					<div class="env-row">
						<code>GH_APP_ID</code>
						<span>GitHub App 的数字 ID</span>
					</div>
					<div class="env-row">
						<code>GH_PRIVATE_KEY</code>
						<span>GitHub App 私钥（PEM 格式完整文本，含换行符）</span>
					</div>
					<div class="env-row">
						<code>GH_USER</code>
						<span>仓库所有者用户名（默认 fqzlr）</span>
					</div>
					<div class="env-row">
						<code>GH_REPO</code>
						<span>仓库名（默认 my-blog）</span>
					</div>
				</div>
				<p class="hint-note">
					<iconify-icon icon="material-symbols:lightbulb-outline-rounded" class="text-sm"></iconify-icon>
					在 Vercel 中：Settings → Environment Variables；在 Cloudflare Pages 中：Settings → Environment Variables。
					私钥包含换行符，在 Vercel/Cloudflare 环境变量中直接粘贴完整 PEM 文本即可。配置后需重新部署生效。
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(.write-editor-wrapper) {
		--theme-hue: var(--editor-theme-hue, 165);
		--bg-color: var(--card-bg, #ffffff);
		--bg-secondary: var(--bg-secondary, #f3f4f6);
		--text-color: var(--text-color, #1a1a2e);
		--text-secondary: var(--text-secondary, #6b7280);
		--border: var(--border, #e5e7eb);
	}

	.write-toolbar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 24px;
		background: var(--bg-color, white);
		border-top: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		min-height: 56px;
		box-sizing: border-box;
		position: sticky;
		top: 0;
		z-index: 10;
		border-radius: 0;
		margin: 0;
	}
	:global(.dark) .write-toolbar {
		background: var(--card-bg, #141420);
		border-top-color: rgba(255, 255, 255, 0.08);
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}

	.toolbar-left,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
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

	.toolbar-view {
		background: #22c55e;
		color: white !important;
		font-weight: 600;
		box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3);
		animation: pulseSuccess 1s ease-in-out infinite alternate;
	}
	.toolbar-view:hover {
		background: #16a34a !important;
		transform: translateY(-1px);
		box-shadow: 0 4px 16px rgba(34, 197, 94, 0.4);
	}
	@keyframes pulseSuccess {
		from { box-shadow: 0 2px 8px rgba(34, 197, 94, 0.3); }
		to { box-shadow: 0 2px 16px rgba(34, 197, 94, 0.6); }
	}

	.write-container {
		display: flex;
		min-height: 500px;
	}

	.editor-panel {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 500px;
		border-right: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		background: var(--bg-color, white);
	}
	:global(.dark) .editor-panel {
		border-right-color: rgba(255, 255, 255, 0.08);
		background: var(--card-bg, #141420);
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
		min-height: 300px;
		padding: 24px 40px;
		border: none;
		background: transparent;
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
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
	.preview-panel :global(h3) { margin-top: 1.5em; margin-bottom: 0.5em; }
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
	:global(.dark) .preview-panel :global(code) { background: rgba(255, 255, 255, 0.1); }
	.preview-panel :global(a) { color: hsl(var(--theme-hue, 165), 70%, 45%); text-decoration: none; }
	.preview-panel :global(a:hover) { text-decoration: underline; }
	.preview-panel :global(img) { max-width: 100%; border-radius: 8px; margin: 12px 0; }
	.preview-panel :global(p) { margin: 1em 0; }
	.preview-panel :global(ul), .preview-panel :global(ol) { margin: 1em 0; padding-left: 2em; }
	.preview-panel :global(li) { margin: 0.3em 0; }
	.preview-panel :global(blockquote) {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 4px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.05);
		border-radius: 0 8px 8px 0;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .preview-panel :global(blockquote) { background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1); }
	.preview-panel :global(pre) {
		margin: 1em 0;
		padding: 16px 20px;
		background: #1e1e2e;
		border-radius: 8px;
		overflow-x: auto;
		font-family: "JetBrains Mono", Consolas, monospace;
		font-size: 0.9em;
		line-height: 1.6;
	}
	.preview-panel :global(pre code) { padding: 0; background: transparent; color: #e0e0e0; font-size: inherit; }
	.preview-panel :global(hr) { margin: 2em 0; border: none; border-top: 1px solid var(--border, #e5e7eb); }
	:global(.dark) .preview-panel :global(hr) { border-top-color: #374151; }

	.sidebar-panel {
		width: 320px;
		flex-shrink: 0;
		padding: 20px;
		overflow-y: auto;
		background: var(--card-bg, white);
		box-sizing: border-box;
	}
	:global(.dark) .sidebar-panel { background: #141420; }
	.sidebar-section { margin-bottom: 20px; }
	.sidebar-label {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-color, #1a1a2e);
		margin-bottom: 8px;
	}
	:global(.dark) .sidebar-label { color: #d0d0d0; }
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
	:global(.dark) .sidebar-input { background: #0f0f1a; border-color: #374151; color: #e5e7eb; }
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
	:global(.dark) .sidebar-textarea { background: #0f0f1a; border-color: #374151; color: #e5e7eb; }
	.sidebar-hint { margin: 4px 0 0; font-size: 11px; color: #999; }
	:global(.dark) .sidebar-hint { color: #666; }
	.cover-preview { margin-top: 8px; border-radius: 8px; overflow: hidden; border: 1px solid var(--border, #e5e7eb); }
	.cover-preview img { width: 100%; height: 120px; object-fit: cover; display: block; }
	:global(.dark) .cover-preview { border-color: #374151; }
	.tag-list { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
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
	.checkbox-section { display: flex; flex-direction: column; gap: 10px; }
	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-color, #374151);
		cursor: pointer;
		user-select: none;
	}
	:global(.dark) .checkbox-label { color: #d0d0d0; }
	.checkbox-label input[type="checkbox"] { display: none; }
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
	:global(.dark) .checkbox-custom { background: #0f0f1a; border-color: #4b5563; }
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

	.proxy-status {
		padding: 12px;
		border-radius: 10px;
		background: var(--bg-secondary, #f9fafb);
		border: 1px solid var(--border, #e5e7eb);
		cursor: pointer;
		transition: all 0.15s;
	}
	.proxy-status:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	:global(.dark) .proxy-status {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.1);
	}
	.proxy-indicator {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .proxy-indicator { color: #9ca3af; }

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 50vh;
		padding: 80px 20px;
		gap: 16px;
		color: var(--text-secondary, #6b7280);
		font-size: 14px;
	}

	/* ===== Config hint modal ===== */
	.hint-overlay {
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
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	.hint-card {
		background: var(--card-bg, white);
		border-radius: 16px;
		width: 100%;
		max-width: 520px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.25s ease;
		overflow: hidden;
		border: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	@keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
	:global(.dark) .hint-card { background: #1a1a2e; border-color: rgba(255,255,255,0.1); }
	.hint-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	:global(.dark) .hint-header { border-bottom-color: rgba(255,255,255,0.1); }
	.hint-header h3 {
		margin: 0; font-size: 16px; font-weight: 700;
		display: flex; align-items: center; color: var(--text-color, #1a1a2e);
	}
	:global(.dark) .hint-header h3 { color: #f0f0f0; }
	.hint-close {
		width: 30px; height: 30px; border-radius: 8px; border: none; background: transparent;
		cursor: pointer; display: flex; align-items: center; justify-content: center;
		color: #888; transition: all 0.15s;
	}
	.hint-close:hover { background: rgba(0,0,0,0.06); color: #333; }
	:global(.dark) .hint-close:hover { background: rgba(255,255,255,0.1); color: #fff; }
	.hint-body { padding: 16px 20px; font-size: 13px; line-height: 1.7; color: var(--text-secondary, #555); }
	:global(.dark) .hint-body { color: #bbb; }
	.hint-body p { margin: 0 0 12px; }
	.hint-body strong { color: hsl(var(--theme-hue,165),70%,45%); }
	.env-table {
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		border-radius: 10px; overflow: hidden; margin: 12px 0;
	}
	:global(.dark) .env-table { border-color: rgba(255,255,255,0.1); }
	.env-row {
		display: grid; grid-template-columns: 160px 1fr; gap: 12px;
		padding: 10px 14px; align-items: center;
	}
	.env-row + .env-row { border-top: 1px solid var(--border, rgba(0,0,0,0.06)); }
	:global(.dark) .env-row + .env-row { border-top-color: rgba(255,255,255,0.06); }
	.env-row-head {
		font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;
		background: var(--bg-secondary, rgba(0,0,0,0.03)); color: var(--text-color,#333);
	}
	:global(.dark) .env-row-head { background: rgba(255,255,255,0.04); color: #ddd; }
	.env-row code {
		font-family: "SF Mono","Fira Code",monospace; font-size: 12px; padding: 3px 8px;
		border-radius: 5px; background: hsla(var(--theme-hue,165),70%,50%,0.08);
		color: hsl(var(--theme-hue,165),70%,40%); font-weight: 600;
	}
	:global(.dark) .env-row code { color: hsl(var(--theme-hue,165),70%,60%); background: hsla(var(--theme-hue,165),70%,50%,0.12); }
	.hint-note {
		display: flex; align-items: flex-start; gap: 6px; margin: 12px 0 0 !important;
		padding: 10px 12px; border-radius: 8px;
		background: rgba(245,158,11,0.08); color: #92400e; font-size: 12px;
	}
	:global(.dark) .hint-note { background: rgba(251,191,36,0.1); color: #fbbf24; }

	@media (max-width: 768px) {
		.write-container { flex-direction: column; min-height: 50vh; }
		.editor-panel { border-right: none; border-bottom: 1px solid rgba(0,0,0,0.06); min-height: 50vh; }
		:global(.dark) .editor-panel { border-bottom-color: rgba(255,255,255,0.08); }
		.sidebar-panel { width: 100%; }
		.title-input { padding: 20px 20px 12px; font-size: 22px; }
		.content-textarea { padding: 16px 20px; }
		.editor-footer { padding: 8px 20px; }
		.preview-panel { padding: 20px; }
		.btn-text { display: none; }
		.toolbar-btn { padding: 7px 10px; }
	}
	.animate-spin { animation: spin 0.8s linear infinite; }
	@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
