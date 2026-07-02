<script lang="ts">
import { onMount } from "svelte";
import { createEventDispatcher } from "svelte";

const dispatch = createEventDispatcher();

interface FormData {
	title: string;
	siteurl: string;
	imgurl: string;
	desc: string;
	tags: string;
}

let form: FormData = $state({
	title: "",
	siteurl: "",
	imgurl: "",
	desc: "",
	tags: "Blog",
});
let submitting = $state(false);
let resultMsg = $state("");
let resultType = $state<"success" | "error" | "">("");

function isValidUrl(s: string): boolean {
	try {
		const u = new URL(s);
		return u.protocol === "http:" || u.protocol === "https:";
	} catch {
		return false;
	}
}

let dialogEl: HTMLDialogElement | null = $state(null);

onMount(() => {
	const openBtns = document.querySelectorAll("[data-open-friend-apply]");
	openBtns.forEach((btn) => {
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			openModal();
		});
	});
});

function openModal() {
	if (dialogEl) {
		resultMsg = "";
		resultType = "";
		dialogEl.showModal();
		document.body.style.overflow = "hidden";
	}
}

function closeModal() {
	if (dialogEl) {
		dialogEl.close();
	}
	document.body.style.overflow = "";
	dispatch("close");
}

function handleDialogClick(e: MouseEvent) {
	if (e.target === dialogEl) {
		closeModal();
	}
}

function handleDialogClose() {
	document.body.style.overflow = "";
}

function validate(): string | null {
	if (!form.title.trim()) return "请填写站点名称";
	if (!form.siteurl.trim()) return "请填写站点链接";
	if (!isValidUrl(form.siteurl.trim())) return "站点链接格式不正确";
	if (!form.imgurl.trim()) return "请填写头像链接";
	if (!form.desc.trim()) return "请填写站点描述";
	if (form.title.length > 100) return "站点名称过长";
	if (form.desc.length > 500) return "站点描述过长";
	return null;
}

async function handleSubmit() {
	const err = validate();
	if (err) {
		resultMsg = err;
		resultType = "error";
		return;
	}

	submitting = true;
	resultMsg = "";
	resultType = "";

	try {
		const resp = await fetch("/api/friend-apply", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				title: form.title.trim(),
				siteurl: form.siteurl.trim(),
				imgurl: form.imgurl.trim(),
				desc: form.desc.trim(),
				tags: [form.tags],
			}),
		});

		const data = await resp.json();

		if (resp.ok) {
			resultMsg = "申请已提交，等待站长审核！";
			resultType = "success";
			form = { title: "", siteurl: "", imgurl: "", desc: "", tags: "Blog" };
			setTimeout(() => {
				dispatch("close");
			}, 2000);
		} else {
			resultMsg = data.error || "提交失败，请稍后重试";
			resultType = "error";
		}
	} catch (e) {
		resultMsg = "网络错误，请稍后重试";
		resultType = "error";
	} finally {
		submitting = false;
	}
}
</script>

