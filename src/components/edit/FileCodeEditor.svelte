<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import {
	hasValidToken,
	getRepoFile,
	showToast,
	ensureIconify,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import { repoConfig } from "@/config/editConfig";

let {
	filePath,
	pageName = "配置",
	language = "typescript",
}: {
	filePath: string;
	pageName?: string;
	language?: string;
} = $props();

let editMode = $state(false);
let saving = $state(false);
let loading = $state(false);
let fileContent = $state("");
let originalContent = $state("");
let fileSha = $state<string | null>(null);
let textareaEl = $state<HTMLTextAreaElement>();
let contentLoaded = $state(false);

const drafts = setupRepoDrafts({
	pageKey: "filecode",
	pageName: pageName,
	getContent: () => fileContent,
	setContent: (v) => (fileContent = v),
	getPath: () => filePath,
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalContent,
	setOriginalContent: (v) => (originalContent = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: 更新${pageName}配置` : `chore: 创建${pageName}配置`,
});
let hasChanges = $derived(drafts.hasLocalChanges());

onMount(() => {
	ensureIconify();
});

async function loadFile() {
	if (!hasValidToken()) {
		showToast("请先导入密钥以加载当前配置", "warning");
		contentLoaded = true;
		drafts.restoreFromDrafts();
		return;
	}
	loading = true;
	try {
		const file = await getRepoFile(filePath, repoConfig);
		if (file) {
			fileContent = file.content;
			originalContent = file.content;
			fileSha = file.sha;
			contentLoaded = true;
		} else {
			showToast("无法获取文件内容，请检查仓库权限", "error");
		}
	} catch (e) {
		showToast("加载文件失败：" + (e as Error).message, "error");
	}
	loading = false;
	drafts.restoreFromDrafts();
}

async function enterEditMode() {
	editMode = true;
	if (!contentLoaded) {
		await loadFile();
	}
}

function cancelEdit() {
	fileContent = originalContent;
	editMode = false;
	drafts.clearDrafts();
}

function handleContentChange(e: Event) {
	const target = e.target as HTMLTextAreaElement;
	fileContent = target.value;
}

function handleReload() {
	contentLoaded = false;
	loadFile();
}

function handleSaveDraft() {
	drafts.saveToDrafts();
}

async function handleSubmit() {
	saving = true;
	try {
		await drafts.submitDrafts();
	} finally {
		saving = false;
	}
}

function handleKeyDown(e: KeyboardEvent) {
	if ((e.ctrlKey || e.metaKey) && e.key === "s") {
		e.preventDefault();
		if (hasChanges && !saving) {
			handleSubmit();
		}
	}
	if (e.key === "Escape") {
		if (hasChanges) {
			if (confirm("有未保存的更改，确定要取消吗？")) {
				cancelEdit();
			}
		} else {
			cancelEdit();
		}
	}
}

function handleTabKey(e: KeyboardEvent) {
	if (e.key === "Tab") {
		e.preventDefault();
		const textarea = e.target as HTMLTextAreaElement;
		const start = textarea.selectionStart;
		const end = textarea.selectionEnd;
		fileContent =
			fileContent.substring(0, start) + "\t" + fileContent.substring(end);
		setTimeout(() => {
			if (textareaEl) {
				textareaEl.selectionStart = textareaEl.selectionEnd = start + 1;
			}
		}, 0);
	}
}
</script>

<EditToast />

<div class="file-edit-toolbar-slot">
	<EditToolbar
		pageName={pageName}
		pageKey="filecode"
		mountTo=".page-header-toolbar-slot"
		{saving}
		{hasChanges}
		showAddButton={false}
		on:modeChange={(e) => {
			if (e.detail.editing) {
				enterEditMode();
			} else {
				cancelEdit();
			}
		}}
		on:cancel={cancelEdit}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
	/>
</div>

{#if editMode}
	<div class="file-code-editor">
		{#if loading}
			<div class="loading-state">
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin mr-2"></iconify-icon>
				加载文件中...
			</div>
		{:else}
			<div class="editor-info">
				<iconify-icon icon="material-symbols:code-rounded" class="text-lg"></iconify-icon>
				<span>正在编辑：{filePath}</span>
				{#if !fileSha}
					<button class="reload-btn" onclick={handleReload} title="重新加载文件">
						<iconify-icon icon="material-symbols:refresh-rounded"></iconify-icon>
						加载当前配置
					</button>
				{/if}
				<span class="editor-hint">Ctrl+S 保存 | Esc 取消</span>
			</div>
			<textarea
				bind:this={textareaEl}
				class="code-textarea"
				value={fileContent}
				oninput={handleContentChange}
				onkeydown={(e) => { handleKeyDown(e); handleTabKey(e); }}
				spellcheck="false"
				placeholder={`编辑 ${pageName} 配置...\n提示：点击"加载当前配置"从仓库获取最新内容，或直接粘贴/输入配置代码。`}
			></textarea>
		{/if}
	</div>
{/if}

<style>
	.file-code-editor {
		margin-top: 12px;
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		background: var(--card-bg, white);
	}
	:global(.dark) .file-code-editor {
		border-color: rgba(255, 255, 255, 0.08);
		background: rgba(23, 23, 23, 0.8);
	}

	.editor-info {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--btn-regular-bg, #f3f4f6);
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		font-size: 13px;
		color: var(--text-secondary, #4b5563);
		font-weight: 500;
	}
	:global(.dark) .editor-info {
		background: rgba(255, 255, 255, 0.03);
		border-bottom-color: rgba(255, 255, 255, 0.06);
		color: #d1d5db;
	}
	.reload-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-radius: 6px;
		border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: transparent;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.reload-btn:hover {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.editor-hint {
		margin-left: auto;
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		font-weight: 400;
	}

	.loading-state {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	.code-textarea {
		width: 100%;
		min-height: 500px;
		padding: 16px;
		border: none;
		font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
		font-size: 13px;
		line-height: 1.7;
		background: var(--bg-color, #fafafa);
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
		tab-size: 2;
		box-sizing: border-box;
		white-space: pre;
		overflow: auto;
	}
	:global(.dark) .code-textarea {
		background: #0d0d18;
		color: #e5e7eb;
	}

	@media (max-width: 768px) {
		.code-textarea {
			min-height: 300px;
			font-size: 12px;
			padding: 12px;
		}
		.editor-info {
			flex-wrap: wrap;
			padding: 8px 12px;
		}
		.editor-hint {
			margin-left: 0;
			width: 100%;
			margin-top: 4px;
		}
	}
</style>
