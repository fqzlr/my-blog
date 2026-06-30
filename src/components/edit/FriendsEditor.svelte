<script lang="ts">
	import { onMount } from "svelte";
	import EditToolbar from "./EditToolbar.svelte";
	import EditToast from "./EditToast.svelte";
	import {
		showToast,
		genId,
		deepClone,
		ensureIconify,
		getRepoFile,
	} from "@/utils/editMode";
	import { setupRepoDrafts } from "@/utils/draftHelpers";
	import { friendsEditConfig } from "@/config/editConfig";

	interface FriendItem {
		id?: string;
		title: string;
		imgurl: string;
		desc: string;
		siteurl: string;
		tags?: string[];
		weight?: number;
		_draft?: boolean;
	}

	let editMode = $state(false);
	let saving = $state(false);
	let friends = $state<FriendItem[]>([]);
	let originalFriends = $state<FriendItem[]>([]);
	let editingIndex = $state(-1);
	let repoLoaded = $state(false);
	let fileSha = $state<string | null>(null);

	const typeColors: Record<string, { bg: string; text: string }> = {
		Blog: { bg: "#3b82f6", text: "#ffffff" },
		Docs: { bg: "#f59e0b", text: "#ffffff" },
	};

	const drafts = setupRepoDrafts({
		pageKey: "friends",
		pageName: "友链",
		getContent: () => JSON.stringify(friends, null, 2),
		setContent: (v) => (friends = JSON.parse(v)),
		getPath: () => "public/friends.json",
		getSha: () => fileSha,
		setSha: (v) => (fileSha = v),
		getOriginalContent: () => JSON.stringify(originalFriends, null, 2),
		setOriginalContent: (v) => (originalFriends = JSON.parse(v)),
		getCommitMsg: (isEdit) => isEdit ? `chore: update friends` : `chore: create friends`,
		onSubmitted: () => {
			setTimeout(() => window.location.reload(), 1200);
		},
	});

	let hasChanges = $derived(drafts.hasLocalChanges());

	onMount(() => {
		ensureIconify();
		collectFromDOM();
		loadRepoData();
	});

	async function loadRepoData() {
		const existing = await getRepoFile("public/friends.json");
		if (existing && existing.content) {
			try {
				const repoItems: FriendItem[] = JSON.parse(existing.content);
				const existingUrls = new Set(friends.map((f) => f.siteurl.replace(/\/$/, "")));
				for (const g of repoItems) {
					const url = g.siteurl.replace(/\/$/, "");
					if (!existingUrls.has(url)) {
						friends = [...friends, { ...g, id: g.id || genId("fr") }];
						existingUrls.add(url);
					}
				}
				originalFriends = deepClone(friends);
			} catch (e) {
				console.error("Failed to parse repo friends:", e);
			}
		}
		repoLoaded = true;
		drafts.restoreFromDrafts();
	}

	function collectFromDOM() {
		const grid = document.getElementById("friends-grid");
		if (!grid) return;
		const items: FriendItem[] = [];
		grid.querySelectorAll(".friend-card").forEach((el) => {
			const card = el as HTMLElement;
			const link = card.querySelector("a.friend-card-link") as HTMLAnchorElement | null;
			if (!link) return;
			const title = card.querySelector(".friend-card-title")?.textContent?.trim() || "";
			const desc = card.querySelector(".friend-card-desc")?.textContent?.trim() || link.dataset.desc || "";
			const img = card.querySelector("img.friend-card-avatar") as HTMLImageElement | null;
			const badge = card.querySelector(".friend-card-type-badge");
			const tag = badge?.textContent?.trim() || "Blog";
			items.push({
				id: card.dataset.friendId || link.href,
				title,
				imgurl: img?.src || "",
				desc,
				siteurl: link.href,
				tags: [tag],
			});
		});
		friends = items;
		originalFriends = deepClone(items);
	}

	// 进入/退出编辑模式
	function handleModeChange(e: CustomEvent) {
		editMode = e.detail.editing;
		if (editMode) {
			hideSSRGrid();
			editingIndex = -1;
		} else {
			showSSRGrid();
		}
	}

	function hideSSRGrid() {
		const grid = document.getElementById("friends-grid");
		if (grid) {
			grid.style.display = "none";
		}
	}

	function showSSRGrid() {
		const grid = document.getElementById("friends-grid");
		if (grid) {
			grid.style.display = "";
		}
	}

	// 取消编辑：回滚到原始数据
	function handleCancel() {
		friends = deepClone(originalFriends);
		drafts.clearDrafts();
		editingIndex = -1;
		showSSRGrid();
	}

	// 移动卡片
	function moveUp(index: number) {
		if (index <= 0) return;
		const arr = [...friends];
		[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
		friends = arr;
		if (editingIndex === index) editingIndex = index - 1;
		else if (editingIndex === index - 1) editingIndex = index;
	}

	function moveDown(index: number) {
		if (index >= friends.length - 1) return;
		const arr = [...friends];
		[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
		friends = arr;
		if (editingIndex === index) editingIndex = index + 1;
		else if (editingIndex === index + 1) editingIndex = index;
	}

	// 开始内联编辑
	function startEdit(index: number) {
		editingIndex = index;
	}

	// 完成内联编辑
	function finishEdit(index: number) {
		const f = friends[index];
		if (!f.title.trim()) {
			showToast("名称不能为空", "warning");
			return;
		}
		if (!f.siteurl.trim()) {
			showToast("链接不能为空", "warning");
			return;
		}
		editingIndex = -1;
		showToast("已修改，记得点击保存", "info");
	}

	// 取消单卡片编辑
	function cancelItemEdit(index: number) {
		const f = friends[index];
		if (f._draft && !f.title.trim()) {
			friends = friends.filter((_, i) => i !== index);
		} else {
			const orig = originalFriends.find(
				(o) => (o.id || o.siteurl) === (f.id || f.siteurl) && !f._draft,
			);
			if (orig) {
				friends[index] = deepClone(orig);
				friends = [...friends];
			}
		}
		editingIndex = -1;
	}

	// 删除卡片
	function deleteItem(index: number) {
		const f = friends[index];
		if (!confirm(`确定要删除「${f.title || "该条目"}」吗？`)) return;
		friends = friends.filter((_, i) => i !== index);
		if (editingIndex === index) editingIndex = -1;
		else if (editingIndex > index) editingIndex--;
		showToast("已删除，记得点击保存", "info");
	}

	// 添加新友链（草稿模式，立即进入编辑态）
	function handleAdd() {
		const newFriend: FriendItem = {
			id: genId("fr"),
			title: "",
			imgurl: "",
			desc: "",
			siteurl: "",
			tags: ["Blog"],
			_draft: true,
		};
		friends = [...friends, newFriend];
		editingIndex = friends.length - 1;
	}

	function handleSaveDraft() {
		const cleanData = friends.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("fr"),
		}));
		friends = cleanData;
		drafts.saveToDrafts();
	}

	async function handleSubmit() {
		if (editingIndex >= 0) {
			finishEdit(editingIndex);
			if (editingIndex >= 0) return;
		}
		saving = true;
		try {
			const cleanData = friends.map(({ _draft, ...rest }) => ({
				...rest,
				id: rest.id || genId("fr"),
			}));
			friends = cleanData;
			await drafts.submitDrafts();
		} finally {
			saving = false;
		}
	}

	// 更新编辑中的卡片字段
	function updateField(index: number, field: keyof FriendItem, value: string) {
		friends[index] = { ...friends[index], [field]: value };
		friends = [...friends];
	}

	function getTagColor(tag: string) {
		return typeColors[tag] || typeColors.Blog;
	}
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="friends-edit-toolbar">
	<EditToolbar
		pageKey="friends"
		pageName="友链"
		mountTo=".page-header-toolbar-slot"
		{saving}
		{hasChanges}
		on:modeChange={(e) => handleModeChange(e)}
		on:add={() => handleAdd()}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
		on:cancel={() => handleCancel()}
	/>
