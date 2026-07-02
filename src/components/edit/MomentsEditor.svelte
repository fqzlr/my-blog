<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import {
	getRepoFile,
	getRepoFileMeta,
	updateRepoFile,
	createRepoFile,
	deleteRepoFile,
	listRepoFiles,
	showToast,
	genId,
	deepClone,
	ensureIconify,
	saveDraft,
	getDraftsByPage,
	clearDraftsByPage,
	registerSubmitHandler,
	type DraftChange,
} from "@/utils/editMode";

interface MomentItem {
	id: string;
	content: string;
	published: string; // ISO date
	images: string[];
	tags: string[];
	location?: string;
	pinned?: boolean;
	author?: string;
	avatar?: string;
	_draft?: boolean;
}

const MOMENTS_DIR = "src/content/moments"; // 仓库中的说说目录
const DEFAULT_AVATAR = "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640";
const DEFAULT_AUTHOR = "fqzlr";
const PAGE_KEY = "moments";
const PAGE_NAME = "说说";

let editMode = $state(false);
let saving = $state(false);
let moments = $state<MomentItem[]>([]);
let originalMoments = $state<MomentItem[]>([]);
let editingIndex = $state(-1);
let dataLoaded = $state(false);

let {
	initialItems = [],
}: {
	initialItems?: MomentItem[];
} = $props();