<dialog bind:this={dialogEl} class="fa-modal">
	<div class="fa-overlay" data-close-modal></div>
	<div class="fa-panel">
		<!-- 头部 -->
		<div class="fa-header">
			<h2 class="fa-title">自助申请友链</h2>
			<button type="button" class="fa-close" onclick={closeModal} aria-label="关闭">
				<iconify-icon icon="material-symbols:close-rounded" class="text-xl"></iconify-icon>
			</button>
		</div>

		<!-- 提示信息 -->
		<div class="fa-body">
			<div class="fa-notice">
				<p>请填写您的站点信息，提交后等待站长审核通过即可显示在友链页面。</p>
				<p class="fa-notice-sub">请确保已将本站添加到您的友链页面。</p>
			</div>

			<!-- 表单 -->
			<form class="fa-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
				<div class="fa-field">
					<label for="fa-title-input">站点名称 <span class="fa-required">*</span></label>
					<input
						id="fa-title-input"
						type="text"
						bind:value={form.title}
						placeholder="我的博客"
						maxlength="100"
						disabled={submitting}
					/>
				</div>

				<div class="fa-field">
					<label for="fa-url-input">站点链接 <span class="fa-required">*</span></label>
					<input
						id="fa-url-input"
						type="url"
						bind:value={form.siteurl}
						placeholder="https://example.com"
						disabled={submitting}
					/>
				</div>

				<div class="fa-field">
					<label for="fa-avatar-input">头像链接 <span class="fa-required">*</span></label>
					<input
						id="fa-avatar-input"
						type="url"
						bind:value={form.imgurl}
						placeholder="https://example.com/avatar.png"
						disabled={submitting}
					/>
				</div>

				<div class="fa-field">
					<label for="fa-desc-input">站点描述 <span class="fa-required">*</span></label>
					<textarea
						id="fa-desc-input"
						bind:value={form.desc}
						placeholder="一句话介绍你的站点"
						maxlength="500"
						rows="2"
						disabled={submitting}
					></textarea>
				</div>

				<div class="fa-field">
					<label for="fa-tag-input">类型</label>
					<select id="fa-tag-input" bind:value={form.tags} disabled={submitting}>
						<option value="Blog">Blog</option>
						<option value="Docs">Docs</option>
					</select>
				</div>

				<!-- 结果提示 -->
				{#if resultMsg}
					<div class="fa-result" class:fa-result-success={resultType === "success"} class:fa-result-error={resultType === "error"}>
						<iconify-icon
							icon={resultType === "success" ? "material-symbols:check-circle-outline-rounded" : "material-symbols:error-outline-rounded"}
							class="fa-result-icon"
						></iconify-icon>
						<span>{resultMsg}</span>
					</div>
				{/if}
			</form>
		</div>

		<!-- 底部按钮 -->
		<div class="fa-footer">
			<button type="button" class="fa-btn fa-btn-cancel" onclick={closeModal} disabled={submitting}>
				取消
			</button>
			<button type="submit" class="fa-btn fa-btn-submit" disabled={submitting} onclick={handleSubmit}>
				{#if submitting}
					<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin"></iconify-icon>
					提交中...
				{:else}
					<iconify-icon icon="material-symbols:send-rounded"></iconify-icon>
					提交申请
				{/if}
			</button>
		</div>
	</div>
</dialog>

<style>
	.fa-modal {
		position: fixed;
		inset: 0;
		z-index: 99999;
		display: none;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		border: none;
		background: transparent;
		width: 100%;
		height: 100%;
		max-width: 100%;
		max-height: 100%;
		overflow: visible;
	}
	.fa-modal[open] { display: flex; }
	.fa-modal::backdrop { background: transparent; }

	.fa-overlay {
		position: fixed;
		inset: 0;
		background: oklch(0 0 0 / 0.5);
		backdrop-filter: blur(4px);
		z-index: -1;
		animation: faFadeIn 0.2s ease-out;
	}

	.fa-panel {
		background: oklch(1 0 0);
		border: 1px solid var(--line-divider);
		border-radius: 1rem;
		box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.25);
		max-width: 40rem;
		width: 100%;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		animation: faSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
	}
	:root.dark .fa-panel {
		background: oklch(0.15 0 0);
		border-color: var(--line-divider);
		box-shadow: 0 25px 50px -12px oklch(0 0 0 / 0.6);
	}

	.fa-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid var(--line-divider);
		flex-shrink: 0;
	}
	.fa-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: oklch(0.2 0 0);
		margin: 0;
	}
	:root.dark .fa-title { color: oklch(0.9 0 0); }

	.fa-close {
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
	.fa-close:hover {
		background: var(--btn-plain-bg-hover);
		color: oklch(0.2 0 0);
	}
	:root.dark .fa-close { color: oklch(0.6 0 0); }
	:root.dark .fa-close:hover { color: oklch(0.9 0 0); }

	.fa-body {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.fa-notice p {
		margin: 0;
		font-size: 0.875rem;
		color: oklch(0.5 0 0);
		line-height: 1.6;
	}
	.fa-notice-sub {
		margin-top: 0.25rem !important;
		font-size: 0.75rem !important;
		opacity: 0.7;
	}
	:root.dark .fa-notice p { color: oklch(0.55 0 0); }

	.fa-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.fa-field label {
		display: block;
		font-size: 0.8125rem;
		font-weight: 600;
		color: oklch(0.2 0 0);
		margin-bottom: 0.375rem;
	}
	:root.dark .fa-field label { color: oklch(0.85 0 0); }
	.fa-required {
		color: #ef4444;
	}
	.fa-field input,
	.fa-field textarea,
	.fa-field select {
		width: 100%;
		padding: 0.625rem 0.875rem;
		border-radius: 0.625rem;
		border: 1px solid var(--line-divider);
		font-size: 0.875rem;
		background: oklch(0.97 0 0);
		color: oklch(0.2 0 0);
		outline: none;
		transition: border-color 0.15s;
		box-sizing: border-box;
		font-family: inherit;
	}
	:root.dark .fa-field input,
	:root.dark .fa-field textarea,
	:root.dark .fa-field select {
		background: oklch(0.2 0 0);
		border-color: oklch(0.28 0 0);
		color: oklch(0.85 0 0);
	}
	.fa-field input:focus,
	.fa-field textarea:focus,
	.fa-field select:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.fa-field input:disabled,
	.fa-field textarea:disabled,
	.fa-field select:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.fa-field textarea {
		resize: vertical;
		min-height: 3.5rem;
	}

	.fa-result {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 0.875rem;
		border-radius: 0.625rem;
		font-size: 0.8125rem;
	}
	.fa-result-success {
		background: rgba(34, 197, 94, 0.1);
		color: #16a34a;
		border: 1px solid rgba(34, 197, 94, 0.2);
	}
	.fa-result-error {
		background: rgba(239, 68, 68, 0.1);
		color: #dc2626;
		border: 1px solid rgba(239, 68, 68, 0.2);
	}
	:root.dark .fa-result-success {
		background: rgba(34, 197, 94, 0.15);
		color: #4ade80;
	}
	:root.dark .fa-result-error {
		background: rgba(239, 68, 68, 0.15);
		color: #f87171;
	}
	.fa-result-icon {
		flex-shrink: 0;
		font-size: 1.125rem;
		display: flex;
	}

	.fa-footer {
		display: flex;
		gap: 0.75rem;
		padding: 1.25rem 1.5rem;
		border-top: 1px solid var(--line-divider);
		justify-content: flex-end;
		flex-shrink: 0;
	}

	.fa-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		border-radius: 0.625rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: opacity 0.15s, background 0.15s, color 0.15s;
		text-decoration: none;
		border: none;
		line-height: 1;
	}
	.fa-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}
	.fa-btn-cancel {
		background: var(--btn-regular-bg, oklch(0.95 0 0));
		color: oklch(0.3 0 0);
	}
	.fa-btn-cancel:hover:not(:disabled) {
		background: oklch(0.9 0 0);
	}
	:root.dark .fa-btn-cancel {
		background: oklch(0.25 0 0);
		color: oklch(0.8 0 0);
	}
	:root.dark .fa-btn-cancel:hover:not(:disabled) {
		background: oklch(0.3 0 0);
	}
	.fa-btn-submit {
		background: oklch(0.3 0 0);
		color: oklch(1 0 0);
	}
	.fa-btn-submit:hover:not(:disabled) {
		opacity: 0.9;
	}
	:root.dark .fa-btn-submit {
		background: oklch(0.85 0 0);
		color: oklch(0.15 0 0);
	}

	@keyframes faFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}
	@keyframes faSlideIn {
		from { opacity: 0; transform: translateY(-0.75rem) scale(0.97); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}

	@media (max-width: 640px) {
		.fa-panel {
			max-width: calc(100% - 1.5rem);
			max-height: 90vh;
		}
		.fa-footer { flex-direction: column; }
		.fa-btn { justify-content: center; }
	}
</style>