</div>

<!-- 编辑模式：Svelte渲染的可编辑网格 -->
{#if editMode}
	<div class="edit-friends-grid" id="edit-friends-grid">
		{#each friends as friend, i (i + "-" + (friend.id || friend.siteurl))}
			<div
				class="edit-friend-card"
				class:edit-friend-card-draft={friend._draft}
				class:edit-friend-card-editing={editingIndex === i}
			>
				<!-- 操作按钮行（非编辑态显示） -->
				{#if editingIndex !== i}
					<div class="card-action-row">
						{#if i > 0}
							<button class="action-btn action-move" onclick={() => moveUp(i)} title="上移">
								<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
							</button>
						{/if}
						{#if i < friends.length - 1}
							<button class="action-btn action-move" onclick={() => moveDown(i)} title="下移">
								<iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
							</button>
						{/if}
						<button class="action-btn action-edit" onclick={() => startEdit(i)} title="编辑">
							<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
						</button>
						<button class="action-btn action-delete" onclick={() => deleteItem(i)} title="删除">
							<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						</button>
					</div>

					<!-- 卡片展示态 -->
					<div class="card-display">
						<span
							class="card-type-badge"
							style={`background-color:${getTagColor(friend.tags?.[0] || "Blog").bg};color:${getTagColor(friend.tags?.[0] || "Blog").text}`}
						>
							{friend.tags?.[0] || "Blog"}
						</span>
						<div class="card-avatar-wrap">
							{#if friend.imgurl}
								<img src={friend.imgurl} alt={friend.title} class="card-avatar" loading="lazy" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
							{:else}
								<div class="card-avatar-placeholder">
									<iconify-icon icon="material-symbols:person-outline"></iconify-icon>
								</div>
							{/if}
						</div>
						<div class="card-info">
							<h3 class="card-title">{friend.title || "（未命名）"}</h3>
							<p class="card-desc">{friend.desc || "暂无描述"}</p>
							<p class="card-url">{friend.siteurl}</p>
						</div>
					</div>
				{:else}
					<!-- 卡片编辑态：内联表单 -->
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑友链</span>
							{#if friend._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>名称</label>
							<input
								type="text"
								value={friend.title}
								oninput={(e) => updateField(i, "title", (e.target as HTMLInputElement).value)}
								placeholder="站点名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>头像URL</label>
							<input
								type="text"
								value={friend.imgurl}
								oninput={(e) => updateField(i, "imgurl", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/avatar.png"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>链接</label>
							<input
								type="text"
								value={friend.siteurl}
								oninput={(e) => updateField(i, "siteurl", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>描述</label>
							<textarea
								value={friend.desc}
								oninput={(e) => updateField(i, "desc", (e.target as HTMLTextAreaElement).value)}
								placeholder="站点描述"
								class="form-textarea"
								rows={2}
							></textarea>
						</div>
						<div class="form-group">
							<label>类型</label>
							<select
								value={friend.tags?.[0] || "Blog"}
								onchange={(e) => {
									friends[i] = { ...friends[i], tags: [(e.target as HTMLSelectElement).value] };
									friends = [...friends];
								}}
								class="form-select"
							>
								<option value="Blog">Blog</option>
								<option value="Docs">Docs</option>
							</select>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(i)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if friends.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:link-off-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无友链，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{/if}

<style>
	.friends-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	/* 可编辑网格 */
	.edit-friends-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-friend-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-friend-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.edit-friend-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.08);
	}
	.edit-friend-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-friend-card-editing {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}

	/* 操作按钮行 */
	.card-action-row {
		position: absolute;
		top: 8px;
		right: 8px;
		display: flex;
		gap: 4px;
		z-index: 10;
		opacity: 1;
		transition: opacity 0.2s;
	}
	.edit-friend-card:hover .card-action-row {
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
	.action-btn iconify-icon {
		display: flex;
	}
	.action-move {
		background: rgba(100, 116, 139, 1);
	}
	.action-move:hover {
		background: rgba(71, 85, 105, 1);
		transform: scale(1.1);
	}
	.action-edit {
		background: rgba(59, 130, 246, 1);
	}
	.action-edit:hover {
		background: rgba(37, 99, 235, 1);
		transform: scale(1.1);
	}
	.action-delete {
		background: rgba(239, 68, 68, 1);
	}
	.action-delete:hover {
		background: rgba(220, 38, 38, 1);
		transform: scale(1.1);
	}

	/* 卡片展示态 */
	.card-display {
		padding: 20px;
		cursor: default;
	}
	.card-type-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		margin-bottom: 12px;
	}
	.card-avatar-wrap {
		width: 48px;
		height: 48px;
		border-radius: 12px;
		overflow: hidden;
		margin-bottom: 12px;
		background: var(--btn-regular-bg, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.dark) .card-avatar-wrap {
		background: rgba(255,255,255,0.05);
	}
	.card-avatar {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.card-avatar-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 24px;
	}
	.card-title {
		margin: 0 0 4px;
		font-size: 15px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.dark) .card-title {
		color: #f0f0f0;
	}
	.card-desc {
		margin: 0 0 6px;
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.5;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.dark) .card-desc {
		color: #9ca3af;
	}
	.card-url {
		margin: 0;
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 内联编辑表单 */
	.card-edit-form {
		padding: 20px;
	}
	.edit-form-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.draft-badge {
		padding: 1px 8px;
		border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.form-group {
		margin-bottom: 12px;
	}
	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 4px;
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}
	.form-input,
	.form-textarea,
	.form-select {
		width: 100%;
		padding: 8px 12px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 8px;
		font-size: 13px;
		background: var(--bg-color, white);
		color: var(--text-color, #1f2937);
		outline: none;
		transition: border-color 0.2s;
		box-sizing: border-box;
		font-family: inherit;
	}
	:global(.dark) .form-input,
	:global(.dark) .form-textarea,
	:global(.dark) .form-select {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.form-input:focus,
	.form-textarea:focus,
	.form-select:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.form-textarea {
		resize: vertical;
		min-height: 50px;
	}
	.form-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.form-btn {
		flex: 1;
		padding: 8px;
		border-radius: 8px;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.form-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.form-btn-cancel:hover {
		background: var(--border, #e5e7eb);
	}
	:global(.dark) .form-btn-cancel {
		background: #2d2d44;
		color: #d1d5db;
	}
	.form-btn-save {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.form-btn-save:hover {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}

	/* 空状态 */
	.empty-state {
		grid-column: 1 / -1;
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}
</style>
