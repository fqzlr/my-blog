<script lang="ts">
	import { onMount, tick } from "svelte";
	import EditToolbar from "./EditToolbar.svelte";
	import EditToast from "./EditToast.svelte";
	import { marked } from "marked";
	import {
		getStoredToken,
		setStoredToken,
		hasValidToken,
		readFileAsText,
		validateToken,
		showToast,
		ensureIconify,
		getRepoFile,
		updateRepoFile,
	} from "@/utils/editMode";
	import { repoConfig } from "@/config/editConfig";

	let {
		filePath,
		pageName = "页面",
		initialContent = "",
		previewOnly = false,
	}: {
		filePath: string;
		pageName?: string;
		initialContent?: string;
		previewOnly?: boolean;
	} = $props();

	let editMode = $state(false);
	let hasToken = $state(false);
	let saving = $state(false);
	let hasChanges = $state(false);
	let content = $state(initialContent);
	let originalContent = $state(initialContent);
	let existingSha = $state<string | null>(null);
	let showPreview = $state(true);

	let textareaEl: HTMLTextAreaElement | undefined;
	let contentDisplayEl: HTMLDivElement | undefined;

	onMount(() => {
		ensureIconify();
		hasToken = hasValidToken();
	});

	function enterEditMode() {
		originalContent = content;
		editMode = true;
		hasChanges = false;
		tick().then(() => {
			textareaEl?.focus();
		});
	}

	function cancelEdit() {
		content = originalContent;
		editMode = false;
		hasChanges = false;
		showToast("已取消编辑", "info");
	}

	function handleContentChange(e: Event) {
		const target = e.target as HTMLTextAreaElement;
		content = target.value;
		hasChanges = content !== originalContent;
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === "Tab") {
			e.preventDefault();
			const textarea = e.currentTarget as HTMLTextAreaElement;
			const start = textarea.selectionStart;
			const end = textarea.selectionEnd;
			content = content.substring(0, start) + "  " + content.substring(end);
			hasChanges = content !== originalContent;
			tick().then(() => {
				textarea.focus();
				textarea.setSelectionRange(start + 2, start + 2);
			});
		}
		if ((e.ctrlKey || e.metaKey) && e.key === "s") {
			e.preventDefault();
			handleSave();
		}
	}

	async function handleSave() {
		if (!hasValidToken()) {
			showToast("请先导入密钥", "warning");
			return;
		}
		if (!content.trim()) {
			showToast("内容不能为空", "warning");
			return;
		}
		saving = true;
		try {
			if (!existingSha) {
				const file = await getRepoFile(filePath, repoConfig);
				if (file) {
					existingSha = file.sha;
				}
			}
			const commitMsg = `chore(pages): update "${pageName}" content`;
			let ok = false;
			if (existingSha) {
				ok = await updateRepoFile(filePath, content, existingSha, commitMsg, repoConfig);
			}
			if (ok) {
				originalContent = content;
				hasChanges = false;
				showToast("保存成功！刷新页面查看效果", "success");
				const file = await getRepoFile(filePath, repoConfig);
				if (file) {
					existingSha = file.sha;
				}
			} else {
				showToast("保存失败，请检查Token权限（需要repo权限）", "error");
			}
		} catch (err) {
			showToast("保存出错，请检查网络连接", "error");
			console.error(err);
		} finally {
			saving = false;
		}
	}

	function handleTokenReady() {
		hasToken = hasValidToken();
	}

	function insertFormat(before: string, after: string = "") {
		if (!textareaEl) return;
		const start = textareaEl.selectionStart;
		const end = textareaEl.selectionEnd;
		const selected = content.substring(start, end);
		const newText = before + selected + after;
		content = content.substring(0, start) + newText + content.substring(end);
		hasChanges = content !== originalContent;
		tick().then(() => {
			textareaEl?.focus();
			textareaEl?.setSelectionRange(start + before.length, start + before.length + selected.length);
		});
	}

	const renderedHtml = $derived.by(() => {
		if (!content) return "";
		try {
			return marked.parse(content, { gfm: true, breaks: true }) as string;
		} catch {
			return content;
		}
	});
</script>

<EditToast />

