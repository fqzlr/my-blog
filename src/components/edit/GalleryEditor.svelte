<script lang="ts">
	import { onMount } from "svelte";
	import EditToolbar from "./EditToolbar.svelte";
	import EditToast from "./EditToast.svelte";
	import {
		getRepoFile,
		updateRepoFile,
		showToast,
		hasValidToken,
		genId,
		deepClone,
		ensureIconify,
		saveDraft,
		getDraft,
		deleteDraft,
		registerSubmitHandler,
	} from "@/utils/editMode";
	import { repoConfig } from "@/config/editConfig";

	interface AlbumItem {
		id: string;
		name: string;
		description: string;
		location: string;
		date: string;
		tags: string[];
		cover: string;
		photoCount?: number;
		_draft?: boolean;
	}

	let {
		initialAlbums = [],
		pageName = "相册",
	}: {
		initialAlbums?: AlbumItem[];
		pageName?: string;
	} = $props();

	let editMode = $state(false);
	let saving = $state(false);
	let hasChanges = $state(false);
	let albums = $state<AlbumItem[]>([]);
	let originalAlbums = $state<AlbumItem[]>([]);
	let editingIndex = $state(-1);
	let gistLoaded = $state(false);
	let originalFileContent = $state("");
	let originalFileSha = $state("");

	onMount(() => {
		ensureIconify();
		albums = [...initialAlbums];
		originalAlbums = deepClone(initialAlbums);
		loadGalleryConfig();
		const draft = getDraft<any>("gallery");
		if (draft?.albums) {
			if (confirm("发现未提交的相册草稿，是否恢复？")) {
				albums = draft.albums;
				hasChanges = true;
				showToast("草稿已恢复", "success");
			} else { deleteDraft("gallery"); }
		}
		window.addEventListener("blog:batch-submit", handleBatchSubmit);
		return () => window.removeEventListener("blog:batch-submit", handleBatchSubmit);
	});

	function getTagsStr(album: AlbumItem): string {
		return (album.tags || []).join(", ");
	}

	function updateField(index: number, field: keyof AlbumItem, value: any) {
		albums[index] = { ...albums[index], [field]: value };
		albums = [...albums];
	}

	function updateTags(index: number, value: string) {
		const tags = value.split(/[,，\s]+/).map((t) => t.trim()).filter(Boolean);
		albums[index] = { ...albums[index], tags };
		albums = [...albums];
	}

	function startEdit(index: number) { editingIndex = index; }

	function finishEdit(index: number) {
		const album = albums[index];
		if (!album.name.trim()) {
			showToast("相册名称不能为空", "warning");
			return;
		}
		albums[index] = { ...album, _draft: false };
		albums = [...albums];
		editingIndex = -1;
		hasChanges = true;
		showToast("已修改，记得点击提交保存", "info");
	}

	function cancelItemEdit(index: number) {
		const album = albums[index];
		if (album._draft && !album.name.trim()) {
			albums = albums.filter((_, i) => i !== index);
		} else {
			const orig = originalAlbums.find((o) => o.id === album.id && !album._draft);
			if (orig) {
				albums[index] = deepClone(orig);
				albums = [...albums];
			}
		}
		editingIndex = -1;
	}

	function deleteItem(index: number) {
		const album = albums[index];
		if (!confirm(`确定要删除相册「${album.name || "该相册"}」吗？`)) return;
		albums = albums.filter((_, i) => i !== index);
		hasChanges = true;
		if (editingIndex === index) editingIndex = -1;
		else if (editingIndex > index) editingIndex--;
		showToast("已删除，记得点击提交保存", "info");
	}

	function handleAdd() {
		const newAlbum: AlbumItem = {
			id: "new-album-" + Date.now(),
			name: "",
			description: "",
			location: "",
			date: new Date().toISOString().split("T")[0],
			tags: [],
			cover: "",
			photoCount: 0,
			_draft: true,
		};
		albums = [...albums, newAlbum];
		editingIndex = albums.length - 1;
		hasChanges = true;
	}

	async function loadGalleryConfig() {
		if (!hasValidToken()) { gistLoaded = true; return; }
		try {
			const file = await getRepoFile("src/config/galleryConfig.ts", repoConfig);
			if (file) {
				originalFileContent = file.content;
				originalFileSha = file.sha;
				const match = file.content.match(/albums\s*:\s*\[([\s\S]*?)\]\s*,?\s*\n\s*(?:\/\/|columnWidth|networkAlbum|\})/);
				if (match) {
					try {
						const cleaned = match[1]
							.replace(/\/\/.*$/gm, "")
							.replace(/\/\*[\s\S]*?\*\//g, "")
							.replace(/,\s*$/, "");
						const parsed: AlbumItem[] = JSON.parse("[" + cleaned + "]");
						// Merge: remote data overrides local SSR data (matched by id)
						for (const remote of parsed) {
							const localIdx = albums.findIndex((a) => a.id === remote.id);
							if (localIdx >= 0) {
								albums[localIdx] = { ...remote, photoCount: albums[localIdx].photoCount };
							} else {
								albums = [...albums, remote];
							}
						}
						originalAlbums = deepClone(albums);
					} catch (e) {
						console.warn("Failed to parse albums from config:", e);
					}
				}
			}
		} catch (e) {
			console.warn("Failed to load gallery config:", e);
		}
		gistLoaded = true;
	}

	function handleSaveDraft() {
		deleteDraft("gallery");
		saveDraft({
			pageKey: "gallery",
			pageName: "相册",
			description: `更新相册 共 ${albums.length} 个相册`,
			operation: "update",
			payload: { albums },
		});
		showToast("相册草稿已保存", "success");
	}

	async function handleBatchSubmit() {
		const draft = getDraft<any>("gallery");
		if (draft?.albums) { albums = draft.albums; await handleSave(); if (!saving) deleteDraft("gallery"); }
	}

	async function handleSave(): Promise<boolean> {
		if (!hasValidToken()) {
			showToast("请先导入密钥再保存", "warning");
			return false;
		}
		saving = true;
		try {
			// Build clean albums JSON
			const cleanAlbums = albums.map(({ _draft, photoCount, ...rest }) => ({
				...rest,
				id: rest.id || genId("album"),
			}));
			const albumsJson = JSON.stringify(cleanAlbums, null, 2);

			// Try to read current file and replace only albums array
			let contentToSave = "";
			let sha = originalFileSha;

			if (originalFileContent) {
				// Re-read for latest sha
				const latestFile = await getRepoFile("src/config/galleryConfig.ts", repoConfig);
				if (latestFile) {
					sha = latestFile.sha;
					const content = latestFile.content;
					const startMatch = content.match(/albums\s*:\s*\[/);
					if (startMatch && startMatch.index !== undefined) {
						const startIdx = startMatch.index;
						const arrStart = startIdx + startMatch[0].length;
						// Find matching closing bracket
						let depth = 1;
						let pos = arrStart;
						for (; pos < content.length && depth > 0; pos++) {
							if (content[pos] === "[") depth++;
							else if (content[pos] === "]") depth--;
						}
						if (depth === 0) {
							const before = content.slice(0, startIdx);
							const after = content.slice(pos);
							contentToSave = before + "albums: " + albumsJson + after;
						}
					}
				}
			}

			if (!contentToSave) {
				// Fallback: generate full config
				contentToSave = `import type { GalleryConfig } from "@/types/config";\n\n// 相册配置\nexport const galleryConfig: GalleryConfig = {\n\t// 相册列表\n\talbums: ${albumsJson},\n\n\t// 瀑布流最小列宽(px)\n\tcolumnWidth: 240,\n\n\t// 网络相册配置\n\tnetworkAlbum: {\n\t\tmaxQuantity: 10,\n\t\tdefaultQuantity: 6,\n\t},\n};\n`;
			}

			// Get sha if we don't have it
			if (!sha) {
				const file = await getRepoFile("src/config/galleryConfig.ts", repoConfig);
				if (file) sha = file.sha;
			}

			const ok = await updateRepoFile(
				"src/config/galleryConfig.ts",
				contentToSave,
				sha,
				"chore: 更新相册配置",
				repoConfig,
			);

			if (ok) {
				showToast("保存成功！配置将在部署后生效", "success");
				hasChanges = false;
				originalAlbums = deepClone(albums);
				// Re-read for next save
				const updated = await getRepoFile("src/config/galleryConfig.ts", repoConfig);
				if (updated) {
					originalFileContent = updated.content;
					originalFileSha = updated.sha;
				}
			} else {
				showToast("保存失败，请检查 Token 权限（需要 repo 权限）", "error");
			}
			return ok;
		} catch (e) {
			showToast("保存失败：" + (e as Error).message, "error");
			return false;
		} finally {
			saving = false;
		}
	}

	function handleCancel() {
		albums = deepClone(originalAlbums);
		hasChanges = false;
		editingIndex = -1;
		showSSRContent();
	}

	function handleModeChange(e: CustomEvent) {
		editMode = e.detail.editing;
		if (editMode) {
			hideSSRContent();
			editingIndex = -1;
		} else {
			showSSRContent();
		}
	}

	function hideSSRContent() {
		document.querySelectorAll<HTMLElement>(".gallery-ssr-content").forEach((s) => {
			s.style.display = "none";
		});
	}

	function showSSRContent() {
		document.querySelectorAll<HTMLElement>(".gallery-ssr-content").forEach((s) => {
			s.style.display = "";
		});
	}

	// 注册批量提交处理程序
	registerSubmitHandler("gallery", async (draft) => {
		if (draft.payload?.type === "gist") return false; // gallery 不使用 gist
		if (draft.payload?.albums) {
			albums = draft.payload.albums;
			const ok = await handleSave();
			return ok;
		}
		return false;
	});
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="gallery-edit-toolbar">
	<EditToolbar
		{pageName}
		mountTo=".page-header-toolbar-slot"
		{saving}
		{hasChanges}
		on:modeChange={(e) => handleModeChange(e)}
		on:add={() => handleAdd()}
		on:submit={() => handleSave()}
		on:saveDraft={() => handleSaveDraft()}
		on:cancel={() => handleCancel()}
	/>
</div>

{#if !gistLoaded}
	<div class="loading-hint">
		<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin mr-2"></iconify-icon>
		加载数据中...
	</div>
{/if}

<!-- 编辑模式 -->
{#if editMode}
	<div class="edit-gallery-wrapper">
		<div class="edit-gallery-header">
			<iconify-icon icon="material-symbols:photo-library-outline-rounded" class="text-lg"></iconify-icon>
			<span>共 {albums.length} 个相册</span>
			<span class="edit-gallery-hint">点击卡片上的编辑按钮修改相册信息</span>
		</div>

		<div class="edit-gallery-grid">
			{#each albums as album, i (i + "-" + album.id)}
				<div
					class="edit-album-card"
					class:edit-album-card-draft={album._draft}
					class:edit-album-card-editing={editingIndex === i}
				>
					<!-- 非编辑态：展示卡片 -->
					{#if editingIndex !== i}
						<div class="card-action-row">
							<button class="action-btn action-edit" onclick={() => startEdit(i)} title="编辑">
								<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
							</button>
							<button class="action-btn action-delete" onclick={() => deleteItem(i)} title="删除">
								<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
							</button>
						</div>

						<div class="card-poster">
							{#if album.cover}
								<img src={album.cover} alt={album.name} class="card-poster-img" loading="lazy" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
							{:else}
								<div class="card-poster-placeholder">
									<iconify-icon icon="material-symbols:photo-library-outline-rounded"></iconify-icon>
								</div>
							{/if}
							<div class="card-poster-gradient"></div>
							{#if album.photoCount}
								<span class="card-photo-count">{album.photoCount} 张</span>
							{/if}
							<div class="card-poster-info">
								<h3 class="card-poster-title">{album.name || "（未命名）"}</h3>
								{#if album.date}
									<span class="card-poster-date">{album.date}</span>
								{/if}
							</div>
						</div>

						<div class="card-meta">
							<h3 class="card-meta-title">{album.name || "（未命名）"}</h3>
							{#if album.description}
								<p class="card-meta-desc">{album.description}</p>
							{/if}
							{#if album.location}
								<p class="card-meta-location">
									<iconify-icon icon="material-symbols:location-on-outline-rounded" class="text-xs"></iconify-icon>
									{album.location}
								</p>
							{/if}
							{#if album.tags && album.tags.length > 0}
								<div class="card-meta-tags">
									{#each album.tags.slice(0, 4) as tag (tag)}
										<span class="card-meta-tag">{tag}</span>
									{/each}
								</div>
							{/if}
						</div>
					{:else}
						<!-- 编辑态：内联表单 -->
						<div class="card-edit-form">
							<div class="edit-form-header">
								<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
								<span>编辑相册</span>
								{#if album._draft}
									<span class="draft-badge">新增</span>
								{/if}
							</div>

							<div class="form-preview">
								{#if album.cover}
									<img src={album.cover} alt="" class="form-preview-img" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
								{:else}
									<div class="form-preview-placeholder">
										<iconify-icon icon="material-symbols:image-outline"></iconify-icon>
									</div>
								{/if}
							</div>

							<div class="form-group">
								<label>相册名称</label>
								<input type="text" value={album.name} oninput={(e) => updateField(i, "name", (e.target as HTMLInputElement).value)} placeholder="相册名称" class="form-input" />
							</div>
							<div class="form-group">
								<label>描述</label>
								<input type="text" value={album.description} oninput={(e) => updateField(i, "description", (e.target as HTMLInputElement).value)} placeholder="简短描述" class="form-input" />
							</div>
							<div class="form-row">
								<div class="form-group form-group-half">
									<label>日期</label>
									<input type="date" value={album.date} oninput={(e) => updateField(i, "date", (e.target as HTMLInputElement).value)} class="form-input" />
								</div>
								<div class="form-group form-group-half">
									<label>地点</label>
									<input type="text" value={album.location} oninput={(e) => updateField(i, "location", (e.target as HTMLInputElement).value)} placeholder="拍摄地点" class="form-input" />
								</div>
							</div>
							<div class="form-group">
								<label>封面图片 URL（可选）</label>
								<input type="text" value={album.cover} oninput={(e) => updateField(i, "cover", (e.target as HTMLInputElement).value)} placeholder="留空则自动检测" class="form-input" />
							</div>
							<div class="form-group">
								<label>相册 ID（目录名）</label>
								<input type="text" value={album.id} oninput={(e) => updateField(i, "id", (e.target as HTMLInputElement).value)} placeholder="如 ai-2026" class="form-input" />
							</div>
							<div class="form-group">
								<label>标签（逗号分隔）</label>
								<input type="text" value={getTagsStr(album)} oninput={(e) => updateTags(i, (e.target as HTMLInputElement).value)} placeholder="标签1, 标签2" class="form-input" />
							</div>

							<div class="form-actions">
								<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
								<button class="form-btn form-btn-save" onclick={() => finishEdit(i)}>完成</button>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			{#if albums.length === 0}
				<div class="empty-state">
					<iconify-icon icon="material-symbols:photo-library-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
					<p>暂无相册，点击"添加"创建</p>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.gallery-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.loading-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		color: var(--content-meta, #737373);
		font-size: 14px;
	}

	/* ===== 编辑模式 ===== */
	.edit-gallery-wrapper {
		margin-top: 8px;
	}

	.edit-gallery-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		margin-bottom: 12px;
		font-size: 13px;
		font-weight: 500;
		color: var(--text-secondary, #4b5563);
		background: var(--btn-regular-bg, #f3f4f6);
		border-radius: 10px;
	}
	:global(.dark) .edit-gallery-header {
		background: rgba(255,255,255,0.03);
		color: #d1d5db;
	}
	.edit-gallery-hint {
		margin-left: auto;
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		font-weight: 400;
	}

	.edit-gallery-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 16px;
	}

	.edit-album-card {
		position: relative;
		border-radius: 14px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-album-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.edit-album-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
	}
	.edit-album-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-album-card-editing {
		grid-column: span 2;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}

	/* 操作按钮 */
	.card-action-row {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
		opacity: 1;
	}
	.action-btn {
		width: 30px;
		height: 30px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 16px;
		backdrop-filter: blur(8px);
		transition: all 0.15s;
		color: white;
	}
	.action-btn iconify-icon { display: flex; }
	.action-edit { background: rgba(59, 130, 246, 0.85); }
	.action-edit:hover { background: rgba(37, 99, 235, 0.95); transform: scale(1.1); }
	.action-delete { background: rgba(239, 68, 68, 0.85); }
	.action-delete:hover { background: rgba(220, 38, 38, 0.95); transform: scale(1.1); }

	/* 海报区域 */
	.card-poster {
		position: relative;
		aspect-ratio: 4/3;
		background: var(--btn-regular-bg, #f3f4f6);
		overflow: hidden;
	}
	:global(.dark) .card-poster { background: rgba(255,255,255,0.04); }
	.card-poster-img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s; }
	.edit-album-card:hover .card-poster-img { transform: scale(1.05); }
	.card-poster-placeholder {
		width: 100%; height: 100%;
		display: flex; align-items: center; justify-content: center;
		color: var(--content-meta, #9ca3af); font-size: 36px;
	}
	.card-poster-gradient {
		position: absolute; inset: auto 0 0 0; height: 55%;
		background: linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.28) 50%, transparent 100%);
		pointer-events: none; z-index: 1;
	}
	.card-photo-count {
		position: absolute; top: 8px; left: 8px;
		padding: 3px 10px; border-radius: 999px;
		font-size: 10px; font-weight: 600; color: #fff;
		background: rgba(0,0,0,0.5); backdrop-filter: blur(6px); z-index: 3;
	}
	.card-poster-info {
		position: absolute; inset: auto 0 0 0; z-index: 2;
		padding: 0 10px 10px; pointer-events: none;
	}
	.card-poster-title {
		font-size: 14px; font-weight: 700; line-height: 1.4;
		color: #fff; margin: 0 0 2px;
		text-shadow: 0 1px 3px rgba(0,0,0,0.4);
		display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	.card-poster-date {
		font-size: 11px; color: rgba(255,255,255,0.7); font-weight: 500;
	}

	/* 卡片 meta */
	.card-meta { padding: 10px 12px; }
	.card-meta-title {
		margin: 0 0 4px; font-size: 13px; font-weight: 600;
		color: var(--text-color, #1f2937);
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	:global(.dark) .card-meta-title { color: #f0f0f0; }
	.card-meta-desc {
		margin: 0 0 4px; font-size: 11px;
		color: var(--text-secondary, #6b7280); line-height: 1.5;
		display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
	}
	:global(.dark) .card-meta-desc { color: #9ca3af; }
	.card-meta-location {
		display: flex; align-items: center; gap: 3px;
		margin: 0 0 6px; font-size: 11px;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .card-meta-location { color: #9ca3af; }
	.card-meta-tags { display: flex; flex-wrap: wrap; gap: 4px; }
	.card-meta-tag {
		font-size: 10px; padding: 1px 7px; border-radius: 999px;
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--content-meta, #6b7280);
	}
	:global(.dark) .card-meta-tag { background: rgba(255,255,255,0.06); color: #9ca3af; }

	/* ===== 内联编辑表单 ===== */
	.card-edit-form { padding: 20px; }
	.edit-form-header {
		display: flex; align-items: center; gap: 8px;
		margin-bottom: 16px; font-size: 14px; font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.draft-badge {
		padding: 1px 8px; border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white; font-size: 11px; font-weight: 600;
	}
	.form-preview {
		width: 100%; height: 120px; border-radius: 10px;
		overflow: hidden; margin: 0 auto 16px;
		background: var(--btn-regular-bg, #f3f4f6); flex-shrink: 0;
	}
	:global(.dark) .form-preview { background: rgba(255,255,255,0.05); }
	.form-preview-img { width: 100%; height: 100%; object-fit: cover; }
	.form-preview-placeholder {
		width: 100%; height: 100%;
		display: flex; align-items: center; justify-content: center;
		color: var(--content-meta, #9ca3af); font-size: 32px;
	}
	.form-row { display: flex; gap: 10px; }
	.form-group { margin-bottom: 12px; }
	.form-group-half { flex: 1; }
	.form-group label {
		display: block; font-size: 12px; font-weight: 600;
		color: var(--text-secondary, #4b5563); margin-bottom: 4px;
	}
	:global(.dark) .form-group label { color: #d1d5db; }
	.form-input, .form-select {
		width: 100%; padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db); border-radius: 8px;
		font-size: 13px; background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none; transition: border-color 0.2s;
		box-sizing: border-box; font-family: inherit;
	}
	:global(.dark) .form-input, :global(.dark) .form-select {
		background: #0f0f1a; border-color: #374151; color: #e5e7eb;
	}
	.form-input:focus, .form-select:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.form-actions { display: flex; gap: 8px; margin-top: 16px; }
	.form-btn {
		flex: 1; padding: 8px; border-radius: 8px;
		font-size: 13px; font-weight: 600; cursor: pointer;
		transition: all 0.15s; border: none;
		display: flex; align-items: center; justify-content: center;
	}
	.form-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.form-btn-cancel:hover { background: var(--border, #e5e7eb); }
	:global(.dark) .form-btn-cancel { background: #2d2d44; color: #d1d5db; }
	.form-btn-save {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.form-btn-save:hover { background: hsl(var(--theme-hue, 165), 75%, 45%); }

	/* 空状态 */
	.empty-state {
		grid-column: 1 / -1; text-align: center;
		padding: 48px 20px; color: var(--content-meta, #9ca3af); font-size: 14px;
	}

	@media (max-width: 640px) {
		.edit-gallery-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
		.edit-album-card-editing { grid-column: 1 / -1; }
		.card-meta { padding: 8px; }
		.card-edit-form { padding: 16px; }
	}
</style>
