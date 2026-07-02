<script lang="ts">
import { onMount, createEventDispatcher, tick } from "svelte";
const dispatch = createEventDispatcher();
import {
	setStoredAppId,
	setStoredPrivateKey,
	clearStoredCredentials,
	hasValidCredentials,
	validateCredentials,
	readFileAsText,
	showToast,
	ensureIconify,
	invalidateToken,
	getDraftCount,
	getDraftsByPage,
	removeDraft,
	clearAllDrafts,
	submitAllDrafts,
	onDraftsChanged,
	checkProxyConfigured,
} from "@/utils/editMode";
import { repoConfig } from "@/config/editConfig";

let {
	pageName,
	pageKey = "",
	saving,
	hasChanges,
	showAddButton = true,
	startInEditMode = false,
	persistentEdit = false,
	mountTo,
}: {
	pageName: string;
	pageKey?: string;
	saving: boolean;
	hasChanges: boolean;
	showAddButton?: boolean;
	startInEditMode?: boolean;
	persistentEdit?: boolean;
	mountTo?: string;
} = $props();

let editMode = $state(false);
let authed = $state(false);
let validating = $state(false);
let showHelpModal = $state(false);
let showDraftModal = $state(false);
let showBatchSubmitModal = $state(false);
let showClearConfirmModal = $state(false);
let toolbarRootEl = $state<HTMLDivElement>();
let mountedExternally = false;
let hiddenWrapper: HTMLElement | null = null;
let mountTarget: Element | null = null;
let submittingBatch = $state(false);
let batchResult = $state<{
	success: number;
	failed: number;
	errors: string[];
} | null>(null);

// 密钥导入相关（参考 WriteEditor 方式）
let selectedFileName = $state("");
let keyFileInputEl = $state<HTMLInputElement>();
let pageDraftCount = $state(0);
let totalDraftCount = $state(0);
let unsubscribeDrafts: (() => void) | null = null;

onMount(async () => {
	ensureIconify();
	// 检查服务端代理认证
	const proxyOk = await checkProxyConfigured();
	authed = proxyOk || hasValidCredentials();
	pageDraftCount = getDraftsByPage(pageKey).length;
	totalDraftCount = getDraftCount();
	unsubscribeDrafts = onDraftsChanged(() => {
		pageDraftCount = getDraftsByPage(pageKey).length;
		totalDraftCount = getDraftCount();
	});
	if (startInEditMode) {
		editMode = true;
	}
	if (mountTo) {
		mountTarget = document.querySelector(mountTo);
		await tick();
		moveToolbar();
	}
	return () => {
		if (hiddenWrapper) {
			hiddenWrapper.style.display = "";
		}
		if (unsubscribeDrafts) unsubscribeDrafts();
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
		tick().then(moveToolbar);
	}
});

function enterEdit() {
	editMode = true;
	dispatch("modeChange", { editing: true });
	// 发送全局事件供其他组件监听
	window.dispatchEvent(new CustomEvent("edit:modeChange", { detail: { editing: true } }));
}

function cancelEdit() {
	if (
		hasChanges &&
		!confirm("你有未保存的更改，确定要取消吗？所有修改将丢失。")
	) {
		return;
	}
	if (!persistentEdit) {
		editMode = false;
		dispatch("modeChange", { editing: false });
		// 发送全局事件供其他组件监听
		window.dispatchEvent(new CustomEvent("edit:modeChange", { detail: { editing: false } }));
	}
	dispatch("cancel");
}

function handleAdd() {
	dispatch("add");
}

// 密钥导入相关（参考 WriteEditor 方式）
function triggerKeyImport() {
	keyFileInputEl?.click();
}

async function handleKeyFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	const file = input.files?.[0];
	if (!file) {
		input.value = "";
		return;
	}
	try {
		const pem = await readFileAsText(file);
		const appId = repoConfig.appId;
		if (!appId) {
			showToast("请先在 Vercel 环境变量中配置 PUBLIC_GITHUB_APP_ID", "error");
			input.value = "";
			return;
		}
		validating = true;
		showToast("正在验证私钥...", "info");
		const result = await validateCredentials(appId, pem);
		if (result.ok) {
			setStoredAppId(appId);
			setStoredPrivateKey(pem);
			authed = true;
			selectedFileName = file.name;
			showToast("私钥导入成功！", "success");
		} else {
			showToast(result.error || "私钥验证失败", "error");
		}
	} catch (err) {
		showToast("读取私钥文件失败", "error");
	} finally {
		validating = false;
		input.value = "";
	}
}

