<script lang="ts">
	import { onMount, createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher();
	import {
		checkProxyConfigured,
		showToast,
		ensureIconify,
	} from "@/utils/editMode";

	let {
		pageName,
		saving,
		hasChanges,
		showAddButton = true,
		startInEditMode = false,
		persistentEdit = false,
		mountTo,
	}: {
		pageName: string;
		saving: boolean;
		hasChanges: boolean;
		showAddButton?: boolean;
		startInEditMode?: boolean;
		persistentEdit?: boolean;
		mountTo?: string;
	} = $props();

	let editMode = $state(false);
	let proxyReady = $state(false);
	let checkingProxy = $state(false);
	let showConfigHint = $state(false);
	let toolbarRootEl = $state<HTMLDivElement>();
	let mountedExternally = false;
	let hiddenWrapper: HTMLElement | null = null;
	let mountTarget: Element | null = null;

	onMount(async () => {
		ensureIconify();
		checkingProxy = true;
		proxyReady = await checkProxyConfigured();
		checkingProxy = false;
		if (startInEditMode) {
			editMode = true;
		}
		if (mountTo) {
			mountTarget = document.querySelector(mountTo);
			moveToolbar();
		}
		return () => {
			if (hiddenWrapper) {
				hiddenWrapper.style.display = "";
			}
		};
	});

	function moveToolbar() {
		if (mountTo && toolbarRootEl && mountTarget && !mountedExternally) {
			const wrapper = toolbarRootEl.parentElement;
			if (wrapper && wrapper !== mountTarget) {
				hiddenWrapper = wrapper as HTMLElement;
				hiddenWrapper.style.display = "none";
			}
			const firstChild = mountTarget.firstChild;
			if (firstChild) {
				mountTarget.insertBefore(toolbarRootEl, firstChild);
			} else {
				mountTarget.appendChild(toolbarRootEl);
			}
			mountedExternally = true;
		}
	}

	$effect(() => {
		if (mountTo && toolbarRootEl && mountTarget) {
			moveToolbar();
		}
		return () => {
			if (mountedExternally && toolbarRootEl && toolbarRootEl.parentNode) {
				toolbarRootEl.parentNode.removeChild(toolbarRootEl);
			}
		};
	});

	function enterEdit() {
		editMode = true;
		dispatch("modeChange", { editing: true });
	}

	function cancelEdit() {
		if (hasChanges && !confirm("你有未保存的更改，确定要取消吗？所有修改将丢失。")) {
			return;
		}
		if (!persistentEdit) {
			editMode = false;
			dispatch("modeChange", { editing: false });
		}
		dispatch("cancel");
	}

	function handleAdd() {
		dispatch("add");
	}

	async function handleSave() {
		if (!proxyReady) {
			checkingProxy = true;
			proxyReady = await checkProxyConfigured();
			checkingProxy = false;
			if (!proxyReady) {
				showToast("GitHub 代理未配置，请联系管理员部署环境变量", "error");
				showConfigHint = true;
				return;
			}
		}
		dispatch("save");
	}

	function toggleConfigHint() {
		showConfigHint = !showConfigHint;
	}
</script>

<div class="edit-toolbar" bind:this={toolbarRootEl} class:edit-toolbar--mounted={mountedExternally} class:edit-mode-toolbar={editMode}>
	{#if !editMode}
		<button class="edit-main-btn" onclick={enterEdit} title={`编辑${pageName}`}>
			<iconify-icon icon="material-symbols:edit-rounded" class="text-base"></iconify-icon>
			编辑{pageName}
		</button>
	{:else}
		<button class="edit-btn edit-btn-cancel" onclick={cancelEdit} title={persistentEdit ? "重置更改" : "取消编辑"}>
			<iconify-icon icon={persistentEdit ? "material-symbols:undo-rounded" : "material-symbols:close-rounded"} class="text-sm"></iconify-icon>
			{persistentEdit ? "重置" : "取消"}
		</button>
		<button
			class="edit-btn edit-btn-key"
			class:edit-btn-key-ok={proxyReady}
			class:edit-btn-key-err={!proxyReady && !checkingProxy}
			onclick={toggleConfigHint}
			title={proxyReady ? "GitHub 代理已连接" : "GitHub 代理未配置，点击查看帮助"}
		>
			{#if checkingProxy}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-sm animate-spin"></iconify-icon>
				检测中
			{:else if proxyReady}
				<iconify-icon icon="material-symbols:cloud-done-rounded" class="text-sm"></iconify-icon>
				已连接
			{:else}
				<iconify-icon icon="material-symbols:cloud-off-rounded" class="text-sm"></iconify-icon>
				未配置
			{/if}
		</button>
		{#if showAddButton !== false}
			<button class="edit-btn edit-btn-add" onclick={handleAdd}>
				<iconify-icon icon="material-symbols:add-rounded" class="text-base"></iconify-icon>
				添加
			</button>
		{/if}
		<button
			class="edit-btn edit-btn-save"
			onclick={handleSave}
			disabled={saving || (!proxyReady && !checkingProxy)}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-base animate-spin"></iconify-icon>
				保存中...
			{:else}
				<iconify-icon icon="material-symbols:save-rounded" class="text-base"></iconify-icon>
				保存
			{/if}
		</button>
	{/if}
</div>

{#if showConfigHint}
	<div class="hint-overlay" onclick={toggleConfigHint}>
		<div class="hint-card" onclick={(e) => e.stopPropagation()}>
			<div class="hint-header">
				<h3>
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-lg mr-2"></iconify-icon>
					GitHub 代理配置说明
				</h3>
				<button class="hint-close" onclick={toggleConfigHint}>
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
						<span>GitHub App 私钥（PEM 格式完整文本）</span>
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
					在 Vercel 中：Settings → Environment Variables；在 Cloudflare Pages/Workers 中：Settings → Environment Variables。
					配置后需重新部署才能生效。
				</p>
			</div>
		</div>
	</div>
{/if}

<style>
	.edit-toolbar {
		display: inline-flex;
		justify-content: flex-start;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
		vertical-align: middle;
	}

	.edit-toolbar--mounted {
		margin-bottom: 0;
	}

	.edit-main-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 16px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.9);
		background: transparent;
		color: rgba(0, 0, 0, 0.9);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
		white-space: nowrap;
		line-height: 1.5;
		height: auto;
	}
	.edit-main-btn:hover {
		background: rgba(0, 0, 0, 0.9);
		color: white;
	}
	:global(.dark) .edit-main-btn {
		border-color: rgba(255, 255, 255, 0.9);
		color: rgba(255, 255, 255, 0.9);
	}
	:global(.dark) .edit-main-btn:hover {
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.edit-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 14px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		background: transparent;
		white-space: nowrap;
	}

	.edit-btn-cancel {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-cancel:hover {
		border-color: rgba(0, 0, 0, 0.9);
		color: white;
		background: rgba(0, 0, 0, 0.9);
	}
	:global(.dark) .edit-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-cancel:hover {
		border-color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.9);
		color: rgba(0, 0, 0, 0.9);
	}

	.edit-btn-key {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-key:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 45%);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	.edit-btn-key-ok {
		border-color: #22c55e !important;
		color: #16a34a !important;
		background: rgba(34, 197, 94, 0.08) !important;
	}
	.edit-btn-key-err {
		border-color: #f59e0b !important;
		color: #d97706 !important;
		background: rgba(245, 158, 11, 0.08) !important;
	}
	:global(.dark) .edit-btn-key {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-key:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	:global(.dark) .edit-btn-key-ok {
		border-color: #4ade80 !important;
		color: #4ade80 !important;
		background: rgba(74, 222, 128, 0.12) !important;
	}
	:global(.dark) .edit-btn-key-err {
		border-color: #fbbf24 !important;
		color: #fbbf24 !important;
		background: rgba(251, 191, 36, 0.12) !important;
	}

	.edit-btn-add {
		border-color: rgba(0, 0, 0, 0.15);
		color: rgba(0, 0, 0, 0.6);
	}
	.edit-btn-add:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 45%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .edit-btn-add {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-add:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}

	.edit-btn-save {
		border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-weight: 600;
	}
	.edit-btn-save:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.edit-btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ====== 配置提示弹窗 ====== */
	.hint-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		z-index: 9998;
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
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .hint-card {
		background: #1a1a2e;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.hint-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	:global(.dark) .hint-header {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}
	.hint-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		display: flex;
		align-items: center;
		color: var(--text-color, #1a1a2e);
	}
	:global(.dark) .hint-header h3 {
		color: #f0f0f0;
	}
	.hint-close {
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
	.hint-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #333;
	}
	:global(.dark) .hint-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.hint-body {
		padding: 16px 20px;
		font-size: 13px;
		line-height: 1.7;
		color: var(--text-secondary, #555);
	}
	:global(.dark) .hint-body {
		color: #bbb;
	}
	.hint-body p {
		margin: 0 0 12px;
	}
	.hint-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}

	.env-table {
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		border-radius: 10px;
		overflow: hidden;
		margin: 12px 0;
	}
	:global(.dark) .env-table {
		border-color: rgba(255,255,255,0.1);
	}
	.env-row {
		display: grid;
		grid-template-columns: 160px 1fr;
		gap: 12px;
		padding: 10px 14px;
		align-items: center;
	}
	.env-row + .env-row {
		border-top: 1px solid var(--border, rgba(0,0,0,0.06));
	}
	:global(.dark) .env-row + .env-row {
		border-top-color: rgba(255,255,255,0.06);
	}
	.env-row-head {
		font-weight: 700;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: var(--bg-secondary, rgba(0,0,0,0.03));
		color: var(--text-color, #333);
	}
	:global(.dark) .env-row-head {
		background: rgba(255,255,255,0.04);
		color: #ddd;
	}
	.env-row code {
		font-family: "SF Mono", "Fira Code", monospace;
		font-size: 12px;
		padding: 3px 8px;
		border-radius: 5px;
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.08);
		color: hsl(var(--theme-hue, 165), 70%, 40%);
		font-weight: 600;
	}
	:global(.dark) .env-row code {
		color: hsl(var(--theme-hue, 165), 70%, 60%);
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
	}

	.hint-note {
		display: flex;
		align-items: flex-start;
		gap: 6px;
		margin: 12px 0 0 !important;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(245, 158, 11, 0.08);
		color: #92400e;
		font-size: 12px;
	}
	:global(.dark) .hint-note {
		background: rgba(251, 191, 36, 0.1);
		color: #fbbf24;
	}
</style>
