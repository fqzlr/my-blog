<script lang="ts">
	import { onMount, createEventDispatcher } from "svelte";
	const dispatch = createEventDispatcher();
	import {
		getStoredToken,
		setStoredToken,
		clearStoredToken,
		hasValidToken,
		readFileAsText,
		validateToken,
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
	let hasToken = $state(false);
	let showTokenModal = $state(false);
	let tokenInput = $state("");
	let validatingToken = $state(false);

	let keyFileInput = $state<HTMLInputElement | null>(null);
	let toolbarRootEl = $state<HTMLDivElement>();
	let mountedExternally = false;
	let hiddenWrapper: HTMLElement | null = null;
	let mountTarget: Element | null = null;

	onMount(() => {
		ensureIconify();
		hasToken = hasValidToken();
		tokenInput = getStoredToken();
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

	function handleImportKey() {
		if (hasToken) {
			if (confirm("已导入密钥。点击确定重新导入，点击取消保留当前密钥。")) {
				keyFileInput?.click();
			}
			return;
		}
		keyFileInput?.click();
	}

	async function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) {
			input.value = "";
			return;
		}
		try {
			const content = await readFileAsText(file);
			if (content.includes("-----BEGIN") && content.includes("PRIVATE KEY-----")) {
				showToast("检测到PEM私钥，当前版本使用GitHub PAT Token认证，请导入包含Token的文本文件", "warning");
				input.value = "";
				tokenInput = "";
				showTokenModal = true;
				return;
			}
			const token = content.trim();
			if (!token) {
				showToast("文件内容为空", "error");
				input.value = "";
				return;
			}
			await saveTokenValue(token);
		} catch (err) {
			showToast("读取文件失败", "error");
		}
		input.value = "";
	}

	function openManualInput() {
		tokenInput = getStoredToken();
		showTokenModal = true;
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
			showToast("Token验证失败，请检查Token权限（需要gist权限）", "error");
			return;
		}
		setStoredToken(trimmed);
		hasToken = true;
		showTokenModal = false;
		showToast("密钥导入成功！", "success");
		dispatch("tokenReady", { token: trimmed });
	}

	async function handleSaveToken() {
		await saveTokenValue(tokenInput);
	}

	function clearToken() {
		clearStoredToken();
		tokenInput = "";
		hasToken = false;
		showToast("已清除密钥", "info");
	}

	function handleAdd() {
		dispatch("add");
	}

	function handleSave() {
		if (!hasValidToken()) {
			showToast("请先导入密钥再保存", "warning");
			keyFileInput?.click();
			return;
		}
		dispatch("save");
	}

	function closeTokenModal() {
		showTokenModal = false;
	}
</script>

<!-- 单一容器，内部条件渲染内容 -->
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
			class:edit-btn-key-active={hasToken}
			onclick={handleImportKey}
			title={hasToken ? "已导入密钥，点击重新导入" : "点击选择密钥文件"}
		>
			<iconify-icon
				icon={hasToken ? "material-symbols:check-circle-rounded" : "material-symbols:key-rounded"}
				class="text-sm"
			></iconify-icon>
			{hasToken ? "已导入" : "导入密钥"}
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
			disabled={saving}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-base animate-spin"></iconify-icon>
				保存中...
			{:else}
				<iconify-icon icon="material-symbols:save-rounded" class="text-base"></iconify-icon>
				保存
			{/if}
		</button>

		<input
			bind:this={keyFileInput}
			type="file"
			accept=".txt,.pem,.key,text/plain"
			style="display:none"
			onchange={handleFileSelect}
		/>
	{/if}
</div>

