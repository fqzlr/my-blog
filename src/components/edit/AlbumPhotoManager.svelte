<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import {
	showToast,
	hasValidToken,
	ensureIconify,
	deleteRepoFile,
	listRepoFiles,
	getRepoFileBase64,
	createRepoFile,
	createRepoFileRawBase64,
	getRepoFile,
	updateRepoFile,
} from "@/utils/editMode";
import { repoConfig } from "@/config/editConfig";

interface PhotoItem {
	url: string;
	fileName: string;
	repoPath: string;
	sha: string;
	selected: boolean;
	isCover: boolean;
}

interface PendingUpload {
	file: File;
	previewUrl: string;
	fileName: string;
	base64: string;
}

let {
	photos = [],
	albumId,
	albumName = "相册",
}: {
	photos: string[];
	albumId: string;
	albumName?: string;
} = $props();

let editMode = $state(false);
let saving = $state(false);
let hasChanges = $state(false);
let photoItems = $state<PhotoItem[]>([]);
let originalOrder = $state<string[]>([]);
let draggingIndex = $state(-1);
let dragOverIndex = $state(-1);
let repoFilesLoaded = $state(false);
let progress = $state({ current: 0, total: 0, text: "" });
let pendingUploads = $state<PendingUpload[]>([]);
let fileInputEl: HTMLInputElement | undefined = $state();
let isDraggingOver = $state(false);

const repoDirPath = `public/gallery/${albumId}`;

onMount(() => {
	ensureIconify();
	photoItems = photos.map((url) => {
		const fileName = url.split("/").pop() || "";
		return {
			url,
			fileName,
			repoPath: `${repoDirPath}/${fileName}`,
			sha: "",
			selected: false,
			isCover: /^cover\./i.test(fileName),
		};
	});
	originalOrder = photoItems.map((p) => p.fileName);
});

// 进入/退出编辑模式
function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
		loadRepoFiles();
		hideSSRContent();
	} else {
		showSSRContent();
	}
}

function hideSSRContent() {
	document.querySelectorAll<HTMLElement>(".gallery-photo-ssr").forEach((s) => {
		s.style.display = "none";
	});
}

function showSSRContent() {
	document.querySelectorAll<HTMLElement>(".gallery-photo-ssr").forEach((s) => {
		s.style.display = "";
	});
}

async function loadRepoFiles() {
	if (repoFilesLoaded || !hasValidToken()) {
		repoFilesLoaded = true;
		return;
	}
	try {
		const files = await listRepoFiles(repoDirPath);
		for (const photo of photoItems) {
			const match = files.find((f) => f.name === photo.fileName);
			if (match) {
				photo.sha = match.sha;
			}
		}
		photoItems = [...photoItems];
	} catch (e) {
		console.warn("Failed to load repo files:", e);
	}
	repoFilesLoaded = true;
}

// ===== 拖拽排序 =====
function onDragStart(e: DragEvent, index: number) {
	if (!e.dataTransfer) return;
	draggingIndex = index;
	e.dataTransfer.effectAllowed = "move";
	e.dataTransfer.setData("text/plain", String(index));
}

function onDragOver(e: DragEvent, index: number) {
	e.preventDefault();
	if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
	if (dragOverIndex !== index) dragOverIndex = index;
}

function onDragLeave() {
	dragOverIndex = -1;
}

function onDrop(e: DragEvent, targetIndex: number) {
	e.preventDefault();
	const sourceIndex = draggingIndex;
	draggingIndex = -1;
	dragOverIndex = -1;
	if (sourceIndex < 0 || sourceIndex === targetIndex) return;
	const arr = [...photoItems];
	const [moved] = arr.splice(sourceIndex, 1);
	arr.splice(targetIndex, 0, moved);
	photoItems = arr;
	hasChanges = true;
}

function onDragEnd() {
	draggingIndex = -1;
	dragOverIndex = -1;
}

// ===== 选择 =====
function toggleSelect(index: number) {
	photoItems[index] = {
		...photoItems[index],
		selected: !photoItems[index].selected,
	};
	photoItems = [...photoItems];
}

function selectAll() {
	photoItems = photoItems.map((p) => ({ ...p, selected: true }));
}

function deselectAll() {
	photoItems = photoItems.map((p) => ({ ...p, selected: false }));
}

// ===== 上传图片 =====
function triggerFileInput() {
	fileInputEl?.click();
}

function handleFileSelect(e: Event) {
	const input = e.target as HTMLInputElement;
	if (!input.files?.length) return;
	addFiles(Array.from(input.files));
	input.value = "";
}

