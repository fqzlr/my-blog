<script lang="ts">
import { createEventDispatcher } from "svelte";
import { onMount, onDestroy } from "svelte";

const dispatch = createEventDispatcher();

export let moment: {
	id: string;
	content: string;
	published: string;
	images: string[];
	tags: string[];
	location?: string;
	pinned?: boolean;
};

let form = {
	content: moment.content || "",
	published: moment.published
		? new Date(moment.published).toISOString().slice(0, 16)
		: new Date().toISOString().slice(0, 16),
	images: (moment.images || []).join("\n"),
	tags: (moment.tags || []).join(", "),
	location: moment.location || "",
	pinned: moment.pinned || false,
};

function handleSave() {
	if (!form.content.trim()) {
		alert("请输入说说内容");
		return;
	}
	const images = form.images
		.split("\n")
		.map((s) => s.trim())
		.filter(Boolean);
	const tags = form.tags
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	dispatch("save", {
		id: moment.id,
		content: form.content.trim(),
		published: new Date(form.published).toISOString(),
		images,
		tags,
		location: form.location.trim() || undefined,
		pinned: form.pinned,
	});
}

function handleCancel() {
	dispatch("cancel");
}

function handleKeydown(e: KeyboardEvent) {
	if (e.key === "Escape") handleCancel();
}

function addCurrentLocation() {
	if (!navigator.geolocation) {
		alert("浏览器不支持定位");
		return;
	}
	navigator.geolocation.getCurrentPosition(
		(pos) => {
			const { latitude, longitude } = pos.coords;
			form.location = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
		},
		() => {
			alert("定位失败，请手动输入");
		},
	);
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
				<iconify-icon icon="material-symbols:edit-note-rounded" class="text-xl mr-2"></iconify-icon>
				{moment.id ? "编辑说说" : "发布说说"}
			</h3>
			<button class="modal-close" onclick={handleCancel} aria-label="关闭">
				<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
			</button>
		</div>

		<div class="modal-body">
			<div class="form-group">
				<label class="form-label">内容 *</label>
				<textarea bind:value={form.content} class="form-input form-textarea form-textarea-lg" rows={5} placeholder="说点什么..."></textarea>
			</div>
			<div class="form-grid-2">
				<div class="form-group">
					<label class="form-label">发布时间</label>
					<input type="datetime-local" bind:value={form.published} class="form-input" />
				</div>
				<div class="form-group">
					<label class="form-label">位置</label>
					<div class="input-with-btn">
						<input type="text" bind:value={form.location} class="form-input" placeholder="可选" />
						<button type="button" class="btn-icon" onclick={addCurrentLocation} title="获取当前位置">
							<iconify-icon icon="material-symbols:my-location-rounded"></iconify-icon>
						</button>
					</div>
				</div>
			</div>
			<div class="form-group">
				<label class="form-label">图片链接（每行一个URL）</label>
				<textarea bind:value={form.images} class="form-input form-textarea" rows={3} placeholder="https://example.com/img1.jpg&#10;https://example.com/img2.jpg"></textarea>
			</div>
			<div class="form-group">
				<label class="form-label">标签（逗号分隔）</label>
				<input type="text" bind:value={form.tags} class="form-input" placeholder="生活, 日常" />
			</div>
			<div class="form-group">
				<label class="toggle-label">
					<input type="checkbox" bind:checked={form.pinned} />
					<span class="toggle-switch"></span>
					<span>置顶</span>
				</label>
			</div>
		</div>

		<div class="modal-footer">
			<button class="btn btn-ghost" onclick={handleCancel}>取消</button>
			<button class="btn btn-primary" onclick={handleSave}>
				<iconify-icon icon="material-symbols:check-rounded" class="mr-1"></iconify-icon>
				{moment.id ? "更新" : "发布"}
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
	.form-textarea { resize: vertical; min-height: 60px; }
	.form-textarea-lg { min-height: 100px; }
	:global(.dark) .form-input {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.15);
		color: #fafafa;
	}
	:global(.dark) .form-input:focus {
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.15);
	}
	.input-with-btn { display: flex; gap: 6px; }
	.input-with-btn .form-input { flex: 1; }
	.btn-icon {
		width: 40px;
		height: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 10px;
		border: 1px solid rgba(0, 0, 0, 0.15);
		background: transparent;
		cursor: pointer;
		font-size: 18px;
		color: var(--text-main, #171717);
		transition: all 0.2s;
	}
	.btn-icon:hover { background: rgba(0, 0, 0, 0.05); }
	:global(.dark) .btn-icon { border-color: rgba(255, 255, 255, 0.15); color: #fafafa; }
	:global(.dark) .btn-icon:hover { background: rgba(255, 255, 255, 0.1); }
	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 14px;
	}
	.toggle-label input { display: none; }
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
	.toggle-label input:checked + .toggle-switch { background: #10b981; }
	.toggle-label input:checked + .toggle-switch::after { transform: translateX(18px); }
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