<!-- Token手动输入弹窗 -->
{#if showTokenModal}
	<div class="token-modal-overlay" onclick={closeTokenModal}>
		<div class="token-modal" onclick={(e) => e.stopPropagation()}>
			<div class="token-modal-header">
				<h3>
					<iconify-icon icon="material-symbols:key-rounded" class="text-lg mr-2"></iconify-icon>
					输入 GitHub Token
				</h3>
				<button class="token-modal-close" onclick={closeTokenModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="token-modal-body">
				<p class="token-modal-desc">
					请输入您的 GitHub Personal Access Token。Token 需要有 <strong>gist</strong> 权限。
				</p>
				<input
					type="password"
					bind:value={tokenInput}
					placeholder="ghp_xxxxxxxxxxxxxxxxxxxx 或 github_pat_xxxxxxxx"
					class="token-input"
					onkeydown={(e) => e.key === "Enter" && handleSaveToken()}
				/>
				<div class="token-help">
					<a
						href="https://github.com/settings/tokens/new?scopes=gist&description=Blog%20Edit%20Token"
						target="_blank"
						rel="noopener noreferrer"
						class="token-help-link"
					>
						<iconify-icon icon="material-symbols:open-in-new-rounded" class="text-sm"></iconify-icon>
						点击生成Token（需勾选 gist 权限）
					</a>
				</div>
			</div>
			<div class="token-modal-footer">
				<button class="token-btn token-btn-cancel" onclick={closeTokenModal}>取消</button>
				<button class="token-btn token-btn-confirm" onclick={handleSaveToken} disabled={validatingToken}>
					{#if validatingToken}
						<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-sm animate-spin mr-1"></iconify-icon>
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
		color: rgba(0, 0, 0, 0.9);
		background: rgba(0, 0, 0, 0.9);
		color: white;
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
	.edit-btn-key-active {
		border-color: #22c55e !important;
		color: #16a34a !important;
		background: rgba(34, 197, 94, 0.08) !important;
	}
	:global(.dark) .edit-btn-key {
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.6);
	}
	:global(.dark) .edit-btn-key:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 55%);
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	:global(.dark) .edit-btn-key-active {
		border-color: #4ade80 !important;
		color: #4ade80 !important;
		background: rgba(74, 222, 128, 0.12) !important;
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
		opacity: 0.6;
		cursor: not-allowed;
	}

	/* Token 手动输入弹窗 */
	.token-modal-overlay {
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

	.token-modal {
		background: var(--card-bg, white);
		border-radius: 16px;
		width: 100%;
		max-width: 420px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.25s ease;
		overflow: hidden;
		border: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .token-modal {
		background: #1a1a2e;
		border-color: rgba(255, 255, 255, 0.1);
	}

	.token-modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 16px 20px 12px;
		border-bottom: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	:global(.dark) .token-modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.1);
	}
	.token-modal-header h3 {
		margin: 0;
		font-size: 16px;
		font-weight: 700;
		display: flex;
		align-items: center;
		color: var(--text-color, #1a1a2e);
	}
	:global(.dark) .token-modal-header h3 {
		color: #f0f0f0;
	}
	.token-modal-close {
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
	.token-modal-close:hover {
		background: rgba(0, 0, 0, 0.06);
		color: #333;
	}
	:global(.dark) .token-modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.token-modal-body {
		padding: 16px 20px;
	}
	.token-modal-desc {
		margin: 0 0 12px;
		font-size: 13px;
		color: var(--text-secondary, #666);
		line-height: 1.6;
	}
	:global(.dark) .token-modal-desc {
		color: #aaa;
	}
	.token-modal-desc strong {
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.token-input {
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
	.token-input:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	:global(.dark) .token-input {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.token-help {
		margin-top: 10px;
	}
	.token-help-link {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 12px;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		text-decoration: none;
	}
	.token-help-link:hover {
		text-decoration: underline;
	}

	.token-modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 20px;
		border-top: 1px solid var(--border, rgba(0,0,0,0.08));
	}
	:global(.dark) .token-modal-footer {
		border-top-color: rgba(255, 255, 255, 0.1);
	}
	.token-btn {
		padding: 8px 18px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		display: inline-flex;
		align-items: center;
	}
	.token-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.token-btn-cancel:hover {
		background: var(--border, #e5e7eb);
	}
	:global(.dark) .token-btn-cancel {
		background: #2d2d44;
		color: #d1d5db;
	}
	:global(.dark) .token-btn-cancel:hover {
		background: #3d3d55;
	}
	.token-btn-confirm {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.token-btn-confirm:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.token-btn-confirm:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
</style>
