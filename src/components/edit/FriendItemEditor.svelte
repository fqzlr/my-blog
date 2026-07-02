<script lang="ts">
import { createEventDispatcher } from "svelte";
import { onMount, onDestroy } from "svelte";

const dispatch = createEventDispatcher();

export let friend: {
	id?: string;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags?: string[];
	weight?: number;
	enabled?: boolean;
	_source?: string;
};

let form = {
	title: friend.title || "",
	imgurl: friend.imgurl || "",
	desc: friend.desc || "",
	siteurl: friend.siteurl || "",
	tags: (friend.tags || ["Blog"]).join(", "),
	weight: friend.weight ?? 10,
	enabled: friend.enabled !== false,
};

function handleSave() {
	if (!form.title.trim()) {
		alert("请输入站点名称");
		return;
	}
	if (!form.siteurl.trim()) {
		alert("请输入站点链接");
		return;
	}
	dispatch("save", {
		id: friend.id,
		title: form.title.trim(),
		imgurl: form.imgurl.trim(),
		desc: form.desc.trim(),
		siteurl: form.siteurl.trim(),
		tags: form.tags
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean),
		weight: Number(form.weight) || 0,
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
</script>

<div class="modal-overlay" onclick={handleCancel} role="dialog" aria-modal="true">
	<div class="modal-content card-base" onclick={(e) => { e.stopPropagation(); }}>
		<div class="modal-header">
			<h3 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
				<iconify-icon icon="material-symbols:person-add-rounded" class="text-xl mr-2"></iconify-icon>
				{friend.id ? "编辑友链" : "添加友链"}
			</h3>
			<button class="modal-close" onclick={handleCancel} aria-label="关闭">
				<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
			</button>
		</div>

		<div class="modal-body">
			<div class="form-grid">
				<div class="form-group">
					<label class="form-label">站点名称 *</label>
					<input type="text" bind:value={form.title} class="form-input" placeholder="我的博客" />
				</div>
				<div class="form-group">
					<label class="form-label">站点链接 *</label>
					<input type="url" bind:value={form.siteurl} class="form-input" placeholder="https://example.com" />
				</div>
				<div class="form-group form-group-full">
					<label class="form-label">头像 URL</label>
					<input type="url" bind:value={form.imgurl} class="form-input" placeholder="https://example.com/avatar.png" />
				</div>
				<div class="form-group form-group-full">
					<label class="form-label">站点描述</label>
					<textarea bind:value={form.desc} class="form-input form-textarea" rows={2} placeholder="一个简短的描述..."></textarea>
				</div>
				<div class="form-group">
					<label class="form-label">标签（逗号分隔）</label>
					<input type="text" bind:value={form.tags} class="form-input" placeholder="Blog, Docs" />
				</div>
				<div class="form-group">
					<label class="form-label">权重（数字越大越靠前）</label>
					<input type="number" bind:value={form.weight} class="form-input" min={0} />
				</div>
			</div>

			{#if form.imgurl}
				<div class="avatar-preview">
					<span class="text-xs text-neutral-500 dark:text-neutral-400">头像预览：</span>
					<img src={form.imgurl} alt="预览" class="w-10 h-10 rounded-full object-cover" onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
				</div>
			{/if}
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
	:global(.dark) .form-input {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
		color: #fafafa;
	}
	:global(.dark) .form-input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
	}
	.avatar-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 12px;
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 18px;
		border-radius: 10px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		border: none;
		transition: all 0.2s;
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
	}
	.btn-ghost:hover {
		background: rgba(0, 0, 0, 0.05);
	}
	:global(.dark) .btn-ghost {
		color: #fafafa;
	}
	:global(.dark) .btn-ghost:hover {
		background: rgba(255, 255, 255, 0.1);
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
