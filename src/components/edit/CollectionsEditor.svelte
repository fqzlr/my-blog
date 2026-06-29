<script lang="ts">
	import { onMount } from "svelte";
	import EditToolbar from "./EditToolbar.svelte";
	import EditToast from "./EditToast.svelte";
	import {
		readGistFile,
		showToast,
		genId,
		deepClone,
		ensureIconify,
	} from "@/utils/editMode";
	import { setupGistDrafts } from "@/utils/draftHelpers";
	import { collectionsEditConfig } from "@/config/editConfig";

	interface CollectionItem {
		id?: string;
		name: string;
		url: string;
		description: string;
		category: string;
		icon?: string;
		enabled: boolean;
		_draft?: boolean;
	}

	const props = $props<{
		initialData: string;
	}>();

	let editMode = $state(false);
	let saving = $state(false);
	let items = $state<CollectionItem[]>([]);
	let originalItems = $state<CollectionItem[]>([]);
	let editingIndex = $state(-1);
	let gistLoaded = $state(false);
	let activeTab = $state("all");
	let gistConfig = $state({ gistId: collectionsEditConfig.gistId, fileName: collectionsEditConfig.fileName });

	const drafts = setupGistDrafts<CollectionItem[]>({
		pageKey: "collections",
		pageName: "收藏",
		getData: () => items,
		setData: (v) => (items = v),
		getOriginalData: () => originalItems,
		setOriginalData: (v) => (originalItems = v),
		gistConfig,
		onSubmitted: () => {
			setTimeout(() => window.location.reload(), 1200);
		},
	});

	let hasChanges = $derived(drafts.hasLocalChanges());

	onMount(() => {
		ensureIconify();
		// 从 initialData prop 解析初始数据
		parseInitialData();
		// 加载 Gist 数据（外部收藏）
		loadGistData();
	});

	function parseInitialData() {
		try {
			const parsed = JSON.parse(props.initialData);
			const apis: CollectionItem[] = parsed.apis || parsed || [];
			items = apis.map((a: CollectionItem) => ({
				...a,
				id: a.id || genId("col"),
				enabled: a.enabled !== false,
			}));
			originalItems = deepClone(items);
		} catch (e) {
			console.error("Failed to parse initial collections data:", e);
			items = [];
			originalItems = [];
		}
	}

	async function loadGistData() {
		if (!collectionsEditConfig.gistId) {
			gistLoaded = true;
			drafts.restoreFromDrafts();
			return;
		}
		try {
			const content = await readGistFile(
				collectionsEditConfig.gistId,
				collectionsEditConfig.fileName,
			);
			if (content) {
				const gistItems: CollectionItem[] = JSON.parse(content);
				const existingUrls = new Set(
					items.map((i) => i.url.replace(/\/$/, "")),
				);
				for (const g of gistItems) {
					const url = g.url.replace(/\/$/, "");
					if (!existingUrls.has(url)) {
						items = [
							...items,
							{ ...g, id: g.id || genId("col"), enabled: g.enabled !== false },
						];
						existingUrls.add(url);
					}
				}
				originalItems = deepClone(items);
			}
		} catch (e) {
			console.error("Failed to load Gist collections:", e);
		}
		gistLoaded = true;
		drafts.restoreFromDrafts();
	}

	const enabledItems = $derived(items.filter((i) => i.enabled !== false));
	const allCategories = $derived([...new Set(items.map((i) => i.category).filter(Boolean))]);
	const enabledCategories = $derived([...new Set(enabledItems.map((i) => i.category).filter(Boolean))]);
	const categories = $derived(editMode ? allCategories : enabledCategories);
	const categoryCounts = $derived.by(() => {
		const counts: Record<string, number> = {};
		const source = editMode ? items : enabledItems;
		for (const item of source) {
			counts[item.category] = (counts[item.category] || 0) + 1;
		}
		return counts;
	});
	const sourceItems = $derived(editMode ? items : enabledItems);
	const displayItems = $derived(activeTab === "all" ? sourceItems : sourceItems.filter((i) => i.category === activeTab));
	const groupedItems = $derived.by(() => {
		const groups: Record<string, CollectionItem[]> = {};
		if (activeTab === "all" && !editMode) {
			for (const cat of enabledCategories) {
				groups[cat] = enabledItems.filter((i) => i.category === cat);
			}
		}
		return groups;
	});

	// 进入/退出编辑模式
	function handleModeChange(e: CustomEvent) {
		editMode = e.detail.editing;
		if (editMode) {
			editingIndex = -1;
			activeTab = "all";
		}
	}

	// 取消编辑：回滚到原始数据
	function handleCancel() {
		items = deepClone(originalItems);
		drafts.clearDrafts();
		editingIndex = -1;
		activeTab = "all";
	}

	// 切换 Tab
	function switchTab(tab: string) {
		activeTab = tab;
	}

	// 移动卡片（在 displayItems 的可见顺序中上移/下移，确保分类过滤时也能正确排序）
	function moveUp(index: number) {
		if (index <= 0) return;
		const item = displayItems[index];
		const prevItem = displayItems[index - 1];
		const globalIdx = items.indexOf(item);
		const prevGlobalIdx = items.indexOf(prevItem);
		if (globalIdx < 0 || prevGlobalIdx < 0) return;
		const arr = [...items];
		[arr[prevGlobalIdx], arr[globalIdx]] = [arr[globalIdx], arr[prevGlobalIdx]];
		items = arr;
		if (editingIndex === globalIdx) editingIndex = prevGlobalIdx;
		else if (editingIndex === prevGlobalIdx) editingIndex = globalIdx;
	}

	function moveDown(index: number) {
		if (index >= displayItems.length - 1) return;
		const item = displayItems[index];
		const nextItem = displayItems[index + 1];
		const globalIdx = items.indexOf(item);
		const nextGlobalIdx = items.indexOf(nextItem);
		if (globalIdx < 0 || nextGlobalIdx < 0) return;
		const arr = [...items];
		[arr[globalIdx], arr[nextGlobalIdx]] = [arr[nextGlobalIdx], arr[globalIdx]];
		items = arr;
		if (editingIndex === globalIdx) editingIndex = nextGlobalIdx;
		else if (editingIndex === nextGlobalIdx) editingIndex = globalIdx;
	}

	// 开始内联编辑
	function startEdit(index: number) {
		const item = displayItems[index];
		editingIndex = items.indexOf(item);
	}

	function finishEdit(index: number) {
		const item = items[index];
		if (!item.name.trim()) {
			showToast("名称不能为空", "warning");
			return;
		}
		if (!item.url.trim()) {
			showToast("链接不能为空", "warning");
			return;
		}
		if (!item.icon && item.url) {
			try {
				const hostname = new URL(item.url).hostname;
				items[index] = { ...item, icon: `https://favicon.im/${hostname}` };
				items = [...items];
			} catch {
			}
		}
		editingIndex = -1;
		showToast("已修改，记得点击保存", "info");
	}

	// 取消单卡片编辑
	function cancelItemEdit(index: number) {
		const item = items[index];
		if (item._draft && !item.name.trim()) {
			// 新增的空草稿，直接删除
			items = items.filter((_, i) => i !== index);
		} else {
			// 回滚该卡片到原始状态
			const orig = originalItems.find(
				(o) => (o.id || o.url) === (item.id || item.url) && !item._draft,
			);
			if (orig) {
				items[index] = deepClone(orig);
				items = [...items];
			}
		}
		editingIndex = -1;
	}

	function deleteItem(index: number) {
		const item = displayItems[index];
		const globalIdx = items.indexOf(item);
		if (!confirm(`确定要删除「${item.name || "该条目"}」吗？`)) return;
		items = items.filter((_, i) => i !== globalIdx);
		if (editingIndex === globalIdx) editingIndex = -1;
		else if (editingIndex > globalIdx) editingIndex--;
		showToast("已删除，记得点击保存", "info");
	}

	function handleAdd() {
		const defaultCategory = categories[0] || "";
		const newItem: CollectionItem = {
			id: genId("col"),
			name: "",
			url: "",
			description: "",
			category: defaultCategory,
			icon: "",
			enabled: true,
			_draft: true,
		};
		items = [...items, newItem];
		editingIndex = items.length - 1;
		activeTab = "all";
	}

	function handleSaveDraft() {
		const cleanData = items.map(({ _draft, ...rest }) => ({
			...rest,
			id: rest.id || genId("col"),
			icon: rest.icon || (rest.url ? `https://favicon.im/${new URL(rest.url).hostname}` : ""),
			enabled: rest.enabled !== false,
		}));
		items = cleanData;
		drafts.saveToDrafts();
	}

	async function handleSubmit() {
		if (editingIndex >= 0) {
			finishEdit(editingIndex);
			if (editingIndex >= 0) return;
		}
		saving = true;
		try {
			const cleanData = items.map(({ _draft, ...rest }) => ({
				...rest,
				id: rest.id || genId("col"),
				icon: rest.icon || (rest.url ? `https://favicon.im/${new URL(rest.url).hostname}` : ""),
				enabled: rest.enabled !== false,
			}));
			items = cleanData;
			await drafts.submitDrafts();
		} finally {
			saving = false;
		}
	}

	// 更新编辑中的卡片字段
	function updateField(index: number, field: keyof CollectionItem, value: string | boolean) {
		items[index] = { ...items[index], [field]: value } as CollectionItem;
		items = [...items];
	}

	// 获取 URL 的 hostname
	function getHostname(url: string) {
		try {
			return new URL(url).hostname;
		} catch {
			return url;
		}
	}

	// 判断图标是否为 http 链接
	function isHttpIcon(icon?: string) {
		return icon && icon.startsWith("http");
	}
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="collections-edit-toolbar">
	<EditToolbar
		pageKey="collections"
		pageName="收藏"
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

