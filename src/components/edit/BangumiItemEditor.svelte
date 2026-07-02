<script lang="ts">
import { createEventDispatcher } from "svelte";
import { onMount, onDestroy } from "svelte";

const dispatch = createEventDispatcher();

export let item: {
	id: string;
	title: string;
	name_cn: string;
	category: string;
	status: number;
	score: number;
	image: string;
	tags: string[];
	comment: string;
	updated_at: string;
};
export let categories: { id: string; name: string }[] = [];

const statusOptions = [
	{ value: 1, name: "想看" },
	{ value: 2, name: "看过" },
	{ value: 3, name: "在看" },
	{ value: 4, name: "搁置" },
	{ value: 5, name: "抛弃" },
];

let form = {
	title: item.title || "",
	name_cn: item.name_cn || "",
	category: item.category || "anime",
	status: item.status || 1,
	score: item.score || 0,
	image: item.image || "",
	tags: (item.tags || []).join(", "),
	comment: item.comment || "",
};

function handleSave() {
	if (!form.title.trim()) {
		alert("请输入标题");
		return;
	}
	dispatch("save", {
		id: item.id,
		title: form.title.trim(),
		name_cn: form.name_cn.trim() || form.title.trim(),
		category: form.category,
		status: Number(form.status),
		score: Number(form.score) || 0,
		image: form.image.trim(),
		tags: form.tags
			.split(",")
			.map((s) => s.trim())
			.filter(Boolean),
		comment: form.comment.trim(),
		updated_at: new Date().toISOString(),
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
	<div class="modal-content card-base" onclick={(e) => e.stopPropagation()}>
		<div class="modal-header">
			<h3 class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
				<iconify-icon icon="material-symbols:add-circle-outline-rounded" class="text-xl mr-2"></iconify-icon>
				{item.id ? "编辑条目" : "添加条目"}
			</h3>
			<button class="modal-close" onclick={handleCancel} aria-label="关闭">
				<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
			</button>
		</div>

		<div class="modal-body">
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label">标题（原名）*</label>
					<input type="text" bind:value={form.title} class="form-input" placeholder="Title" />
				</div>
				<div class="form-group">
					<label class="form-label">中文名</label>
					<input type="text" bind:value={form.name_cn} class="form-input" placeholder="中文名" />
				</div>
			</div>
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label">分类</label>
					<select bind:value={form.category} class="form-input form-select">
						{#each categories as cat}
							<option value={cat.id}>{cat.name}</option>
						{/each}
					</select>
				</div>
				<div class="form-group">
					<label class="form-label">状态</label>
					<select bind:value={form.status} class="form-input form-select">
						{#each statusOptions as opt}
							<option value={opt.value}>{opt.name}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label">评分（0-10）</label>
					<input type="number" bind:value={form.score} class="form-input" min="0" max="10" step="0.5" />
				</div>
				<div class="form-group">
					<label class="form-label">封面图片 URL</label>
					<input type="url" bind:value={form.image} class="form-input" placeholder="https://..." />
				</div>
			</div>
			<div class="form-group">
				<label class="form-label">标签（逗号分隔）</label>
				<input type="text" bind:value={form.tags} class="form-input" placeholder="标签1, 标签2" />
			</div>
			<div class="form-group">
				<label class="form-label">短评</label>
				<textarea bind:value={form.comment} class="form-input form-textarea" rows={2} placeholder="简短评价..."></textarea>
			</div>
			{#if form.image}
				<div class="cover-preview">
					<span class="text-xs text-neutral-500 dark:text-neutral-400">封面预览：</span>
					<img src={form.image} alt="预览" class="w-16 h-20 object-cover rounded" onerror={(e) => ((e.target as HTMLImageElement).style.display = 'none')} />
				</div>
			{/if}
		</div>

		<div class="modal-footer">
			<button class="btn btn-ghost" onclick={handleCancel}>取消</button>
			<button class="btn btn-primary" onclick={handleSave}>
				<iconify-icon icon="material-symbols:check-rounded" class="mr-1"></iconify-icon>
				{item.id ? "更新" : "添加"}
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
	.modal-close:hover { background: rgba(0, 0, 0, 0.05); }
	:global(.dark) .modal-close:hover { background: rgba(255, 255, 255, 0.1); }
	.modal-body { padding: 20px 24px; }
	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding: 16px 24px 20px;
		border-top: 1px solid rgba(0, 0, 0, 0.06);
	}
	:global(.dark) .modal-footer { border-top-color: rgba(255, 255, 255, 0.1); }
	.form-grid-2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 14px;
	}
	.form-group { display: flex; flex-direction: column; margin-bottom: 14px; }
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
	.form-select { cursor: pointer; }
	.form-textarea { resize: vertical; min-height: 50px; }
	:global(.dark) .form-input {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
		color: #fafafa;
	}
	:global(.dark) .form-input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
	}
	.cover-preview {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 4px;
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
	.btn-primary { background: #2563eb; color: white; }
	.btn-primary:hover { background: #1d4ed8; }
	.btn-ghost {
		background: transparent;
		color: var(--text-main, #171717);
	}
	.btn-ghost:hover { background: rgba(0, 0, 0, 0.05); }
	:global(.dark) .btn-ghost { color: #fafafa; }
	:global(.dark) .btn-ghost:hover { background: rgba(255, 255, 255, 0.1); }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