function addFiles(files: File[]) {
	const imageFiles = files.filter((f) => f.type.startsWith("image/"));
	if (imageFiles.length === 0) {
		showToast("请选择图片文件", "warning");
		return;
	}
	for (const file of imageFiles) {
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			// Extract pure base64 (remove data:image/xxx;base64, prefix)
			const base64 = dataUrl.split(",")[1] || "";
			// Generate unique filename with timestamp
			const ext = file.name.split(".").pop() || "jpg";
			const ts = Date.now();
			const idx = pendingUploads.length + photoItems.length + 1;
			const prefix = String(idx).padStart(3, "0");
			const fileName = `${prefix}_${ts}.${ext}`;
			pendingUploads = [
				...pendingUploads,
				{ file, previewUrl: dataUrl, fileName, base64 },
			];
			hasChanges = true;
		};
		reader.readAsDataURL(file);
	}
}

function removePendingUpload(index: number) {
	pendingUploads = pendingUploads.filter((_, i) => i !== index);
	if (pendingUploads.length === 0) hasChanges = false;
}

// Drag & drop on the grid area
function onGridDragOver(e: DragEvent) {
	e.preventDefault();
	if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
	isDraggingOver = true;
}
function onGridDragLeave() {
	isDraggingOver = false;
}
function onGridDrop(e: DragEvent) {
	e.preventDefault();
	isDraggingOver = false;
	const files = e.dataTransfer?.files;
	if (files?.length) addFiles(Array.from(files));
}

// ===== 设置封面 =====
function setCover(index: number) {
	photoItems = photoItems.map((p, i) => ({ ...p, isCover: i === index }));
	hasChanges = true;
	showToast(`已将「${photoItems[index].fileName}」设为封面`, "info");
}

// ===== 移动 =====
function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...photoItems];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	photoItems = arr;
	hasChanges = true;
}

function moveDown(index: number) {
	if (index >= photoItems.length - 1) return;
	const arr = [...photoItems];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	photoItems = arr;
	hasChanges = true;
}