{#if !previewOnly}
	<div class="md-toolbar-slot">
		<EditToolbar
			pageName={pageName}
			saving={saving}
			hasChanges={hasChanges}
			showAddButton={false}
			persistentEdit={false}
			on:modeChange={(e) => {
				if (e.detail.editing) {
					enterEditMode();
				} else {
					cancelEdit();
				}
			}}
			on:cancel={cancelEdit}
			on:save={handleSave}
			on:tokenReady={handleTokenReady}
		/>
	</div>
{/if}

{#if editMode}
	<div class="md-editor-container">
		<div class="md-editor-toolbar">
			<button class="md-format-btn" onclick={() => insertFormat("**", "**")} title="加粗 (Ctrl+B)">
				<iconify-icon icon="material-symbols:format-bold-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("*", "*")} title="斜体 (Ctrl+I)">
				<iconify-icon icon="material-symbols:format-italic-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("~~", "~~")} title="删除线">
				<iconify-icon icon="material-symbols:format-strikethrough-rounded"></iconify-icon>
			</button>
			<span class="md-sep"></span>
			<button class="md-format-btn" onclick={() => insertFormat("## ")} title="二级标题">
				<iconify-icon icon="material-symbols:format-h2-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("### ")} title="三级标题">
				<iconify-icon icon="material-symbols:format-h3-rounded"></iconify-icon>
			</button>
			<span class="md-sep"></span>
			<button class="md-format-btn" onclick={() => insertFormat("> ")} title="引用">
				<iconify-icon icon="material-symbols:format-quote-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("`", "`")} title="行内代码">
				<iconify-icon icon="material-symbols:code-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("\n```\n", "\n```\n")} title="代码块">
				<iconify-icon icon="material-symbols:data-object-rounded"></iconify-icon>
			</button>
			<span class="md-sep"></span>
			<button class="md-format-btn" onclick={() => insertFormat("- ")} title="无序列表">
				<iconify-icon icon="material-symbols:format-list-bulleted-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("1. ")} title="有序列表">
				<iconify-icon icon="material-symbols:format-list-numbered-rounded"></iconify-icon>
			</button>
			<span class="md-sep"></span>
			<button class="md-format-btn" onclick={() => insertFormat("[", "](https://)")} title="链接 (Ctrl+K)">
				<iconify-icon icon="material-symbols:link-rounded"></iconify-icon>
			</button>
			<button class="md-format-btn" onclick={() => insertFormat("![", "](https://)")} title="图片">
				<iconify-icon icon="material-symbols:image-rounded"></iconify-icon>
			</button>
			<span class="md-sep"></span>
			<button class="md-format-btn" onclick={() => insertFormat("\n---\n")} title="分割线">
				<iconify-icon icon="material-symbols:horizontal-rule-rounded"></iconify-icon>
			</button>
		</div>
		<div class="md-editor-panels">
			<div class="md-panel md-panel-edit">
				<div class="md-panel-header">编辑</div>
				<textarea
					bind:this={textareaEl}
					class="md-textarea"
					value={content}
					oninput={handleContentChange}
					onkeydown={handleKeyDown}
					placeholder="在此输入 Markdown 内容..."
					spellcheck="false"
				></textarea>
			</div>
			<div class="md-panel md-panel-preview">
				<div class="md-panel-header">预览</div>
				<div class="md-preview-content" bind:this={contentDisplayEl}>
					{@html renderedHtml}
				</div>
			</div>
		</div>
	</div>
{:else}
	<div class="md-content-display">
		{@html renderedHtml}
	</div>
{/if}

<style>
	.md-toolbar-slot {
		margin-bottom: 16px;
	}

	.md-editor-container {
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 12px;
		overflow: hidden;
		background: var(--bg-color, white);
	}
	:global(.dark) .md-editor-container {
		border-color: #374151;
		background: var(--card-bg, #141420);
	}

	.md-editor-toolbar {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 8px 12px;
		background: var(--bg-secondary, #f9fafb);
		border-bottom: 1px solid var(--border, #e5e7eb);
		flex-wrap: wrap;
	}
	:global(.dark) .md-editor-toolbar {
		background: #1a1a2e;
		border-bottom-color: #374151;
	}

	.md-format-btn {
		width: 32px;
		height: 32px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		border-radius: 6px;
		cursor: pointer;
		color: var(--text-secondary, #6b7280);
		font-size: 18px;
		transition: all 0.15s;
	}
	.md-format-btn:hover {
		background: rgba(0, 0, 0, 0.06);
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .md-format-btn:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #f0f0f0;
	}

	.md-sep {
		width: 1px;
		height: 20px;
		background: var(--border, #d1d5db);
		margin: 0 4px;
	}
	:global(.dark) .md-sep {
		background: #4b5563;
	}

	.md-editor-panels {
		display: grid;
		grid-template-columns: 1fr 1fr;
		min-height: 400px;
	}
	@media (max-width: 768px) {
		.md-editor-panels {
			grid-template-columns: 1fr;
		}
	}

	.md-panel {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.md-panel-edit {
		border-right: 1px solid var(--border, #e5e7eb);
	}
	:global(.dark) .md-panel-edit {
		border-right-color: #374151;
	}
	@media (max-width: 768px) {
		.md-panel-edit {
			border-right: none;
			border-bottom: 1px solid var(--border, #e5e7eb);
		}
	}

	.md-panel-header {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--text-secondary, #6b7280);
		padding: 8px 16px;
		background: var(--bg-secondary, #fafafa);
		border-bottom: 1px solid var(--border, #e5e7eb);
	}
	:global(.dark) .md-panel-header {
		background: #151525;
		border-bottom-color: #374151;
		color: #9ca3af;
	}

	.md-textarea {
		flex: 1;
		width: 100%;
		min-height: 350px;
		padding: 20px;
		border: none;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		font-size: 14px;
		line-height: 1.7;
		font-family: "JetBrains Mono", "Fira Code", Consolas, monospace;
		resize: vertical;
		outline: none;
		box-sizing: border-box;
		tab-size: 2;
	}
	:global(.dark) .md-textarea {
		background: var(--card-bg, #141420);
		color: #e5e7eb;
	}

	.md-preview-content {
		flex: 1;
		padding: 20px;
		overflow-y: auto;
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .md-preview-content {
		color: #e5e7eb;
	}

	.md-content-display {
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .md-content-display {
		color: #e5e7eb;
	}

	/* Preview markdown styles */
	.md-preview-content :global(h1),
	.md-preview-content :global(h2),
	.md-preview-content :global(h3),
	.md-preview-content :global(h4),
	.md-content-display :global(h1),
	.md-content-display :global(h2),
	.md-content-display :global(h3),
	.md-content-display :global(h4) {
		margin-top: 1.5em;
		margin-bottom: 0.5em;
		font-weight: 700;
	}
	.md-preview-content :global(h2),
	.md-content-display :global(h2) { font-size: 1.5em; }
	.md-preview-content :global(h3),
	.md-content-display :global(h3) { font-size: 1.25em; }

	.md-preview-content :global(p),
	.md-content-display :global(p) {
		margin: 1em 0;
	}

	.md-preview-content :global(ul),
	.md-preview-content :global(ol),
	.md-content-display :global(ul),
	.md-content-display :global(ol) {
		margin: 1em 0;
		padding-left: 2em;
	}

	.md-preview-content :global(li),
	.md-content-display :global(li) {
		margin: 0.3em 0;
	}

	.md-preview-content :global(blockquote),
	.md-content-display :global(blockquote) {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 4px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.05);
		border-radius: 0 8px 8px 0;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .md-preview-content :global(blockquote),
	:global(.dark) .md-content-display :global(blockquote) {
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}

	.md-preview-content :global(code),
	.md-content-display :global(code) {
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.06);
		font-family: "JetBrains Mono", Consolas, monospace;
		font-size: 0.9em;
	}
	:global(.dark) .md-preview-content :global(code),
	:global(.dark) .md-content-display :global(code) {
		background: rgba(255, 255, 255, 0.1);
	}

	.md-preview-content :global(pre),
	.md-content-display :global(pre) {
		margin: 1em 0;
		padding: 16px 20px;
		background: #1e1e2e;
		border-radius: 8px;
		overflow-x: auto;
	}
	.md-preview-content :global(pre code),
	.md-content-display :global(pre code) {
		padding: 0;
		background: transparent;
		color: #e0e0e0;
		font-size: 0.9em;
	}

	.md-preview-content :global(a),
	.md-content-display :global(a) {
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		text-decoration: none;
	}
	.md-preview-content :global(a:hover),
	.md-content-display :global(a:hover) {
		text-decoration: underline;
	}

	.md-preview-content :global(img),
	.md-content-display :global(img) {
		max-width: 100%;
		border-radius: 8px;
		margin: 12px 0;
	}

	.md-preview-content :global(table),
	.md-content-display :global(table) {
		width: 100%;
		border-collapse: collapse;
		margin: 1em 0;
		font-size: 0.95em;
	}
	.md-preview-content :global(th),
	.md-preview-content :global(td),
	.md-content-display :global(th),
	.md-content-display :global(td) {
		padding: 10px 14px;
		border: 1px solid var(--border, #e5e7eb);
		text-align: left;
	}
	:global(.dark) .md-preview-content :global(th),
	:global(.dark) .md-preview-content :global(td),
	:global(.dark) .md-content-display :global(th),
	:global(.dark) .md-content-display :global(td) {
		border-color: #374151;
	}
	.md-preview-content :global(th),
	.md-content-display :global(th) {
		background: var(--bg-secondary, #f9fafb);
		font-weight: 600;
	}
	:global(.dark) .md-preview-content :global(th),
	:global(.dark) .md-content-display :global(th) {
		background: #1f2937;
	}

	.md-preview-content :global(hr),
	.md-content-display :global(hr) {
		margin: 2em 0;
		border: none;
		border-top: 1px solid var(--border, #e5e7eb);
	}
	:global(.dark) .md-preview-content :global(hr),
	:global(.dark) .md-content-display :global(hr) {
		border-top-color: #374151;
	}
</style>
