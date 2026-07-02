<script lang="ts">
import { createEventDispatcher } from "svelte";
import { onMount, onDestroy } from "svelte";

const dispatch = createEventDispatcher();

export let item: {
	id?: string;
	name: string;
	url: string;
	description: string;
	category: string;
	icon?: string;
	enabled: boolean;
};
export let categories: string[] = [];

let form = {
	name: item.name || "",
	url: item.url || "",
	description: item.description || "",
	category: item.category || categories[0] || "",
	icon: item.icon || "",
	enabled: item.enabled !== false,
};
let newCategory = "";
let showCustomCat = false;

function handleSave() {
	if (!form.name.trim()) {
		alert("请输入名称");
		return;
	}
	if (!form.url.trim()) {
		alert("请输入链接");
		return;
	}
	let cat = form.category;
	if (showCustomCat && newCategory.trim()) {
		cat = newCategory.trim();
	}
	if (!cat) {
		alert("请选择或输入分类");
		return;
	}
	dispatch("save", {
		id: item.id,
		name: form.name.trim(),
		url: form.url.trim(),
		description: form.description.trim(),
		category: cat,
		icon:
			form.icon.trim() || `https://favicon.im/${new URL(form.url).hostname}`,
		enabled: form.enabled,
	});
}

function handleCancel() {
	dispatch("cancel");
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") handleCancel();
}

onMount(() => {
	window.addEventListener("keydown", handleKeydown);
});
onDestroy(() => {
	window.removeEventListener("keydown", handleKeydown);
});

function getFavicon() {
	try {
		return `https://favicon.im/${new URL(form.url).hostname}`;
	} catch {
		return "";
	}
}
</script>

<div class="modal-overlay" onclick={handleCancel} role="dialog" aria-modal="true">
	<div class="modal-content card-base" onclick={(e) => { e.stopPropagation(); }}>
		<div class="modal-header">
			<h3 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
				<iconify-icon icon="material-symbols:bookmark-add-rounded" class="text-xl mr-2"></iconify-icon>
				{item.id ? "编辑收藏" : "添加收藏"}
			</h3>
			<button class="modal-close" onclick={handleCancel} aria-label="关闭">
				<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
			</button>
		</div>

		<div class="modal-body">
			<div class="form-grid">
				<div class="form-group">
					<label class="form-label">名称 *</label>
					<input type="text" bind:value={form.name} class="form-input" placeholder="ChatGPT" />
				</div>
				<div class="form-group">
					<label class="form-label">链接 *</label>
					<input type="url" bind:value={form.url} class="form-input" placeholder="https://chatgpt.com" />
				</div>
				<div class="form-group form-group-full">
					<label class="form-label">图标（Iconify 名称或图片 URL）</label>
					<div class="icon-input-row">
						<input type="text" bind:value={form.icon} class="form-input" placeholder="留空自动获取 favicon" />
						{#if form.url}
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => form.icon = getFavicon()}>
								<iconify-icon icon="material-symbols:auto-awesome-rounded"></iconify-icon>
								自动获取
							</button>
						{/if}
					</div>
				</div>
				<div class="form-group form-group-full">
					<label class="form-label">描述</label>
					<textarea bind:value={form.description} class="form-input form-textarea" rows={2} placeholder="简短描述..."></textarea>
				</div>
				<div class="form-group">
					<label class="form-label">分类</label>
					{#if !showCustomCat}
						<div class="select-row">
							<select bind:value={form.category} class="form-input form-select">
								{#each categories as cat}
									<option value={cat}>{cat}</option>
								{/each}
							</select>
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => { showCustomCat = true; newCategory = ""; }}>
								<iconify-icon icon="material-symbols:add-rounded"></iconify-icon>
							</button>
						</div>
					{:else}
						<div class="select-row">
							<input type="text" bind:value={newCategory} class="form-input" placeholder="新分类名称" />
							<button type="button" class="btn btn-ghost btn-sm" onclick={() => { showCustomCat = false; newCategory = ""; }}>
								<iconify-icon icon="material-symbols:arrow-back-rounded"></iconify-icon>
							</button>
						</div>
					{/if}
				</div>
				<div class="form-group">
					<label class="form-label">状态</label>
					<label class="toggle-label">
						<input type="checkbox" bind:checked={form.enabled} />
						<span class="toggle-switch"></span>
						<span>{form.enabled ? "启用" : "禁用"}</span>
					</label>
				</div>
			</div>
		</div>

		<div class="modal-footer">
			<button class="btn btn-ghost" onclick={handleCancel}>取消</button>
			<button class="btn btn-primary" onclick={handleSave}>
				<iconify-icon icon="material-symbols:check-rounded" class="mr-1"></iconify-icon>
				确认
			</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 99997;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		padding: 20px;
		animation: fadeIn 0.2s ease;
	}
	.modal-content {
		width: 100%;
		max-width: 520px;
		border-radius: 16px;
		padding: 0;
		overflow: hidden;
		animation: slideUp 0.3s ease;
		max-height: 90vh;
		overflow-y: auto;
	}
	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 20px 24px 0;
	}
	.modal-close {
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		transition: background 0.2s;
	}
	.modal-close:hover {
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .modal-close:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.modal-body {
		padding: 20px 24px;
	}
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 16px 24px 20px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .modal-footer {
		border-top-color: rgba(255, 255, 255, 0.1);
	}
	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.form-group {
		display: flex;
		flex-direction: column;
	}
	.form-group-full {
		grid-column: 1 / -1;
	}
	.form-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
		color: var(--text-main, #171717);
	}
	.form-input {
		width: 100%;
		padding: 9px 12px;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: rgba(255, 255, 255, 0.8);
		font-size: 14px;
		outline: none;
		transition: border-color 0.2s, box-shadow 0.2s;
		color: #171717;
		font-family: inherit;
	}
	.form-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
	}
	.form-textarea {
		resize: vertical;
		min-height: 60px;
	}
	.form-select {
		cursor: pointer;
	}
	:global(.dark) .form-input {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
		color: #fafafa;
	}
	:global(.dark) .form-input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
	}
	.icon-input-row,
	.select-row {
		display: flex;
		gap: 6px;
	}
	.icon-input-row .form-input,
	.select-row .form-input {
		flex: 1;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px 14px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		white-space: nowrap;
	}
	.btn-sm {
		padding: 8px 10px;
	}
	.btn-primary {
		background: #2563eb;
		color: white;
	}
	.btn-primary:hover {
		background: #1d4ed8;
	}
	.btn-ghost {
		background: transparent;
		color: var(--text-main, #171717);
		border: 1px solid rgba(0, 0, 0, 0.15);
	}
	.btn-ghost:hover {
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .btn-ghost {
		color: #fafafa;
		border-color: rgba(255, 255, 255, 0.15);
	}
	:global(.dark) .btn-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
	}
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
	}
	.toggle-label input {
		display: none;
	}
	.toggle-switch {
		width: 40px;
		height: 22px;
		background: #d1d5db;
		border-radius: 11px;
		position: relative;
		transition: background 0.2s;
	}
	.toggle-switch::after {
		content: "";
		position: absolute;
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		top: 2px;
		left: 2px;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	.toggle-label input:checked + .toggle-switch {
		background: #10b981;
	}
	.toggle-label input:checked + .toggle-switch::after {
		transform: translateX(18px);
	}
	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes slideUp {
		from { opacity: 0; transform: translateY(20px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