// ===== 保存 =====
async function handleSave() {
	if (!hasValidToken()) {
		showToast("请先导入密钥再保存", "warning");
		return;
	}
	saving = true;

	try {
		// 0. 上传新增图片
		if (pendingUploads.length > 0) {
			progress = {
				current: 0,
				total: pendingUploads.length,
				text: "正在上传图片...",
			};
			let uploaded = 0;
			for (const up of pendingUploads) {
				progress.current++;
				progress = { ...progress };
				const repoPath = `${repoDirPath}/${up.fileName}`;
				const ok = await createRepoFileRawBase64(
					repoPath,
					up.base64,
					`feat: 新增相册 ${albumName} 图片 ${up.fileName}`,
				);
				if (ok) {
					// Add to photoItems
					const url = `/gallery/${albumId}/${up.fileName}`;
					photoItems = [
						...photoItems,
						{
							url,
							fileName: up.fileName,
							repoPath,
							sha: "",
							selected: false,
							isCover: false,
						},
					];
					uploaded++;
				}
			}
			pendingUploads = [];
			showToast(`已上传 ${uploaded} 张图片`, "success");
		}

		// 1. 删除选中的照片
		const selectedItems = photoItems.filter((p) => p.selected);
		if (selectedItems.length > 0) {
			if (
				!confirm(
					`确定要删除 ${selectedItems.length} 张照片吗？此操作不可撤销！`,
				)
			) {
				saving = false;
				return;
			}
			progress = {
				current: 0,
				total: selectedItems.length,
				text: "正在删除照片...",
			};
			for (const item of selectedItems) {
				progress.current++;
				progress = { ...progress };
				if (!item.sha) {
					const meta = await (await import("@/utils/editMode")).getRepoFileMeta(
						item.repoPath,
					);
					if (meta) item.sha = meta.sha;
				}
				if (item.sha) {
					await deleteRepoFile(
						item.repoPath,
						item.sha,
						`chore: 删除相册 ${albumName} 中的 ${item.fileName}`,
					);
				}
			}
			photoItems = photoItems.filter((p) => !p.selected);
			showToast(`已删除 ${selectedItems.length} 张照片`, "success");
		}

		// 2. 重排序（重命名文件添加序号前缀）
		const currentOrder = photoItems.map((p) => p.fileName);
		const orderChanged = currentOrder.some(
			(name, i) => name !== originalOrder[i],
		);
		if (orderChanged) {
			progress = {
				current: 0,
				total: photoItems.length * 2,
				text: "正在重排序...",
			};
			let successCount = 0;
			let failCount = 0;

			// Phase 1: 全部重命名为临时名
			const tempNames: string[] = [];
			for (let i = 0; i < photoItems.length; i++) {
				progress.current++;
				progress = { ...progress };
				const photo = photoItems[i];
				const ext = photo.fileName.split(".").pop() || "";
				const tempName = `__tmp_reorder_${Date.now()}_${i}.${ext}`;
				const tempPath = `${repoDirPath}/${tempName}`;

				const b64 = await getRepoFileBase64(photo.repoPath);
				if (b64) {
					const ok = await createRepoFile(
						tempPath,
						b64,
						`chore: 重排序 ${albumName} (${i + 1}/${photoItems.length})`,
					);
					if (ok) {
						// 删除旧文件
						if (photo.sha) {
							await deleteRepoFile(
								photo.repoPath,
								photo.sha,
								`chore: 重排序清理`,
							);
						}
						photo.repoPath = tempPath;
						photo.fileName = tempName;
						tempNames.push(tempName);
						successCount++;
					} else {
						failCount++;
					}
				} else {
					failCount++;
				}
			}

			// Phase 2: 从临时名改为最终名
			for (let i = 0; i < photoItems.length; i++) {
				progress.current++;
				progress = { ...progress };
				const photo = photoItems[i];
				const ext = photo.fileName.split(".").pop() || "";
				const prefix = String(i + 1).padStart(3, "0");
				const finalName = `${prefix}_${photoItems[i].url.split("/").pop()?.split("_").slice(1).join("_") || `photo_${i + 1}.${ext}`}`;
				// Use original filename pattern if possible
				const origName = photos[i]?.split("/").pop() || `photo_${i + 1}.${ext}`;
				const finalFileName = `${prefix}_${origName.replace(/^\d+_/, "")}`;
				const finalPath = `${repoDirPath}/${finalFileName}`;

				const b64 = await getRepoFileBase64(photo.repoPath);
				if (b64) {
					const ok = await createRepoFile(
						finalPath,
						b64,
						`chore: 重排序 ${albumName} 最终 (${i + 1}/${photoItems.length})`,
					);
					if (ok) {
						// 获取临时文件的 sha 并删除
						const meta = await (
							await import("@/utils/editMode")
						).getRepoFileMeta(photo.repoPath);
						if (meta) {
							await deleteRepoFile(
								photo.repoPath,
								meta.sha,
								`chore: 重排序清理`,
							);
						}
						photo.repoPath = finalPath;
						photo.fileName = finalFileName;
						photo.url = `/gallery/${albumId}/${finalFileName}`;
					}
				}
			}

			photoItems = [...photoItems];
			originalOrder = photoItems.map((p) => p.fileName);

			if (failCount > 0) {
				showToast(
					`重排序部分失败 (${failCount} 个)，请刷新页面检查`,
					"warning",
				);
			} else {
				showToast("重排序完成", "success");
			}
		}

		// 3. 更新封面配置
		const coverPhoto = photoItems.find((p) => p.isCover);
		if (coverPhoto) {
			progress = { current: 0, total: 1, text: "正在更新封面..." };
			await updateCoverInConfig(coverPhoto.url);
		}

		hasChanges = false;
		showToast("保存成功！页面将刷新以应用更改", "success");
		setTimeout(() => window.location.reload(), 1500);
	} catch (e) {
		showToast("保存失败：" + (e as Error).message, "error");
	}

	saving = false;
	progress = { current: 0, total: 0, text: "" };
}

async function updateCoverInConfig(coverUrl: string) {
	try {
		const file = await getRepoFile("src/config/galleryConfig.ts");
		if (!file) {
			showToast("无法读取配置文件，封面未更新", "warning");
			return;
		}
		// Find the album entry and update/add cover field
		const albumPattern = new RegExp(
			`(\\{[^}]*id:\\s*"${albumId}"[^}]*?)(\\})`,
			"s",
		);
		const match = file.content.match(albumPattern);
		if (!match) {
			showToast("未找到相册配置，封面未更新", "warning");
			return;
		}

		let albumBlock = match[0];
		// Remove existing cover field if present
		albumBlock = albumBlock.replace(/,\s*cover:\s*"[^"]*"/, "");
		// Add cover field before closing brace
		const lastBrace = albumBlock.lastIndexOf("}");
		const coverField = `,\n\t\t\tcover: "${coverUrl}"`;
		albumBlock =
			albumBlock.slice(0, lastBrace) +
			coverField +
			",\n\t\t" +
			albumBlock.slice(lastBrace);

		const newContent = file.content.replace(match[0], albumBlock);
		const ok = await updateRepoFile(
			"src/config/galleryConfig.ts",
			newContent,
			file.sha,
			`chore: 更新相册 ${albumName} 封面`,
		);
		if (ok) {
			showToast("封面配置已更新", "success");
		} else {
			showToast("封面配置更新失败", "error");
		}
	} catch (e) {
		showToast("封面更新失败：" + (e as Error).message, "error");
	}
}