function handleLogout() {
	if (!confirm("确定要清除已保存的私钥吗？清除后需要重新导入才能提交。"))
		return;
	clearStoredCredentials();
	invalidateToken();
	authed = false;
	showToast("已清除私钥", "info");
	dispatch("authChange", { authed: false });
}

function handleSaveDraft() {
	dispatch("saveDraft");
}

function handleSubmitSingle() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		triggerKeyImport();
		return;
	}
	if (!hasChanges && pageDraftCount === 0) {
		showToast("没有需要提交的更改", "info");
		return;
	}
	dispatch("submit");
}

async function handleBatchSubmit() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		triggerKeyImport();
		return;
	}
	if (totalDraftCount === 0) {
		showToast("暂存区是空的，先保存一些草稿吧", "info");
		return;
	}
	showBatchSubmitModal = true;
	batchResult = null;
	// 禁用 body 滚动
	document.body.style.overflow = "hidden";
}

function handleClearDrafts() {
	if (totalDraftCount === 0) {
		showToast(`没有草稿可清除`, "info");
		return;
	}
	showClearConfirmModal = true;
	document.body.style.overflow = "hidden";
}

function confirmClearDrafts() {
	clearAllDrafts();
	showClearConfirmModal = false;
	document.body.style.overflow = "";
	showToast(`已清除所有草稿`, "success");
}

function closeClearModal() {
	showClearConfirmModal = false;
	document.body.style.overflow = "";
}

async function confirmBatchSubmit() {
	submittingBatch = true;
	batchResult = null;
	try {
		const result = await submitAllDrafts();
		batchResult = result;
		if (result.failed === 0) {
			showToast(`批量提交成功！共 ${result.success} 项`, "success");
		} else {
			showToast(
				`提交完成：成功 ${result.success}，失败 ${result.failed}`,
				"warning",
			);
		}
		// 如果当前页面被提交了，刷新页面
		if (pageKey && result.submittedPageKeys.has(pageKey)) {
			setTimeout(() => window.location.reload(), 1200);
		}
	} catch (e: any) {
		batchResult = {
			success: 0,
			failed: 1,
			errors: [e?.message || "未知错误"],
			submittedPageKeys: new Set(),
		};
	} finally {
		submittingBatch = false;
	}
}

function closeBatchModal() {
	showBatchSubmitModal = false;
	batchResult = null;
	// 恢复 body 滚动
	document.body.style.overflow = "";
}

function openHelpModal() {
	showHelpModal = true;
	// 禁用 body 滚动
	document.body.style.overflow = "hidden";
}

function closeHelpModal() {
	showHelpModal = false;
	// 恢复 body 滚动
	document.body.style.overflow = "";
}
</script>