{#if !gistLoaded && items.length === 0}
	<div class="loading-hint">
		<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin mr-2"></iconify-icon>
		加载数据中...
	</div>
{/if}

<!-- Tab 分类导航 -->
{#if categories.length > 1}
	<div class="collections-tab-wrapper">
		<div class="collections-tab-pill">
			<button
				class="collections-tab-btn"
				class:collections-tab-btn-active={activeTab === "all"}
				class:collections-tab-btn-inactive={activeTab !== "all"}
				onclick={() => switchTab("all")}
			>
				全部
				<span class="collections-tab-badge">{sourceItems.length}</span>
			</button>
			{#each categories as cat}
				<button
					class="collections-tab-btn"
					class:collections-tab-btn-active={activeTab === cat}
					class:collections-tab-btn-inactive={activeTab !== cat}
					onclick={() => switchTab(cat)}
				>
					{cat}
					<span class="collections-tab-badge">{categoryCounts[cat] || 0}</span>
				</button>
			{/each}
		</div>
	</div>
{/if}

<!-- 编辑模式：Svelte 渲染的可编辑网格 -->
{#if editMode}
	<div class="edit-collections-grid" id="edit-collections-grid">
		{#each displayItems as item, i (i + "-" + (item.id || item.url))}
			{@const globalIdx = items.indexOf(item)}
			<div
				class="edit-collection-card"
				class:edit-collection-card-draft={item._draft}
				class:edit-collection-card-editing={editingIndex === globalIdx}
				class:edit-collection-card-disabled={item.enabled === false}
			>
				<!-- 操作按钮行（非编辑态显示，hover 可见） -->
				{#if editingIndex !== globalIdx}
					<div class="card-action-row">
						{#if i > 0}
							<button class="action-btn action-move" onclick={() => moveUp(i)} title="上移">
								<iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
							</button>
						{/if}
						{#if i < displayItems.length - 1}
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
						<!-- 分类标签 -->
						{#if item.category}
							<span class="card-category-badge">{item.category}</span>
						{/if}
						<!-- 禁用标记 -->
						{#if item.enabled === false}
							<span class="card-disabled-badge">已禁用</span>
						{/if}
						<div class="card-icon-wrap">
							{#if isHttpIcon(item.icon)}
								<img
									src={item.icon}
									alt={item.name}
									class="card-icon-img"
									loading="lazy"
									onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0')}
								/>
							{:else if item.icon}
								<iconify-icon icon={item.icon} class="card-icon-iconify"></iconify-icon>
							{:else}
								<div class="card-icon-placeholder">
									<iconify-icon icon="material-symbols:link-rounded"></iconify-icon>
								</div>
							{/if}
						</div>
						<div class="card-info">
							<h3 class="card-title">{item.name || "（未命名）"}</h3>
							<p class="card-desc">{item.description || "暂无描述"}</p>
							<p class="card-url">{getHostname(item.url)}</p>
						</div>
					</div>
				{:else}
					<!-- 卡片编辑态：内联表单 -->
					<div class="card-edit-form">
						<div class="edit-form-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑收藏</span>
							{#if item._draft}
								<span class="draft-badge">新增</span>
							{/if}
						</div>
						<div class="form-group">
							<label>名称</label>
							<input
								type="text"
								value={item.name}
								oninput={(e) => updateField(globalIdx, "name", (e.target as HTMLInputElement).value)}
								placeholder="站点名称"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>链接 (URL)</label>
							<input
								type="text"
								value={item.url}
								oninput={(e) => updateField(globalIdx, "url", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>图标 URL</label>
							<input
								type="text"
								value={item.icon || ""}
								oninput={(e) => updateField(globalIdx, "icon", (e.target as HTMLInputElement).value)}
								placeholder="https://example.com/favicon.png 或 iconify 图标名"
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>描述</label>
							<textarea
								value={item.description}
								oninput={(e) => updateField(globalIdx, "description", (e.target as HTMLTextAreaElement).value)}
								placeholder="站点描述"
								class="form-textarea"
								rows={2}
							></textarea>
						</div>
						<div class="form-group">
							<label>分类</label>
							<input
								type="text"
								value={item.category}
								oninput={(e) => updateField(globalIdx, "category", (e.target as HTMLInputElement).value)}
								placeholder="分类名称"
								list={`category-list-${globalIdx}`}
								class="form-input"
							/>
							<datalist id={`category-list-${globalIdx}`}>
								{#each allCategories as cat}
									<option value={cat}>{cat}</option>
								{/each}
							</datalist>
						</div>
						<div class="form-group form-group-checkbox">
							<label class="checkbox-label">
								<input
									type="checkbox"
									checked={item.enabled !== false}
									onchange={(e) => updateField(globalIdx, "enabled", (e.target as HTMLInputElement).checked)}
									class="form-checkbox"
								/>
								<span>启用</span>
							</label>
						</div>
						<div class="form-actions">
							<button class="form-btn form-btn-cancel" onclick={() => cancelItemEdit(globalIdx)}>取消</button>
							<button class="form-btn form-btn-save" onclick={() => finishEdit(globalIdx)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if items.length === 0}
			<div class="empty-state">
				<iconify-icon icon="material-symbols:bookmark-outline-rounded" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无收藏，点击"添加"开始添加</p>
			</div>
		{/if}
	</div>
{:else}
	<!-- 非编辑模式：渲染卡片为链接 -->
	{#if enabledItems.length > 0}
		<div>
			{#if activeTab === "all"}
				{#each enabledCategories as cat}
					{#if groupedItems[cat]?.length}
						<div class="tools-category-group mt-8 first:mt-0">
							<div class="category-header">
								<div class="category-title-wrap">
									<iconify-icon icon="material-symbols:label-outline" class="category-label-icon"></iconify-icon>
									<span class="category-title">{cat}</span>
								</div>
								<span class="category-count">{groupedItems[cat].length}</span>
								<div class="category-divider" />
							</div>
							<div class="tools-card-grid">
								{#each groupedItems[cat] as api, index (api.id || api.url)}
									<a
										href={api.url}
										target="_blank"
										rel="noopener noreferrer"
										class="tools-card group"
										style={`animation-delay: ${index * 60}ms`}
									>
										<div class="tools-card-jump-icon">
											<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M7 17L17 7" />
												<path d="M7 7h10v10" />
											</svg>
										</div>
										<div class="tools-card-icon-row">
											{#if isHttpIcon(api.icon)}
												<img src={api.icon} alt={api.name} loading="lazy" decoding="async" class="tools-card-icon-img" />
											{:else if api.icon}
												<iconify-icon icon={api.icon} class="tools-card-iconify group-hover:text-black dark:group-hover:text-white transition-colors duration-300"></iconify-icon>
											{:else}
												<iconify-icon icon="material-symbols:link-rounded" class="tools-card-iconify group-hover:text-black dark:group-hover:text-white transition-colors duration-300"></iconify-icon>
											{/if}
											<h3 class="tools-card-name group-hover:translate-x-1 transition-transform duration-300">{api.name}</h3>
										</div>
										<p class="tools-card-desc">{api.description}</p>
										<div class="tools-card-footer">
											<span class="tools-card-hostname">{getHostname(api.url)}</span>
										</div>
									</a>
								{/each}
							</div>
						</div>
					{/if}
				{/each}
			{:else}
				<div class="tools-card-grid mt-6">
					{#each displayItems as api, index (api.id || api.url)}
						<a
							href={api.url}
							target="_blank"
							rel="noopener noreferrer"
							class="tools-card group"
							style={`animation-delay: ${index * 60}ms`}
						>
							<div class="tools-card-jump-icon">
								<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M7 17L17 7" />
									<path d="M7 7h10v10" />
								</svg>
							</div>
							<div class="tools-card-icon-row">
								{#if isHttpIcon(api.icon)}
									<img src={api.icon} alt={api.name} loading="lazy" decoding="async" class="tools-card-icon-img" />
								{:else if api.icon}
									<iconify-icon icon={api.icon} class="tools-card-iconify group-hover:text-black dark:group-hover:text-white transition-colors duration-300"></iconify-icon>
								{:else}
									<iconify-icon icon="material-symbols:link-rounded" class="tools-card-iconify group-hover:text-black dark:group-hover:text-white transition-colors duration-300"></iconify-icon>
								{/if}
								<h3 class="tools-card-name group-hover:translate-x-1 transition-transform duration-300">{api.name}</h3>
							</div>
							<p class="tools-card-desc">{api.description}</p>
							<div class="tools-card-footer">
								<span class="tools-card-hostname">{getHostname(api.url)}</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<div class="empty-state">
			<iconify-icon icon="material-symbols:bookmark-outline-rounded" class="text-5xl mb-4 opacity-40"></iconify-icon>
			<p>暂无收藏</p>
		</div>
	{/if}
{/if}

<style>
	.collections-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.loading-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		color: var(--content-meta, #737373);
		font-size: 14px;
	}

	/* Tab 分类导航 */
	.collections-tab-wrapper {
		margin-bottom: 16px;
	}
	.collections-tab-pill {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		padding: 4px;
		border-radius: 12px;
		background: var(--bg-secondary, #f3f4f6);
		width: fit-content;
	}
	:global(.dark) .collections-tab-pill {
		background: rgba(255, 255, 255, 0.05);
	}
	.collections-tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.15s;
		background: transparent;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .collections-tab-btn {
		color: #9ca3af;
	}
	.collections-tab-btn:hover {
		color: var(--text-color, #1f2937);
		background: var(--card-bg, white);
	}
	:global(.dark) .collections-tab-btn:hover {
		color: #e5e7eb;
		background: rgba(255, 255, 255, 0.08);
	}
	.collections-tab-btn-active {
		background: var(--card-bg, white) !important;
		color: var(--text-color, #1f2937) !important;
		font-weight: 600;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
	}
	:global(.dark) .collections-tab-btn-active {
		background: rgba(255, 255, 255, 0.12) !important;
		color: #f0f0f0 !important;
	}
	.collections-tab-badge {
		padding: 1px 7px;
		border-radius: 999px;
		font-size: 11px;
		background: var(--border, #e5e7eb);
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .collections-tab-badge {
		background: rgba(255, 255, 255, 0.1);
		color: #9ca3af;
	}
	.collections-tab-btn-active .collections-tab-badge {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}

	/* ========== 编辑模式网格 ========== */
	.edit-collections-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	.edit-collection-card {
		position: relative;
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .edit-collection-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.edit-collection-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
	}
	.edit-collection-card-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-collection-card-editing {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.edit-collection-card-disabled {
		opacity: 0.55;
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
	.edit-collection-card:hover .card-action-row {
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
		background: rgba(100, 116, 139, 0.85);
	}
	.action-move:hover {
		background: rgba(71, 85, 105, 0.95);
		transform: scale(1.1);
	}
	.action-edit {
		background: rgba(59, 130, 246, 0.85);
	}
	.action-edit:hover {
		background: rgba(37, 99, 235, 0.95);
		transform: scale(1.1);
	}
	.action-delete {
		background: rgba(239, 68, 68, 0.85);
	}
	.action-delete:hover {
		background: rgba(220, 38, 38, 0.95);
		transform: scale(1.1);
	}

	/* 卡片展示态 */
	.card-display {
		padding: 20px;
		cursor: default;
	}
	.card-category-badge {
		display: inline-block;
		padding: 2px 10px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 600;
		margin-bottom: 12px;
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.card-disabled-badge {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 500;
		margin-bottom: 12px;
		margin-left: 6px;
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}
	.card-icon-wrap {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		overflow: hidden;
		margin-bottom: 12px;
		background: var(--btn-regular-bg, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	:global(.dark) .card-icon-wrap {
		background: rgba(255, 255, 255, 0.05);
	}
	.card-icon-img {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.card-icon-iconify {
		font-size: 24px;
		color: var(--text-secondary, #6b7280);
	}
	:global(.dark) .card-icon-iconify {
		color: #9ca3af;
	}
	.card-icon-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 22px;
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
	.form-group-checkbox {
		margin-bottom: 16px;
	}
	.checkbox-label {
		display: flex !important;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-weight: 500 !important;
	}
	.form-checkbox {
		width: 16px;
		height: 16px;
		accent-color: hsl(var(--theme-hue, 165), 70%, 50%);
		cursor: pointer;
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

	/* ========== 非编辑模式：工具卡片 ========== */
	.tools-category-group {
		margin-top: 32px;
	}
	.tools-category-group:first-child {
		margin-top: 0;
	}
	.category-header {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 20px;
	}
	.category-title-wrap {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.category-label-icon {
		font-size: 18px;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .category-label-icon {
		color: #f0f0f0;
	}
	.category-title {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
	}
	:global(.dark) .category-title {
		color: #f0f0f0;
	}
	.category-count {
		font-size: 12px;
		color: var(--content-meta, #9ca3af);
	}
	.category-divider {
		flex: 1;
		height: 2px;
		background: var(--border, rgba(0, 0, 0, 0.08));
	}
	:global(.dark) .category-divider {
		background: rgba(255, 255, 255, 0.08);
	}

	.tools-card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px;
	}

	.tools-card {
		position: relative;
		display: block;
		padding: 20px;
		border-radius: 14px;
		background: var(--card-bg, rgba(255, 255, 255, 0.6));
		border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		transition: all 0.3s;
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		overflow: hidden;
	}
	:global(.dark) .tools-card {
		background: rgba(23, 23, 23, 0.6);
		border-color: rgba(255, 255, 255, 0.06);
	}
	.tools-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
	}

	.tools-card-jump-icon {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 24px;
		height: 24px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		opacity: 0;
		transform: translate(-4px, 4px);
		transition: all 0.3s;
	}
	.tools-card:hover .tools-card-jump-icon {
		opacity: 1;
		transform: translate(0, 0);
	}

	.tools-card-icon-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
	}
	.tools-card-icon-img {
		width: 24px;
		height: 24px;
		border-radius: 4px;
		object-fit: contain;
		flex-shrink: 0;
	}
	.tools-card-iconify {
		font-size: 24px;
		color: var(--text-secondary, #6b7280);
		flex-shrink: 0;
	}
	:global(.dark) .tools-card-iconify {
		color: #9ca3af;
	}
	.tools-card-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin: 0;
	}
	:global(.dark) .tools-card-name {
		color: #f0f0f0;
	}
	.tools-card-desc {
		margin: 0 0 8px;
		font-size: 13px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.6;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.dark) .tools-card-desc {
		color: #9ca3af;
	}
	.tools-card-footer {
		display: flex;
		align-items: center;
	}
	.tools-card-hostname {
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
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