function handleCancel() {
	pendingUploads = [];
	photoItems = photos.map((url) => {
		const fileName = url.split("/").pop() || "";
		return {
			url,
			fileName,
			repoPath: `${repoDirPath}/${fileName}`,
			sha: photoItems.find((p) => p.fileName === fileName)?.sha || "",
			selected: false,
			isCover: /^cover\./i.test(fileName),
		};
	});
	originalOrder = photoItems.map((p) => p.fileName);
	hasChanges = false;
	showSSRContent();
}

function handleSaveDraft() {
	showToast("照片管理无需草稿，请直接提交", "info");
}

const selectedCount = $derived(photoItems.filter((p) => p.selected).length);
const orderChanged = $derived(
	photoItems
		.map((p) => p.fileName)
		.some((name, i) => name !== originalOrder[i]),
);
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="photo-mgr-toolbar">
	<EditToolbar
		pageName="{albumName} 照片"
		mountTo=".page-header-toolbar-slot"
		{saving}
		{hasChanges}
		showAddButton={false}
		on:modeChange={(e) => handleModeChange(e)}
		on:submit={() => handleSave()}
		on:saveDraft={() => handleSaveDraft()}
		on:cancel={() => handleCancel()}
	/>
</div>

{#if editMode}
	<div class="photo-mgr-wrapper">
		<!-- 批量操作栏 -->
		<div class="photo-mgr-batch-bar">
			<div class="batch-info">
				<iconify-icon icon="material-symbols:photo-library-outline-rounded" class="text-base"></iconify-icon>
				<span>共 {photoItems.length} 张照片</span>
				{#if selectedCount > 0}
					<span class="batch-selected">已选 {selectedCount} 张</span>
				{/if}
				{#if orderChanged}
					<span class="batch-changed">顺序已更改</span>
				{/if}
			</div>
			<div class="batch-actions">
				<button class="batch-btn batch-btn-primary" onclick={triggerFileInput}>
					<iconify-icon icon="material-symbols:add-photo-outline-rounded" class="text-sm"></iconify-icon>
					上传图片
				</button>
				<button class="batch-btn" onclick={selectAll}>全选</button>
				<button class="batch-btn" onclick={deselectAll}>取消选择</button>
				{#if selectedCount > 0}
					<button class="batch-btn batch-btn-danger" onclick={() => {
						if (confirm(`确定要标记 ${selectedCount} 张照片为删除吗？点击提交后将永久删除。`)) {
							hasChanges = true;
						}
					}}>
						<iconify-icon icon="material-symbols:delete-outline-rounded" class="text-sm"></iconify-icon>
						删除选中 ({selectedCount})
					</button>
				{/if}
			</div>
		</div>

		<!-- 进度条 -->
		{#if progress.total > 0}
			<div class="photo-mgr-progress">
				<div class="progress-bar">
					<div class="progress-fill" style="width: {(progress.current / progress.total) * 100}%"></div>
				</div>
				<span class="progress-text">{progress.text} ({progress.current}/{progress.total})</span>
			</div>
		{/if}

		<!-- 隐藏的文件选择器 -->
		<input
			bind:this={fileInputEl}
			type="file"
			accept="image/*"
			multiple
			class="hidden-file-input"
			onchange={handleFileSelect}
		/>

		<!-- 照片网格 -->
		<div
			class="photo-mgr-grid"
			class:grid-drag-over={isDraggingOver}
			ondragover={onGridDragOver}
			ondragleave={onGridDragLeave}
			ondrop={onGridDrop}
		>
			{#each photoItems as photo, i (photo.fileName + i)}
				<div
					class="photo-mgr-item"
					class:photo-selected={photo.selected}
					class:photo-dragging={draggingIndex === i}
					class:photo-drag-over={dragOverIndex === i}
					class:photo-is-cover={photo.isCover}
					draggable="true"
					ondragstart={(e) => onDragStart(e, i)}
					ondragover={(e) => onDragOver(e, i)}
					ondragleave={onDragLeave}
					ondrop={(e) => onDrop(e, i)}
					ondragend={onDragEnd}
				>
					<!-- 序号 -->
					<span class="photo-index">{i + 1}</span>

					<!-- 封面标记 -->
					{#if photo.isCover}
						<span class="photo-cover-badge">封面</span>
					{/if}

					<!-- 选择框 -->
					<button class="photo-select-btn" onclick={(e) => { e.preventDefault(); toggleSelect(i); }} title="选择">
						{#if photo.selected}
							<iconify-icon icon="material-symbols:check-box-rounded"></iconify-icon>
						{:else}
							<iconify-icon icon="material-symbols:check-box-outline-blank-rounded"></iconify-icon>
						{/if}
					</button>

					<!-- 图片 -->
					<img src={photo.url} alt={photo.fileName} class="photo-img" loading="lazy" />

					<!-- 悬停操作 -->
					<div class="photo-actions">
						<button class="photo-action-btn" onclick={() => setCover(i)} title="设为封面">
							<iconify-icon icon="material-symbols:star-rounded"></iconify-icon>
						</button>
						<button class="photo-action-btn" onclick={() => moveUp(i)} title="上移" disabled={i === 0}>
							<iconify-icon icon="material-symbols:arrow-back-rounded"></iconify-icon>
						</button>
						<button class="photo-action-btn" onclick={() => moveDown(i)} title="下移" disabled={i === photoItems.length - 1}>
							<iconify-icon icon="material-symbols:arrow-forward-rounded"></iconify-icon>
						</button>
					</div>

					<!-- 拖拽手柄 -->
					<div class="photo-drag-handle" title="拖拽排序">
						<iconify-icon icon="material-symbols:drag-indicator-rounded"></iconify-icon>
					</div>
				</div>
			{/each}

			<!-- 待上传图片 -->
			{#each pendingUploads as up, i (`pending-${i}`)}
				<div class="photo-mgr-item photo-pending">
					<span class="photo-index photo-index-new">NEW</span>
					<button class="photo-select-btn" onclick={() => removePendingUpload(i)} title="移除">
						<iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
					</button>
					<img src={up.previewUrl} alt={up.fileName} class="photo-img" />
					<div class="photo-pending-label">待上传</div>
				</div>
			{/each}
		</div>

		{#if photoItems.length === 0 && pendingUploads.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:photo-library-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>相册中没有照片</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.photo-mgr-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.photo-mgr-wrapper {
		margin-top: 12px;
	}

	/* 批量操作栏 */
	.photo-mgr-batch-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 14px;
		margin-bottom: 12px;
		background: var(--btn-regular-bg, #f3f4f6);
		border-radius: 10px;
		flex-wrap: wrap;
	}
	:global(.dark) .photo-mgr-batch-bar {
		background: rgba(255,255,255,0.03);
	}
	.batch-info {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary, #4b5563);
	}
	:global(.dark) .batch-info { color: #d1d5db; }
	.batch-selected {
		padding: 1px 8px;
		border-radius: 999px;
		background: #3b82f6;
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.batch-changed {
		padding: 1px 8px;
		border-radius: 999px;
		background: #f59e0b;
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.batch-actions {
		display: flex;
		gap: 6px;
	}
	.batch-btn {
		padding: 4px 12px;
		border-radius: 6px;
		border: 1px solid var(--border, rgba(0,0,0,0.15));
		background: transparent;
		color: var(--text-secondary, #4b5563);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.batch-btn:hover {
		background: var(--btn-card-bg-hover, rgba(0,0,0,0.04));
		border-color: var(--border, rgba(0,0,0,0.3));
	}
	:global(.dark) .batch-btn {
		border-color: rgba(255,255,255,0.15);
		color: #d1d5db;
	}
	:global(.dark) .batch-btn:hover {
		background: rgba(255,255,255,0.06);
	}
	.batch-btn-danger {
		border-color: #ef4444;
		color: #ef4444;
	}
	.batch-btn-danger:hover {
		background: #ef4444;
		color: white;
	}

	/* 进度条 */
	.photo-mgr-progress {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 14px;
		margin-bottom: 12px;
		background: rgba(59, 130, 246, 0.08);
		border-radius: 8px;
	}
	.progress-bar {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		background: rgba(59, 130, 246, 0.15);
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		border-radius: 3px;
		background: #3b82f6;
		transition: width 0.3s;
	}
	.progress-text {
		font-size: 12px;
		color: #3b82f6;
		font-weight: 500;
		white-space: nowrap;
	}

	/* 照片网格 */
	.photo-mgr-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	.photo-mgr-item {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		border: 2px solid transparent;
		transition: all 0.2s;
		cursor: grab;
		aspect-ratio: 1;
		background: var(--btn-regular-bg, #f3f4f6);
	}
	.photo-mgr-item:active { cursor: grabbing; }
	.photo-mgr-item:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		box-shadow: 0 4px 16px rgba(0,0,0,0.08);
	}
	.photo-selected {
		border-color: #3b82f6 !important;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
	}
	.photo-dragging {
		opacity: 0.4;
		transform: scale(0.95);
	}
	.photo-drag-over {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%) !important;
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.15);
	}
	.photo-is-cover {
		border-color: #f59e0b !important;
	}

	/* 序号 */
	.photo-index {
		position: absolute;
		top: 4px;
		left: 4px;
		width: 22px;
		height: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		background: rgba(0,0,0,0.6);
		color: white;
		font-size: 10px;
		font-weight: 700;
		z-index: 5;
		backdrop-filter: blur(4px);
	}

	/* 封面标记 */
	.photo-cover-badge {
		position: absolute;
		top: 4px;
		right: 28px;
		padding: 2px 8px;
		border-radius: 999px;
		background: #f59e0b;
		color: white;
		font-size: 10px;
		font-weight: 700;
		z-index: 5;
	}

	/* 选择按钮 */
	.photo-select-btn {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 26px;
		height: 26px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		border: none;
		background: rgba(0,0,0,0.4);
		color: white;
		cursor: pointer;
		z-index: 10;
		backdrop-filter: blur(4px);
		transition: all 0.15s;
		font-size: 18px;
	}
	.photo-select-btn:hover {
		background: rgba(0,0,0,0.7);
		transform: scale(1.1);
	}
	.photo-selected .photo-select-btn {
		background: #3b82f6;
	}

	/* 图片 */
	.photo-img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.3s;
	}
	.photo-mgr-item:hover .photo-img {
		transform: scale(1.05);
	}

	/* 悬停操作 */
	.photo-actions {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: center;
		gap: 4px;
		padding: 6px;
		background: linear-gradient(to top, rgba(0,0,0,0.7), transparent);
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 5;
	}
	.photo-mgr-item:hover .photo-actions {
		opacity: 1;
	}
	.photo-action-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: none;
		background: rgba(255,255,255,0.2);
		color: white;
		cursor: pointer;
		font-size: 18px;
		backdrop-filter: blur(4px);
		transition: all 0.15s;
	}
	.photo-action-btn:hover:not(:disabled) {
		background: rgba(255,255,255,0.4);
		transform: scale(1.1);
	}
	.photo-action-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	/* 拖拽手柄 */
	.photo-drag-handle {
		position: absolute;
		bottom: 4px;
		right: 4px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(255,255,255,0.6);
		font-size: 18px;
		opacity: 0;
		transition: opacity 0.2s;
		z-index: 6;
		cursor: grab;
	}
	.photo-mgr-item:hover .photo-drag-handle {
		opacity: 1;
	}
	.photo-drag-handle:active {
		cursor: grabbing;
	}

	/* 空状态 */
	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	.batch-btn-primary {
		border-color: #3b82f6;
		color: #3b82f6;
	}
	.batch-btn-primary:hover {
		background: #3b82f6;
		color: white;
	}

	/* 隐藏文件输入 */
	.hidden-file-input {
		position: absolute;
		width: 0;
		height: 0;
		overflow: hidden;
		opacity: 0;
		pointer-events: none;
	}

	/* 拖拽上传区域 */
	.grid-drag-over {
		outline: 2px dashed #3b82f6;
		outline-offset: 4px;
		background: rgba(59, 130, 246, 0.04);
	}

	/* 待上传图片 */
	.photo-pending {
		border-color: #22c55e !important;
		box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
	}
	.photo-index-new {
		background: #22c55e !important;
		font-size: 8px !important;
		letter-spacing: 0.5px;
	}
	.photo-pending-label {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		text-align: center;
		padding: 3px 0;
		background: rgba(34, 197, 94, 0.85);
		color: white;
		font-size: 10px;
		font-weight: 600;
		z-index: 5;
	}

	@media (max-width: 640px) {
		.photo-mgr-grid {
			grid-template-columns: repeat(3, 1fr);
			gap: 8px;
		}
	}
</style>