<div class="edit-toolbar" bind:this={toolbarRootEl} class:edit-toolbar--mounted={mountedExternally} class:edit-mode-toolbar={editMode}>
	{#if !editMode}
		<button class="edit-main-btn" onclick={enterEdit} title={`编辑${pageName}`}>
			<iconify-icon icon="material-symbols:edit-rounded" class="text-base"></iconify-icon>
			<span class="btn-text">编辑{pageName}</span>
		</button>
	{:else}
		<button class="edit-btn edit-btn-cancel" onclick={cancelEdit} title={persistentEdit ? "重置更改" : "取消编辑"}>
			<iconify-icon icon={persistentEdit ? "material-symbols:undo-rounded" : "material-symbols:close-rounded"} class="text-sm"></iconify-icon>
			<span class="btn-text">{persistentEdit ? "重置" : "取消"}</span>
		</button>

		<button class="edit-btn edit-btn-draft" onclick={handleSaveDraft} disabled={!hasChanges}>
			<iconify-icon icon="material-symbols:save-outline-rounded" class="text-sm"></iconify-icon>
			<span class="btn-text">保存草稿</span>
			{#if pageDraftCount > 0}
				<span class="draft-badge">{pageDraftCount}</span>
			{/if}
		</button>

		{#if authed}
			<button class="edit-btn edit-btn-key edit-btn-key-ok" onclick={triggerKeyImport} title="已导入私钥，点击重新导入">
				<iconify-icon icon="material-symbols:vpn-key-rounded" class="text-sm"></iconify-icon>
				<span class="btn-text">已认证</span>
			</button>
		{:else}
			<button class="edit-btn edit-btn-key edit-btn-key-err" onclick={triggerKeyImport} title="点击导入 GitHub App 私钥">
				<iconify-icon icon="material-symbols:key-rounded" class="text-sm"></iconify-icon>
				<span class="btn-text">导入密钥</span>
			</button>
		{/if}

		<button
			class="edit-btn edit-btn-submit"
			onclick={handleSubmitSingle}
			disabled={saving || (!hasChanges && pageDraftCount === 0)}
		>
			{#if saving}
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-base animate-spin"></iconify-icon>
				<span class="btn-text">提交中...</span>
			{:else}
				<iconify-icon icon="material-symbols:send-rounded" class="text-base"></iconify-icon>
				<span class="btn-text">提交</span>
			{/if}
		</button>

		<button class="edit-btn edit-btn-batch" onclick={handleBatchSubmit} title="批量提交所有暂存的更改">
			<iconify-icon icon="material-symbols:cloud-upload-rounded" class="text-sm"></iconify-icon>
			<span class="btn-text">批量提交</span>
			{#if totalDraftCount > 0}
				<span class="batch-badge">{totalDraftCount}</span>
			{/if}
		</button>

		<button class="edit-btn edit-btn-clear" onclick={handleClearDrafts} disabled={totalDraftCount === 0} title="清除所有草稿">
			<iconify-icon icon="material-symbols:delete-outline-rounded" class="text-sm"></iconify-icon>
			<span class="btn-text">清除全部</span>
			{#if totalDraftCount > 0}
				<span class="clear-badge">{totalDraftCount}</span>
			{/if}
		</button>

		{#if showAddButton !== false}
			<button class="edit-btn edit-btn-add" onclick={handleAdd}>
				<iconify-icon icon="material-symbols:add-rounded" class="text-base"></iconify-icon>
				<span class="btn-text">添加</span>
			</button>
		{/if}

		<button class="edit-btn edit-btn-help" onclick={openHelpModal} title="使用帮助">
			<iconify-icon icon="material-symbols:help-outline-rounded" class="text-sm"></iconify-icon>
			<span class="btn-text">帮助</span>
		</button>
	{/if}

	<!-- 密钥文件选择器（隐藏） -->
	<input
		type="file"
		accept=".pem,application/x-pem-file,text/plain"
		bind:this={keyFileInputEl}
		onchange={handleKeyFileSelect}
		style="display:none"
	/>

<!-- 批量提交弹窗 -->
{#if showBatchSubmitModal}
	<div class="modal-overlay" onclick={closeBatchModal}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:cloud-upload-rounded" class="text-lg mr-2"></iconify-icon>
					批量提交到 GitHub
				</h3>
				<button class="modal-close" onclick={closeBatchModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body">
				{#if totalDraftCount === 0 && !batchResult}
					<p class="modal-desc" style="background: rgba(245,158,11,0.1); color: #d97706; border-left-color: #f59e0b;">
						暂存区是空的，先在各编辑页面点击「保存草稿」吧。
					</p>
				{:else}
					<p class="modal-desc">
						以下所有更改将一次性提交到 GitHub 仓库。提交成功后将自动从暂存区移除。
					</p>

					<div class="draft-list">
						{#each getDraftsByPage(pageKey) as draft (draft.id)}
							<div class="draft-item">
								<div class="draft-info">
									<span class="draft-page">{pageName}</span>
									<span class="draft-desc">{draft.description}</span>
								</div>
								<button class="draft-remove" onclick={() => removeDraft(draft.id)} title="移除">
									<iconify-icon icon="material-symbols:close-rounded" class="text-sm"></iconify-icon>
								</button>
							</div>
						{/each}
					</div>
				{/if}

				{#if batchResult}
					<div class="batch-result" class:batch-ok={batchResult.failed === 0} class:batch-err={batchResult.failed > 0}>
						<div class="batch-summary">
							<iconify-icon icon={batchResult.failed === 0 ? "material-symbols:check-circle-rounded" : "material-symbols:warning-rounded"} class="text-lg"></iconify-icon>
							<span>成功 {batchResult.success} 项，失败 {batchResult.failed} 项</span>
						</div>
						{#if batchResult.errors.length > 0}
							<ul class="batch-errors">
								{#each batchResult.errors as err, i (i)}
									<li>{err}</li>
								{/each}
							</ul>
						{/if}
					</div>
				{/if}
			</div>
			<div class="modal-footer">
				<button class="modal-btn modal-btn-cancel" onclick={closeBatchModal}>关闭</button>
				{#if totalDraftCount > 0 && !batchResult}
					<button class="modal-btn modal-btn-ok" onclick={confirmBatchSubmit} disabled={submittingBatch}>
						{#if submittingBatch}
							<iconify-icon icon="material-symbols:progress-activity-rounded" class="text-sm animate-spin mr-1"></iconify-icon>
							提交中...
						{:else}
							<iconify-icon icon="material-symbols:send-rounded" class="text-sm mr-1"></iconify-icon>
							确认提交（{totalDraftCount}项）
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- 清除草稿确认弹窗 -->
{#if showClearConfirmModal}
	<div class="clear-modal-overlay" onclick={closeClearModal}>
		<div class="clear-modal-panel" onclick={(e) => e.stopPropagation()}>
			<div class="clear-modal-header">
				<div class="clear-modal-icon">
					<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
				</div>
				<h2 class="clear-modal-title">清除所有草稿</h2>
				<button class="clear-modal-close" onclick={closeClearModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="clear-modal-body">
				<p class="clear-modal-desc">
					确定要清除所有草稿吗？此操作不可恢复。
				</p>
				<p class="clear-modal-hint">
					当前共有 <strong>{totalDraftCount}</strong> 条草稿将被删除。
				</p>
			</div>
			<div class="clear-modal-footer">
				<button class="clear-modal-btn clear-modal-btn-cancel" onclick={closeClearModal}>取消</button>
				<button class="clear-modal-btn clear-modal-btn-danger" onclick={confirmClearDrafts}>
					<iconify-icon icon="material-symbols:delete-rounded" class="text-sm"></iconify-icon>
					确认清除
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 使用帮助弹窗 -->
{#if showHelpModal}
	<div class="modal-overlay" onclick={closeHelpModal}>
		<div class="modal-card" onclick={(e) => e.stopPropagation()}>
			<div class="modal-header">
				<h3>
					<iconify-icon icon="material-symbols:help-outline-rounded" class="text-lg mr-2"></iconify-icon>
					在线编辑使用帮助
				</h3>
				<button class="modal-close" onclick={closeHelpModal}>
					<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
				</button>
			</div>
			<div class="modal-body help-body">
				<h4>📝 工作流程</h4>
				<ol>
					<li><strong>编辑内容</strong>：修改你想要的内容</li>
					<li><strong>保存草稿</strong>：点击「保存草稿」按钮，更改会暂存到浏览器本地</li>
					<li><strong>继续编辑其他页面</strong>：可以编辑多个页面，每个页面保存草稿</li>
					<li><strong>导入密钥</strong>：点击「导入密钥」选择 .pem 私钥文件</li>
					<li><strong>批量提交</strong>：点击「批量提交」一次性将所有更改推送到 GitHub</li>
				</ol>

				<h4>🔑 认证方式</h4>
				<p>本系统使用 <strong>GitHub App 私钥认证</strong>，在浏览器端完成签名，私钥仅保存在本地浏览器：</p>
				<ul>
					<li>在 GitHub 上创建一个 GitHub App，并安装到你的博客仓库</li>
					<li>为 App 授予仓库 Contents 读写权限</li>
					<li>在 App 设置页生成并下载私钥文件（.pem）</li>
					<li>在 Vercel/Cloudflare Pages 配置 <code>PUBLIC_GITHUB_APP_ID</code> 环境变量（可选，省去输入 App ID）</li>
				</ul>

				<h4>💾 草稿暂存</h4>
				<p>所有编辑内容先保存为草稿，存在浏览器的 localStorage 中。不会提交到 GitHub，直到你点击「提交」或「批量提交」。</p>
				<ul>
					<li>草稿仅保存在当前浏览器，换浏览器/设备需要重新编辑</li>
					<li>清除浏览器数据会丢失草稿，请及时提交</li>
					<li>可以随时从暂存区移除单个草稿</li>
				</ul>

				<h4>🔒 安全说明</h4>
				<p>私钥文件不会上传到博客服务器，仅存储在你当前浏览器的 localStorage 中。清除浏览器数据或点击"清除私钥"后需要重新导入。由于通过服务端 CORS 代理访问 GitHub API，代理服务器只做请求转发，无法读取或篡改你的认证凭据。</p>
			</div>
		</div>
	</div>
	{/if}
</div>

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
		gap: 6px;
		padding: 6px 12px;
		border-radius: 8px;
		border: 1px solid rgba(0, 0, 0, 0.9);
		background: transparent;
		color: rgba(0, 0, 0, 0.9);
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s, color 0.2s;
		white-space: nowrap;
		line-height: 1;
		height: 32px;
		box-sizing: border-box;
	}
	.edit-main-btn iconify-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		line-height: 0;
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
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		border: 1px solid transparent;
		background: transparent;
		white-space: nowrap;
		position: relative;
		height: 32px;
		box-sizing: border-box;
		line-height: 1;
	}
	.edit-btn iconify-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		vertical-align: middle;
		line-height: 0;
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

	.edit-btn-draft {
		border-color: rgba(59, 130, 246, 0.3);
		color: #2563eb;
		background: rgba(59, 130, 246, 0.08);
	}
	.edit-btn-draft:hover:not(:disabled) {
		border-color: #2563eb;
		background: rgba(59, 130, 246, 0.15);
	}
	.edit-btn-draft:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.dark) .edit-btn-draft {
		border-color: rgba(96, 165, 250, 0.3);
		color: #60a5fa;
		background: rgba(96, 165, 250, 0.1);
	}
	:global(.dark) .edit-btn-draft:hover:not(:disabled) {
		border-color: #60a5fa;
		background: rgba(96, 165, 250, 0.2);
	}

	.edit-btn-clear {
		border-color: rgba(239, 68, 68, 0.3);
		color: #dc2626;
		background: rgba(239, 68, 68, 0.08);
	}
	.edit-btn-clear:hover:not(:disabled) {
		border-color: #dc2626;
		background: rgba(239, 68, 68, 0.15);
	}
	.edit-btn-clear:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	:global(.dark) .edit-btn-clear {
		border-color: rgba(248, 113, 113, 0.3);
		color: #f87171;
		background: rgba(248, 113, 113, 0.1);
	}
	:global(.dark) .edit-btn-clear:hover:not(:disabled) {
		border-color: #f87171;
		background: rgba(248, 113, 113, 0.2);
	}

	.clear-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: #dc2626;
		color: white;
		font-size: 11px;
		font-weight: 700;
		margin-left: 2px;
	}
	:global(.dark) .clear-badge {
		background: #ef4444;
		color: #1e1e32;
	}
	.draft-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: #2563eb;
		color: white;
		font-size: 11px;
		font-weight: 700;
		margin-left: 2px;
	}
	:global(.dark) .draft-badge {
		background: #60a5fa;
		color: #0f172a;
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
		background: rgba(34, 197, 94, 0.1) !important;
	}
	.edit-btn-key-err {
		border-color: #f59e0b !important;
		color: #d97706 !important;
		background: rgba(245, 158, 11, 0.12) !important;
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
		background: rgba(74, 222, 128, 0.15) !important;
	}
	:global(.dark) .edit-btn-key-err {
		border-color: #fbbf24 !important;
		color: #fbbf24 !important;
		background: rgba(251, 191, 36, 0.15) !important;
	}

	.edit-btn-batch {
		border-color: rgba(139, 92, 246, 0.3);
		color: #7c3aed;
		background: rgba(139, 92, 246, 0.08);
	}
	.edit-btn-batch:hover {
		border-color: #7c3aed;
		background: rgba(139, 92, 246, 0.15);
	}
	:global(.dark) .edit-btn-batch {
		border-color: rgba(167, 139, 250, 0.3);
		color: #a78bfa;
		background: rgba(167, 139, 250, 0.1);
	}
	:global(.dark) .edit-btn-batch:hover {
		border-color: #a78bfa;
		background: rgba(167, 139, 250, 0.2);
	}
	.batch-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 9px;
		background: #7c3aed;
		color: white;
		font-size: 11px;
		font-weight: 700;
		margin-left: 2px;
	}
	:global(.dark) .batch-badge {
		background: #a78bfa;
		color: #1e1b4b;
	}

	.edit-btn-help {
		border-color: rgba(0, 0, 0, 0.1);
		color: rgba(0, 0, 0, 0.5);
		padding: 7px 10px;
	}
	.edit-btn-help:hover {
		border-color: rgba(0, 0, 0, 0.3);
		color: rgba(0, 0, 0, 0.8);
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .edit-btn-help {
		border-color: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.5);
	}
	:global(.dark) .edit-btn-help:hover {
		border-color: rgba(255, 255, 255, 0.3);
		color: rgba(255, 255, 255, 0.9);
		background: rgba(255, 255, 255, 0.08);
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

	.edit-btn-submit {
		border: 1px solid hsl(var(--theme-hue, 165), 70%, 50%);
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-weight: 600;
	}
	.edit-btn-submit:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.edit-btn-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@media (max-width: 768px) {
		.edit-toolbar {
			display: flex !important;
			width: 100% !important;
			gap: 6px;
		}
		.edit-main-btn {
			width: 100%;
			justify-content: center;
			padding: 6px 10px;
			font-size: 12px;
		}
		.edit-mode-toolbar {
			display: flex;
			flex-wrap: wrap;
			gap: 5px;
			width: 100%;
		}
		.edit-mode-toolbar > .edit-btn,
		.edit-mode-toolbar > .edit-btn-submit {
			flex: 0 0 calc(50% - 3px);
			justify-content: center;
			padding: 6px 4px;
			font-size: 12px;
		}
		.edit-mode-toolbar > .edit-btn .btn-text,
		.edit-mode-toolbar > .edit-btn-submit .btn-text {
			display: inline;
		}
		.edit-mode-toolbar > .edit-btn iconify-icon {
			font-size: 14px;
		}
		.draft-badge, .batch-badge, .clear-badge {
			min-width: 16px;
			height: 16px;
			font-size: 10px;
			padding: 0 4px;
		}
	}

	.draft-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 300px;
		overflow-y: auto;
		margin: 12px 0;
	}
	.draft-item {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.03);
		border: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .draft-item {
		background: rgba(255, 255, 255, 0.04);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.draft-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.draft-page {
		font-size: 12px;
		color: #888;
	}
	.draft-desc {
		font-size: 13px;
		font-weight: 500;
	}
	.draft-remove {
		background: none;
		border: none;
		color: #999;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}
	.draft-remove:hover {
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
	}

	.batch-result {
		margin-top: 12px;
		padding: 14px;
		border-radius: 10px;
	}
	.batch-ok {
		background: rgba(34, 197, 94, 0.1);
		border: 1px solid rgba(34, 197, 94, 0.25);
		color: #16a34a;
	}
	.batch-err {
		background: rgba(245, 158, 11, 0.1);
		border: 1px solid rgba(245, 158, 11, 0.25);
		color: #d97706;
	}
	.batch-summary {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 600;
		font-size: 14px;
	}
	.batch-errors {
		margin: 10px 0 0;
		padding-left: 20px;
		font-size: 12px;
		line-height: 1.6;
	}

	/* ====== 模态弹窗 ====== */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
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

	.modal-card {
		background: #ffffff;
		border-radius: 16px;
		width: 100%;
		max-width: 520px;
		max-height: calc(100vh - 40px);
		overflow-y: auto;
		box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.25s ease;
		border: 1px solid rgba(0, 0, 0, 0.08);
		color: #1a1a2e;
	}
	@keyframes slideUp {
		from { transform: translateY(20px); opacity: 0; }
		to { transform: translateY(0); opacity: 1; }
	}
	:global(.dark) .modal-card {
		background: #1e1e32;
		border-color: rgba(255, 255, 255, 0.1);
		color: #f0f0f0;
	}

	.modal-sm {
		max-width: 400px;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 18px 22px 14px;
		border-bottom: 1px solid rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .modal-header {
		border-bottom-color: rgba(255, 255, 255, 0.08);
	}
	.modal-header h3 {
		margin: 0;
		font-size: 17px;
		font-weight: 700;
		display: flex;
		align-items: center;
	}
	.modal-close {
		width: 34px;
		height: 34px;
		border-radius: 8px;
		border: none;
		background: transparent;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #888;
		transition: all 0.15s;
		font-size: 14px;
	}
	.modal-close:hover {
		background: rgba(0, 0, 0, 0.08);
		color: #333;
	}
	:global(.dark) .modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
		color: #fff;
	}

	.modal-body {
		padding: 18px 22px;
		font-size: 14px;
		line-height: 1.65;
		color: #444;
	}
	:global(.dark) .modal-body {
		color: #c0c0d0;
	}
	.modal-desc {
		margin: 0 0 18px;
		padding: 12px 14px;
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.08);
		border-radius: 10px;
		color: hsl(var(--theme-hue, 165), 70%, 35%);
		font-size: 13px;
		border-left: 3px solid hsl(var(--theme-hue, 165), 70%, 50%);
	}
	:global(.dark) .modal-desc {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
		background: hsl(var(--theme-hue, 165), 70%, 50%, 0.12);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		padding: 14px 22px 18px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.06);
	}
	.modal-btn {
		display: inline-flex;
		align-items: center;
		padding: 9px 18px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: 1px solid transparent;
	}
	.modal-btn-cancel {
		background: transparent;
		border-color: rgba(0, 0, 0, 0.15);
		color: #555;
	}
	.modal-btn-cancel:hover {
		background: rgba(0, 0, 0, 0.06);
		border-color: rgba(0, 0, 0, 0.3);
	}
	:global(.dark) .modal-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: #bbb;
	}
	:global(.dark) .modal-btn-cancel:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.3);
	}
	.modal-btn-ok {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.modal-btn-ok:hover:not(:disabled) {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
		border-color: hsl(var(--theme-hue, 165), 75%, 45%);
	}
	.modal-btn-ok:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal-btn-danger {
		background: #dc2626;
		color: white;
		border-color: #dc2626;
	}
	.modal-btn-danger:hover:not(:disabled) {
		background: #b91c1c;
		border-color: #b91c1c;
	}
	:global(.dark) .modal-btn-danger {
		background: #ef4444;
		border-color: #ef4444;
	}
	:global(.dark) .modal-btn-danger:hover:not(:disabled) {
		background: #dc2626;
		border-color: #dc2626;
	}

	.help-body h4 {
		margin: 16px 0 8px;
		font-size: 14px;
		font-weight: 700;
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	.help-body h4:first-child { margin-top: 0; }
	:global(.dark) .help-body h4 {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}
	.help-body p { margin: 0 0 8px; }
	.help-body ol, .help-body ul {
		margin: 0 0 12px;
		padding-left: 22px;
	}
	.help-body li { margin-bottom: 4px; font-size: 13px; }
	.help-body code {
		font-family: "SF Mono", "Fira Code", monospace;
		font-size: 12px;
		padding: 2px 6px;
		border-radius: 4px;
		background: rgba(0,0,0,0.06);
		color: #d63384;
	}
	:global(.dark) .help-body code {
		background: rgba(255,255,255,0.08);
		color: #f472b6;
	}
	.help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 40%);
	}
	:global(.dark) .help-body strong {
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}

	/* ====== 清除草稿弹窗（友链弹窗风格） ====== */
	.clear-modal-overlay {
		position: fixed;
		inset: 0;
		background: oklch(0 0 0 / 0.5);
		backdrop-filter: blur(4px);
		z-index: 9998;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: clearFadeIn 0.2s ease-out;
	}
	@keyframes clearFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.clear-modal-panel {
		background: oklch(1 0 0);
		border: 1px solid var(--line-divider, rgba(0, 0, 0, 0.08));
		border-radius: 1rem;
		box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.25);
		max-width: 28rem;
		width: 100%;
		animation: clearSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
	:global(.dark) .clear-modal-panel {
		background: oklch(0.15 0 0);
		border-color: var(--line-divider, rgba(255, 255, 255, 0.08));
		box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.6);
	}
	@keyframes clearSlideIn {
		from { opacity: 0; transform: translateY(-0.75rem) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	.clear-modal-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--line-divider, rgba(0, 0, 0, 0.08));
	}
	:global(.dark) .clear-modal-header {
		border-bottom-color: var(--line-divider, rgba(255, 255, 255, 0.08));
	}

	.clear-modal-icon {
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.625rem;
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		flex-shrink: 0;
	}
	:global(.dark) .clear-modal-icon {
		background: rgba(248, 113, 113, 0.15);
		color: #f87171;
	}

	.clear-modal-title {
		font-size: 1.125rem;
		font-weight: 700;
		color: oklch(0.2 0 0);
		margin: 0;
		flex: 1;
	}
	:global(.dark) .clear-modal-title { color: oklch(0.9 0 0); }

	.clear-modal-close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.25rem;
		height: 2.25rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		color: oklch(0.5 0 0);
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.clear-modal-close:hover {
		background: var(--btn-plain-bg-hover, rgba(0, 0, 0, 0.06));
		color: oklch(0.2 0 0);
	}
	:global(.dark) .clear-modal-close { color: oklch(0.6 0 0); }
	:global(.dark) .clear-modal-close:hover { color: oklch(0.9 0 0); }

	.clear-modal-body {
		padding: 1.5rem;
	}

	.clear-modal-desc {
		font-size: 0.9375rem;
		color: oklch(0.35 0 0);
		margin: 0 0 0.75rem 0;
		line-height: 1.6;
	}
	:global(.dark) .clear-modal-desc { color: oklch(0.7 0 0); }

	.clear-modal-hint {
		font-size: 0.8125rem;
		color: oklch(0.5 0 0);
		margin: 0;
		padding: 0.75rem 1rem;
		background: oklch(0.97 0 0);
		border-radius: 0.625rem;
		border: 1px solid oklch(0.92 0 0);
	}
	:global(.dark) .clear-modal-hint {
		color: oklch(0.6 0 0);
		background: oklch(0.2 0 0);
		border-color: oklch(0.28 0 0);
	}
	.clear-modal-hint strong {
		color: #dc2626;
		font-weight: 700;
	}
	:global(.dark) .clear-modal-hint strong {
		color: #f87171;
	}

	.clear-modal-footer {
		display: flex;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-top: 1px solid var(--line-divider, rgba(0, 0, 0, 0.08));
		justify-content: flex-end;
	}
	:global(.dark) .clear-modal-footer {
		border-top-color: var(--line-divider, rgba(255, 255, 255, 0.08));
	}

	.clear-modal-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		border-radius: 0.625rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		line-height: 1;
	}

	.clear-modal-btn-cancel {
		background: transparent;
		border: 1px solid var(--line-divider, rgba(0, 0, 0, 0.15));
		color: oklch(0.4 0 0);
	}
	.clear-modal-btn-cancel:hover {
		background: var(--btn-plain-bg-hover, rgba(0, 0, 0, 0.06));
		border-color: rgba(0, 0, 0, 0.3);
	}
	:global(.dark) .clear-modal-btn-cancel {
		border-color: rgba(255, 255, 255, 0.15);
		color: oklch(0.7 0 0);
	}
	:global(.dark) .clear-modal-btn-cancel:hover {
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.3);
	}

	.clear-modal-btn-danger {
		background: oklch(0.55 0.2 25);
		color: oklch(1 0 0);
	}
	.clear-modal-btn-danger:hover {
		background: oklch(0.5 0.2 25);
	}
	:global(.dark) .clear-modal-btn-danger {
		background: oklch(0.65 0.2 25);
		color: oklch(0.15 0 0);
	}
	:global(.dark) .clear-modal-btn-danger:hover {
		background: oklch(0.6 0.2 25);
	}

	@media (max-width: 640px) {
		.clear-modal-panel {
			max-width: calc(100% - 1.5rem);
		}
		.clear-modal-footer {
			flex-direction: column;
		}
		.clear-modal-btn {
			justify-content: center;
		}
	}
</style>