// ========== Frontmatter 解析/序列化 ==========
function parseFrontmatter(raw: string): {
	data: Record<string, any>;
	body: string;
} {
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!match) return { data: {}, body: raw.trim() };
	const yamlStr = match[1];
	const body = match[2].trim();
	const data: Record<string, any> = {};
	for (const line of yamlStr.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		let val: any = line.slice(colonIdx + 1).trim();
		if (val === "") val = "";
		else if (val === "true") val = true;
		else if (val === "false") val = false;
		else if (!isNaN(Number(val)) && val !== "") val = Number(val);
		else if (val.startsWith("[") && val.endsWith("]")) {
			const inner = val.slice(1, -1).trim();
			val = inner
				? inner
						.split(",")
						.map((s: string) => s.trim().replace(/^["']|["']$/g, ""))
				: [];
		} else {
			val = val.replace(/^["']|["']$/g, "");
		}
		data[key] = val;
	}
	return { data, body };
}

function serializeToFrontmatter(m: MomentItem): string {
	const published = m.published || new Date().toISOString();
	const images =
		(m.images || []).length > 0
			? `[${m.images.map((i) => `"${i}"`).join(", ")}]`
			: "[]";
	const tags =
		(m.tags || []).length > 0
			? `[${m.tags.map((t) => `"${t}"`).join(", ")}]`
			: "[]";
	const lines = [
		"---",
		`published: ${published}`,
		`author: ${m.author || DEFAULT_AUTHOR}`,
		`avatar: ${m.avatar || DEFAULT_AVATAR}`,
		`tags: ${tags}`,
		`location: ${m.location ? `"${m.location}"` : '""'}`,
		`images: ${images}`,
		`pinned: ${m.pinned ? "true" : "false"}`,
		"---",
		"",
		m.content || "",
		"",
	];
	return lines.join("\n");
}

function fileNameFromMoment(m: MomentItem): string {
	if (m.id && !m._draft) return m.id;
	const d = new Date(m.published);
	const base = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
	return `${base}-${genId("wx").slice(-6)}`;
}

// ========== 草稿系统 ==========
function saveToDrafts() {
	const data = JSON.stringify(moments, null, 2);
	const original = JSON.stringify(originalMoments, null, 2);
	if (data === original && getDraftsByPage(PAGE_KEY).length === 0) {
		showToast("没有需要暂存的更改", "info");
		return;
	}
	clearDraftsByPage(PAGE_KEY);
	saveDraft({
		pageKey: PAGE_KEY,
		pageName: PAGE_NAME,
		description: "更新说说",
		operation: "update",
		payload: { type: "moments-md", data: JSON.parse(data) },
	});
	showToast("已暂存到本地", "success");
}

function restoreFromDrafts(): boolean {
	const drafts = getDraftsByPage(PAGE_KEY);
	if (drafts.length === 0) return false;
	const latest = drafts[drafts.length - 1];
	if (latest.payload?.type === "moments-md" && latest.payload.data) {
		moments = latest.payload.data as MomentItem[];
		showToast("已恢复暂存数据", "info");
		return true;
	}
	return false;
}

function hasLocalChanges(): boolean {
	return (
		getDraftsByPage(PAGE_KEY).length > 0 ||
		JSON.stringify(moments) !== JSON.stringify(originalMoments)
	);
}

let hasChanges = $derived(hasLocalChanges());

// 注册批量提交处理器
registerSubmitHandler(PAGE_KEY, async (draft: DraftChange) => {
	if (draft.payload?.type === "moments-md" && draft.payload.data) {
		await submitMoments(draft.payload.data as MomentItem[]);
		return true;
	}
	return false;
});

onMount(() => {
	ensureIconify();
	if (initialItems.length > 0) {
		// 使用页面直接传入的初始数据
		moments = initialItems.map((item) => ({ ...item }));
		originalMoments = deepClone(moments);
		dataLoaded = true;
	}
	loadMomentsData();
});

// ========== 从 GitHub API 加载说说数据（读取 md 文件） ==========
async function loadMomentsData() {
	// 先恢复本地草稿（如果有）
	const restored = restoreFromDrafts();
	if (restored && moments.length > 0) {
		dataLoaded = true;
		return;
	}
	// 没有草稿，通过 GitHub Contents API 加载
	console.log("[MomentsEditor] Fetching from GitHub API:", MOMENTS_DIR);
	try {
		const files = await listRepoFiles(MOMENTS_DIR);
		const mdFiles = files.filter((f) => f.name.endsWith(".md"));
		console.log(`[MomentsEditor] Found ${mdFiles.length} moment files`);

		const repoItems: MomentItem[] = [];
		for (const file of mdFiles) {
			const result = await getRepoFile(file.path);
			if (!result) continue;
			const { data, body } = parseFrontmatter(result.content);
			const id = file.name.replace(/\.md$/, "");
			repoItems.push({
				id,
				content: body || "",
				published: data.published
					? new Date(data.published).toISOString()
					: new Date().toISOString(),
				images: Array.isArray(data.images) ? data.images : [],
				tags: Array.isArray(data.tags) ? data.tags : [],
				location: data.location || undefined,
				pinned: data.pinned === true,
				author: data.author || DEFAULT_AUTHOR,
				avatar: data.avatar || DEFAULT_AVATAR,
			});
		}

		if (initialItems.length > 0 && moments.length > 0) {
			// 有初始数据：合并仓库数据（用 id 匹配覆盖）
			const repoMap = new Map(repoItems.map((m) => [m.id, m]));
			for (let i = 0; i < moments.length; i++) {
				const repoItem = repoMap.get(moments[i].id);
				if (repoItem) {
					moments[i] = { ...repoItem };
				}
			}
			// 添加仓库中有但初始数据没有的条目
			const localIds = new Set(moments.map((m) => m.id));
			for (const repoItem of repoItems) {
				if (!localIds.has(repoItem.id)) {
					moments = [...moments, repoItem];
				}
			}
		} else {
			// 没有初始数据：直接使用仓库数据
			moments = repoItems;
		}

		// 按发布时间降序排列，置顶优先
		moments = [...moments].sort((a, b) => {
			if (a.pinned && !b.pinned) return -1;
			if (!a.pinned && b.pinned) return 1;
			return new Date(b.published).getTime() - new Date(a.published).getTime();
		});
		originalMoments = deepClone(moments);
	} catch (e) {
		console.error("[MomentsEditor] Failed to load from GitHub:", e);
	}
	dataLoaded = true;
}

// ========== 时间格式化 ==========
function formatTime(iso: string): string {
	try {
		return new Date(iso).toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return iso;
	}
}

// ========== 编辑模式切换 ==========
function handleModeChange(e: CustomEvent) {
	editMode = e.detail.editing;
	if (editMode) {
		hideSSRFeed();
		editingIndex = -1;
	} else {
		showSSRFeed();
	}
}

function hideSSRFeed() {
	const feed = document.getElementById("moments-feed");
	if (feed) feed.style.display = "none";
}

function showSSRFeed() {
	const feed = document.getElementById("moments-feed");
	if (feed) feed.style.display = "";
}

// ========== 取消编辑：回滚到原始数据 ==========
function handleCancel() {
	moments = deepClone(originalMoments);
	clearDraftsByPage(PAGE_KEY);
	editingIndex = -1;
	showSSRFeed();
}

// ========== 开始内联编辑 ==========
function startEdit(index: number) {
	editingIndex = index;
}

// ========== 完成内联编辑 ==========
function finishEdit(index: number) {
	const m = moments[index];
	if (!m.content.trim()) {
		showToast("内容不能为空", "warning");
		return;
	}
	moments[index] = {
		...m,
		content: m.content.trim(),
		images: (m.images || []).filter((u) => u.trim()),
		tags: (m.tags || []).filter((t) => t.trim()),
		author: m.author?.trim() || DEFAULT_AUTHOR,
		avatar: m.avatar?.trim() || DEFAULT_AVATAR,
	};
	moments = [...moments];
	editingIndex = -1;
	showToast("已修改，记得点击保存", "info");
}

// ========== 取消单条编辑 ==========
function cancelItemEdit(index: number) {
	const m = moments[index];
	if (m._draft) {
		// 新增的草稿，直接删除
		moments = moments.filter((_, i) => i !== index);
	} else {
		// 回滚到原始状态
		const orig = originalMoments.find((o) => o.id === m.id);
		if (orig) {
			moments[index] = deepClone(orig);
			moments = [...moments];
		}
	}
	editingIndex = -1;
}

// ========== 删除说说 ==========
function deleteItem(index: number) {
	const m = moments[index];
	const preview = m.content.slice(0, 30) + (m.content.length > 30 ? "..." : "");
	if (!confirm(`确定要删除这条说说吗？\n\n"${preview}"`)) return;
	moments = moments.filter((_, i) => i !== index);
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已删除，记得点击保存", "info");
}

// ========== 添加新说说 ==========
function handleAdd() {
	const newMoment: MomentItem = {
		id: genId("wx"),
		content: "",
		published: new Date().toISOString(),
		images: [],
		tags: [],
		pinned: false,
		author: DEFAULT_AUTHOR,
		avatar: DEFAULT_AVATAR,
		_draft: true,
	};
	const insertIdx = moments.findIndex((m) => !m.pinned);
	if (insertIdx === -1) {
		moments = [...moments, newMoment];
	} else {
		const arr = [...moments];
		arr.splice(insertIdx, 0, newMoment);
		moments = arr;
	}
	editingIndex = insertIdx === -1 ? moments.length - 1 : insertIdx;
}

// ========== 更新字段 ==========
function updateField(index: number, field: keyof MomentItem, value: any) {
	moments[index] = { ...moments[index], [field]: value };
	moments = [...moments];
}

// 图片 URL 解析（换行或逗号分隔）
function updateImages(index: number, raw: string) {
	const urls = raw
		.split(/[\n,;]/)
		.map((s) => s.trim())
		.filter((s) => s);
	moments[index] = { ...moments[index], images: urls.slice(0, 9) };
	moments = [...moments];
}

function getImagesRaw(m: MomentItem): string {
	return (m.images || []).join("\n");
}

// 标签解析（逗号分隔）
function updateTags(index: number, raw: string) {
	const tags = raw
		.split(/[,，]/)
		.map((s) => s.trim().replace(/^#/, ""))
		.filter((s) => s);
	moments[index] = { ...moments[index], tags };
	moments = [...moments];
}

function getTagsRaw(m: MomentItem): string {
	return (m.tags || []).join(", ");
}

// ========== 切换置顶 ==========
function togglePinned(index: number) {
	const targetId = moments[index].id;
	const arr = moments.map((m, i) =>
		i === index ? { ...m, pinned: !m.pinned } : m,
	);
	arr.sort((a, b) => {
		if (a.pinned && !b.pinned) return -1;
		if (!a.pinned && b.pinned) return 1;
		return new Date(b.published).getTime() - new Date(a.published).getTime();
	});
	moments = arr;
	editingIndex = arr.findIndex((m) => m.id === targetId);
}

function handleSaveDraft() {
	const cleanData: MomentItem[] = moments.map(({ _draft, ...rest }) => ({
		id: rest.id || genId("wx"),
		content: rest.content,
		published: rest.published,
		images: (rest.images || []).filter((u) => u.trim()),
		tags: (rest.tags || []).filter((t) => t.trim()),
		location: rest.location?.trim() || undefined,
		pinned: rest.pinned || false,
		author: rest.author?.trim() || DEFAULT_AUTHOR,
		avatar: rest.avatar?.trim() || DEFAULT_AVATAR,
	}));
	moments = cleanData;
	saveToDrafts();
}

/** 对比两组数据，生成变更摘要 */
function diffMoments(remote: MomentItem[], local: MomentItem[]) {
	const added: string[] = [];
	const modified: string[] = [];
	const deleted: string[] = [];
	const remoteMap = new Map(remote.map((m) => [m.id, m]));
	const localMap = new Map(local.map((m) => [m.id, m]));
	for (const m of local) {
		if (!remoteMap.has(m.id)) added.push(m.id);
		else if (JSON.stringify(remoteMap.get(m.id)) !== JSON.stringify(m))
			modified.push(m.id);
	}
	for (const m of remote) {
		if (!localMap.has(m.id)) deleted.push(m.id);
	}
	return { added, modified, deleted };
}

/** 核心提交：将本地数据同步到 GitHub（增删改 md 文件） */
async function submitMoments(dataToSubmit: MomentItem[]) {
	const branch =
		typeof window !== "undefined" ? window.__DEPLOY_BRANCH__ : undefined;
	console.log("[MomentsEditor] submitMoments, branch:", branch);

	// 清洗数据
	const cleanData: MomentItem[] = dataToSubmit.map(({ _draft, ...rest }) => ({
		id: rest.id || fileNameFromMoment(rest),
		content: rest.content,
		published: rest.published,
		images: (rest.images || []).filter((u) => u.trim()),
		tags: (rest.tags || []).filter((t) => t.trim()),
		location: rest.location?.trim() || undefined,
		pinned: rest.pinned || false,
		author: rest.author?.trim() || DEFAULT_AUTHOR,
		avatar: rest.avatar?.trim() || DEFAULT_AVATAR,
	}));

	// 从 GitHub 获取远端当前数据
	let remoteData: MomentItem[] = [];
	try {
		const files = await listRepoFiles(MOMENTS_DIR);
		const mdFiles = files.filter((f) => f.name.endsWith(".md"));
		for (const file of mdFiles) {
			const result = await getRepoFile(file.path);
			if (!result) continue;
			const { data, body } = parseFrontmatter(result.content);
			const id = file.name.replace(/\.md$/, "");
			remoteData.push({
				id,
				content: body || "",
				published: data.published
					? new Date(data.published).toISOString()
					: new Date().toISOString(),
				images: Array.isArray(data.images) ? data.images : [],
				tags: Array.isArray(data.tags) ? data.tags : [],
				location: data.location || undefined,
				pinned: data.pinned === true,
				author: data.author || DEFAULT_AUTHOR,
				avatar: data.avatar || DEFAULT_AVATAR,
			});
		}
	} catch {
		/* 目录可能不存在 */
	}

	const diff = diffMoments(remoteData, cleanData);
	const totalChanges =
		diff.added.length + diff.modified.length + diff.deleted.length;

	if (totalChanges === 0) {
		showToast("没有检测到任何更改，无需提交", "info");
		return;
	}

	// 生成提交信息
	const parts: string[] = [];
	if (diff.added.length) parts.push(`新增${diff.added.length}条`);
	if (diff.modified.length) parts.push(`修改${diff.modified.length}条`);
	if (diff.deleted.length) parts.push(`删除${diff.deleted.length}条`);
	const commitMsg = `feat(moments): ${parts.join("，")} (共${cleanData.length}条)`;

	console.log(`[MomentsEditor] Diff:`, diff, `Commit:`, commitMsg);

	let successCount = 0;

	// 1. 新增 & 修改：创建/更新 md 文件
	const toUpsert = cleanData.filter(
		(m) => diff.added.includes(m.id) || diff.modified.includes(m.id),
	);
	for (const m of toUpsert) {
		const fileName = `${m.id}.md`;
		const filePath = `${MOMENTS_DIR}/${fileName}`;
		const mdContent = serializeToFrontmatter(m);
		const existing = await getRepoFileMeta(filePath);
		let ok: boolean;
		if (existing) {
			ok = await updateRepoFile(filePath, mdContent, existing.sha, commitMsg);
		} else {
			ok = await createRepoFile(filePath, mdContent, commitMsg);
		}
		if (ok) successCount++;
	}

	// 2. 删除：删除 md 文件
	for (const id of diff.deleted) {
		const fileName = `${id}.md`;
		const filePath = `${MOMENTS_DIR}/${fileName}`;
		const existing = await getRepoFileMeta(filePath);
		if (existing) {
			const ok = await deleteRepoFile(filePath, existing.sha, commitMsg);
			if (ok) successCount++;
		}
	}

	if (successCount > 0) {
		showToast(`成功提交: ${parts.join("，")}`, "success");
		clearDraftsByPage(PAGE_KEY);
		setTimeout(() => window.location.reload(), 1500);
	} else {
		showToast("提交失败，请重试", "error");
	}
}

async function handleSubmit() {
	if (editingIndex >= 0) {
		finishEdit(editingIndex);
		if (editingIndex >= 0) return;
	}
	saving = true;
	try {
		await submitMoments(moments);
		originalMoments = deepClone(moments);
	} catch (e: any) {
		showToast(`提交失败: ${e.message}`, "error");
		console.error("[MomentsEditor] handleSubmit error:", e);
	} finally {
		saving = false;
	}
}
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="moments-edit-toolbar">
	<EditToolbar
		pageKey="moments"
		pageName="说说"
		mountTo=".page-header-toolbar-slot"
		showAddButton={true}
		{saving}
		{hasChanges}
		on:modeChange={(e) => handleModeChange(e)}
		on:add={() => handleAdd()}
		on:saveDraft={() => handleSaveDraft()}
		on:submit={() => handleSubmit()}
		on:cancel={() => handleCancel()}
	/>
</div>

<!-- 编辑模式：Svelte 渲染的可编辑列表 -->
{#if editMode}
	<div class="edit-moments-feed" id="edit-moments-feed">
		{#each moments as moment, i (i + "-" + moment.id)}
			<div
				class="edit-wx-feed-item"
				class:edit-wx-feed-item-draft={moment._draft}
				class:edit-wx-feed-item-editing={editingIndex === i}
				class:edit-wx-feed-item-pinned={moment.pinned}
			>
				<!-- 展示态 -->
				{#if editingIndex !== i}
					<!-- 操作按钮（悬停显示） -->
					<div class="wx-card-actions">
						<button class="wx-action-btn wx-action-edit" onclick={() => startEdit(i)} title="编辑">
							<iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
						</button>
						<button class="wx-action-btn wx-action-delete" onclick={() => deleteItem(i)} title="删除">
							<iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
						</button>
					</div>

					<!-- 卡片内容 -->
					<div class="wx-feed-header">
						<img class="wx-avatar" src={moment.avatar || DEFAULT_AVATAR} alt="avatar" />
						<div class="wx-feed-user">
							<div class="wx-username">
								{moment.author || DEFAULT_AUTHOR}
								{#if moment.pinned}
									<span class="wx-pinned-badge">
										<iconify-icon icon="material-symbols:push-pin"></iconify-icon>
										置顶
									</span>
								{/if}
							</div>
							<div class="wx-feed-time">
								{formatTime(moment.published)}
								{#if moment.location}
									<span class="wx-location-dot">·</span>
									{moment.location}
								{/if}
							</div>
						</div>
					</div>
					<div class="wx-feed-content">
						{#if moment.content}
							<p class="wx-content-text">{moment.content}</p>
						{/if}
						{#if moment.images && moment.images.length > 0}
							<div class="wx-imgs wx-imgs-{Math.min(moment.images.length, 9)}">
								{#each moment.images.slice(0, 9) as img}
									<div class="wx-img-wrap">
										<img src={img} alt="" class="wx-img" loading="lazy" />
									</div>
								{/each}
							</div>
						{/if}
						{#if moment.tags && moment.tags.length > 0}
							<div class="wx-feed-tags">
								{#each moment.tags as tag}
									<span class="wx-tag">#{tag}</span>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<!-- 编辑态：内联表单 -->
					<div class="wx-edit-form">
						<div class="wx-edit-header">
							<iconify-icon icon="material-symbols:edit-document-outline-rounded" class="text-lg"></iconify-icon>
							<span>编辑说说</span>
							{#if moment._draft}
								<span class="wx-draft-badge">新增</span>
							{/if}
						</div>

						<!-- 内容 -->
						<div class="wx-form-group">
							<label>内容</label>
							<textarea
								value={moment.content}
								oninput={(e) => updateField(i, "content", (e.target as HTMLTextAreaElement).value)}
								placeholder="此刻的想法..."
								class="wx-form-textarea"
								rows={4}
							></textarea>
						</div>

						<!-- 图片 URL -->
						<div class="wx-form-group">
							<label>图片 URL（每行一个，最多9张）</label>
							<textarea
								value={getImagesRaw(moment)}
								oninput={(e) => updateImages(i, (e.target as HTMLTextAreaElement).value)}
								placeholder="https://example.com/1.jpg&#10;https://example.com/2.jpg"
								class="wx-form-textarea"
								rows={3}
							></textarea>
						</div>

						<!-- 标签 -->
						<div class="wx-form-group">
							<label>标签（逗号分隔）</label>
							<input
								type="text"
								value={getTagsRaw(moment)}
								oninput={(e) => updateTags(i, (e.target as HTMLInputElement).value)}
								placeholder="日常, 美食, 旅行"
								class="wx-form-input"
							/>
						</div>

						<!-- 位置 -->
						<div class="wx-form-group">
							<label>位置（可选）</label>
							<input
								type="text"
								value={moment.location || ""}
								oninput={(e) => updateField(i, "location", (e.target as HTMLInputElement).value)}
								placeholder="北京·朝阳区"
								class="wx-form-input"
							/>
						</div>

						<!-- 作者和头像 -->
						<div class="wx-form-row">
							<div class="wx-form-group wx-form-group-half">
								<label>作者</label>
								<input
									type="text"
									value={moment.author || ""}
									oninput={(e) => updateField(i, "author", (e.target as HTMLInputElement).value)}
									placeholder={DEFAULT_AUTHOR}
									class="wx-form-input"
								/>
							</div>
							<div class="wx-form-group wx-form-group-half">
								<label>头像 URL</label>
								<input
									type="text"
									value={moment.avatar || ""}
									oninput={(e) => updateField(i, "avatar", (e.target as HTMLInputElement).value)}
									placeholder={DEFAULT_AVATAR}
									class="wx-form-input"
								/>
							</div>
						</div>

						<!-- 发布时间和置顶 -->
						<div class="wx-form-row">
							<div class="wx-form-group wx-form-group-half">
								<label>发布时间</label>
								<input
									type="datetime-local"
									value={moment.published ? new Date(moment.published).toISOString().slice(0, 16) : ""}
									onchange={(e) => {
										const v = (e.target as HTMLInputElement).value;
										updateField(i, "published", v ? new Date(v).toISOString() : new Date().toISOString());
									}}
									class="wx-form-input"
								/>
							</div>
							<div class="wx-form-group wx-form-group-half">
								<label class="wx-toggle-label">
									<input
										type="checkbox"
										checked={moment.pinned || false}
										onchange={() => togglePinned(i)}
										class="wx-toggle-checkbox"
									/>
									<span class="wx-toggle-switch"></span>
									置顶此条说说
								</label>
							</div>
						</div>

						<!-- 表单按钮 -->
						<div class="wx-form-actions">
							<button class="wx-form-btn wx-form-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
							<button class="wx-form-btn wx-form-btn-save" onclick={() => finishEdit(i)}>完成</button>
						</div>
					</div>
				{/if}
			</div>
		{/each}

		{#if moments.length === 0}
			<div class="wx-empty-state">
				<iconify-icon icon="material-symbols:chat-bubble-outline" class="text-4xl mb-2 opacity-40"></iconify-icon>
				<p>暂无说说，点击"添加"发布第一条</p>
			</div>
		{/if}
	</div>
{/if}

<!-- 非编辑模式下加载提示 -->
{#if !dataLoaded && !editMode}
	<div class="wx-loading-hint">
		<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin mr-2"></iconify-icon>
		加载数据中...
	</div>
{/if}

<style>
	.moments-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		margin-bottom: 4px;
	}

	.wx-loading-hint {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 12px;
		color: var(--content-meta, #737373);
		font-size: 14px;
	}

	/* ============================================
	 * 编辑模式：可编辑说说列表
	 * ============================================ */
	.edit-moments-feed {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 8px 0 24px;
	}

	.edit-wx-feed-item {
		position: relative;
	}
	.edit-wx-feed-item-draft {
		border-style: dashed;
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
	}
	.edit-wx-feed-item-editing {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
		box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.edit-wx-feed-item-pinned {
		border-left: 3px solid hsl(var(--theme-hue, 165), 70%, 50%);
	}

	/* 操作按钮行 */
	.wx-card-actions {
		position: absolute;
		top: 12px;
		right: 12px;
		display: flex;
		gap: 4px;
		z-index: 10;
		opacity: 1;
		transition: opacity 0.2s;
	}
	.edit-wx-feed-item:hover .wx-card-actions {
		opacity: 1;
	}
	.wx-action-btn {
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
	.wx-action-btn iconify-icon {
		display: flex;
	}
	.wx-action-edit {
		background: rgba(59, 130, 246, 0.85);
	}
	.wx-action-edit:hover {
		background: rgba(37, 99, 235, 0.95);
		transform: scale(1.1);
	}
	.wx-action-delete {
		background: rgba(239, 68, 68, 0.85);
	}
	.wx-action-delete:hover {
		background: rgba(220, 38, 38, 0.95);
		transform: scale(1.1);
	}

	/* ============================================
	 * wx- 前缀：朋友圈风格卡片（:global 用于动态注入的 DOM）
	 * ============================================ */
	:global(.wx-feed-item) {
		position: relative;
		margin-bottom: 20px;
		padding: 16px;
		background: var(--bg-color, white);
		border-radius: 12px;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
	}
	:global(.dark .wx-feed-item) {
		background: #1a1a2e;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	:global(.wx-feed-header) {
		display: flex;
		align-items: flex-start;
		gap: 10px;
		margin-bottom: 10px;
	}
	:global(.wx-avatar) {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--btn-regular-bg, #f3f4f6);
	}
	:global(.wx-feed-user) {
		flex: 1;
		min-width: 0;
	}
	:global(.wx-username) {
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 40%);
		display: flex;
		align-items: center;
		gap: 6px;
		flex-wrap: wrap;
	}
	:global(.dark .wx-username) {
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	:global(.wx-pinned-badge) {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 1px 6px;
		border-radius: 4px;
		background: hsla(var(--theme-hue, 165), 70%, 50%, 0.12);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		font-size: 11px;
		font-weight: 500;
	}
	:global(.dark .wx-pinned-badge) {
		color: hsl(var(--theme-hue, 165), 70%, 60%);
	}
	:global(.wx-feed-time) {
		font-size: 12px;
		color: var(--content-meta, #9ca3af);
		margin-top: 2px;
		display: flex;
		align-items: center;
		gap: 4px;
	}
	:global(.wx-location-dot) {
		opacity: 0.5;
	}

	:global(.wx-feed-content) {
		padding-left: 50px;
	}
	:global(.wx-content-text) {
		margin: 0 0 10px;
		font-size: 14px;
		line-height: 1.7;
		color: var(--text-color, #1f2937);
		word-break: break-word;
		white-space: pre-wrap;
	}
	:global(.dark .wx-content-text) {
		color: #e5e7eb;
	}

	/* 图片网格 */
	:global(.wx-imgs) {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
		margin-bottom: 10px;
		max-width: 330px;
	}
	:global(.wx-img-wrap) {
		position: relative;
		aspect-ratio: 1;
		border-radius: 4px;
		overflow: hidden;
		background: var(--btn-regular-bg, #f3f4f6);
	}
	:global(.wx-img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	/* 单张图片时较大显示 */
	:global(.wx-imgs-1) {
		grid-template-columns: 180px;
		max-width: 180px;
	}
	:global(.wx-imgs-1 .wx-img-wrap) {
		aspect-ratio: auto;
		max-height: 240px;
	}
	:global(.wx-imgs-1 .wx-img) {
		object-fit: contain;
	}

	/* 标签 */
	:global(.wx-feed-tags) {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding-top: 8px;
		border-top: 1px solid var(--border, rgba(0, 0, 0, 0.06));
	}
	:global(.dark .wx-feed-tags) {
		border-top-color: rgba(255, 255, 255, 0.06);
	}
	:global(.wx-tag) {
		padding: 2px 10px;
		border: 1px solid hsl(var(--theme-hue, 165), 60%, 60%);
		border-radius: 999px;
		font-size: 12px;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		background: color-mix(in srgb, hsl(var(--theme-hue, 165), 70%, 50%) 6%, transparent);
		cursor: default;
	}
	:global(.dark .wx-tag) {
		color: hsl(var(--theme-hue, 165), 70%, 60%);
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.4);
	}

	/* ============================================
	 * 内联编辑表单
	 * ============================================ */
	.wx-edit-form {
		padding: 4px 0;
	}
	.wx-edit-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 16px;
		font-size: 14px;
		font-weight: 600;
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.wx-draft-badge {
		padding: 1px 8px;
		border-radius: 999px;
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
		font-size: 11px;
		font-weight: 600;
	}
	.wx-form-group {
		margin-bottom: 12px;
	}
	.wx-form-row {
		display: flex;
		gap: 10px;
	}
	.wx-form-group-half {
		flex: 1;
	}
	.wx-form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 4px;
	}
	:global(.dark) .wx-form-group label {
		color: #d1d5db;
	}
	.wx-form-input,
	.wx-form-textarea {
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
	:global(.dark) .wx-form-input,
	:global(.dark) .wx-form-textarea {
		background: #0f0f1a;
		border-color: #374151;
		color: #e5e7eb;
	}
	.wx-form-input:focus,
	.wx-form-textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
	.wx-form-textarea {
		resize: vertical;
		min-height: 60px;
		line-height: 1.6;
	}
	.wx-form-actions {
		display: flex;
		gap: 8px;
		margin-top: 16px;
	}
	.wx-form-btn {
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
	.wx-form-btn-cancel {
		background: var(--bg-secondary, #f3f4f6);
		color: var(--text-color, #374151);
	}
	.wx-form-btn-cancel:hover {
		background: var(--border, #e5e7eb);
	}
	:global(.dark) .wx-form-btn-cancel {
		background: #2d2d44;
		color: #d1d5db;
	}
	.wx-form-btn-save {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.wx-form-btn-save:hover {
		background: hsl(var(--theme-hue, 165), 75%, 45%);
	}

	/* 置顶开关 */
	.wx-toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text-color, #374151);
		font-weight: 500;
		padding-top: 22px;
	}
	:global(.dark) .wx-toggle-label {
		color: #d1d5db;
	}
	.wx-toggle-checkbox {
		display: none;
	}
	.wx-toggle-switch {
		position: relative;
		width: 40px;
		height: 22px;
		background: var(--border, #d1d5db);
		border-radius: 999px;
		transition: background 0.2s;
		flex-shrink: 0;
	}
	:global(.dark) .wx-toggle-switch {
		background: #374151;
	}
	.wx-toggle-switch::after {
		content: "";
		position: absolute;
		top: 2px;
		left: 2px;
		width: 18px;
		height: 18px;
		background: white;
		border-radius: 50%;
		transition: transform 0.2s;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
	}
	.wx-toggle-checkbox:checked + .wx-toggle-switch {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.wx-toggle-checkbox:checked + .wx-toggle-switch::after {
		transform: translateX(18px);
	}

	/* 空状态 */
	.wx-empty-state {
		text-align: center;
		padding: 48px 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	/* 响应式 */
	@media (max-width: 480px) {
		:global(.wx-feed-content) {
			padding-left: 0;
			margin-top: 10px;
		}
		.wx-form-row {
			flex-direction: column;
			gap: 0;
		}
		:global(.wx-imgs) {
			max-width: 100%;
		}
	}
</style>
