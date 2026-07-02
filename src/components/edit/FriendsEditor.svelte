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
	updateRepoFile,
	createRepoFile,
	hasValidCredentials,
} from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";

interface PendingFriend {
	id: string;
	title: string;
	siteurl: string;
	imgurl: string;
	desc: string;
	tags?: string[];
	appliedAt: string;
}

interface FriendItem {
	id?: string;
	title: string;
	imgurl: string;
	desc: string;
	siteurl: string;
	tags?: string[];
	weight?: number;
	enabled?: boolean;
	_draft?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let friends = $state<FriendItem[]>([]);
let originalFriends = $state<FriendItem[]>([]);
let editingIndex = $state(-1);
let repoLoaded = $state(false);
let fileSha = $state<string | null>(null);
let originalTS = $state<string>("");

// 待审核友链申请
let pendingFriends = $state<PendingFriend[]>([]);
let pendingFileSha = $state<string | null>(null);
let pendingLoading = $state(false);
let pendingActionId = $state<string | null>(null);
let selectedPendingIds = $state<Set<string>>(new Set());

// 认证状态（与 EditToolbar 同步）
let authed = $state(hasValidCredentials());

// 从 TypeScript 配置文件中解析友链数组
function parseFriendsFromTS(tsContent: string): FriendItem[] {
	// 统一换行符为 LF
	tsContent = tsContent.replace(/\r\n/g, "\n");
	const startMarker = "export const friendsConfig: FriendLink[] = [";
	const startIdx = tsContent.indexOf(startMarker);
	if (startIdx === -1) return [];
	let bracketStart = startIdx + startMarker.length;
	let depth = 1;
	let idx = bracketStart;
	while (idx < tsContent.length && depth > 0) {
		if (tsContent[idx] === "[") depth++;
		else if (tsContent[idx] === "]") depth--;
		if (depth > 0) idx++;
	}
	let arrayStr = tsContent.substring(bracketStart, idx).trim();
	// 移除 JS 行注释，但保留字符串内的 // (如 URL)
	arrayStr = stripLineComments(arrayStr);
	// 移除尾逗号: 在 ] 前、} 前、以及字符串末尾
	arrayStr = arrayStr.replace(/,(\s*[\]\}])/g, "$1");
	arrayStr = arrayStr.replace(/,(\s*)$/, "$1");
	// 给未加引号的属性名加上引号 (TypeScript -> JSON)
	// 仅匹配行首的属性名，避免匹配字符串值中的冒号
	arrayStr = arrayStr.replace(/^(\s*)(\w+)\s*:/gm, '$1"$2":');
	try {
		return JSON.parse(`[${arrayStr}]`);
	} catch (e) {
		console.error("Failed to parse friends from TS:", e);
		return [];
	}
}

// 移除行注释，但保留字符串内的 // (避免破坏 URL)
function stripLineComments(code: string): string {
	const lines = code.split("\n");
	return lines
		.map((line) => {
			let inStr = false;
			let quotes = 0;
			for (let i = 0; i < line.length - 1; i++) {
				if (line[i] === '"' && (i === 0 || line[i - 1] !== "\\")) {
					inStr = !inStr;
					quotes++;
				}
				if (!inStr && line[i] === "/" && line[i + 1] === "/") {
					// 仅当 // 前面有偶数个引号时才认为是注释
					if (quotes % 2 === 0) {
						return line.substring(0, i);
					}
				}
			}
			return line;
		})
		.join("\n");
}

// 构建完整的 TypeScript 配置文件内容
// 如果有原始文件内容，只替换 friendsConfig 数组部分，保留其余配置不变
// 如果没有原始内容（新建场景），生成完整文件
function buildFriendsConfigTS(
	friends: FriendItem[],
	originalContent?: string,
): string {
	const entries = friends.map((f) => {
		const obj = {
			title: f.title,
			imgurl: f.imgurl,
			desc: f.desc,
			siteurl: f.siteurl,
			tags: f.tags || ["Blog"],
			weight: f.weight ?? 10,
			enabled: f.enabled !== false,
		};
		const json = JSON.stringify(obj, null, 2)
			.split("\n")
			.map((line, i, arr) =>
				i === arr.length - 1 ? `\t\t${line},` : `\t\t${line}`,
			)
			.join("\n");
		return json;
	});
	const newArrayContent = `[\n${entries.join("\n")}\n]`;

	if (originalContent) {
		// 有原始内容：只替换 friendsConfig 数组部分
		const startMarker = "export const friendsConfig: FriendLink[] = [";
		const startIdx = originalContent.indexOf(startMarker);
		if (startIdx !== -1) {
			let bracketStart = startIdx + startMarker.length;
			let depth = 1;
			let idx = bracketStart;
			while (idx < originalContent.length && depth > 0) {
				if (originalContent[idx] === "[") depth++;
				else if (originalContent[idx] === "]") depth--;
				if (depth > 0) idx++;
			}
			// 替换数组内容（保留原始的 [ 和 ]）
			const innerContent = entries.join("\n");
			return (
				originalContent.substring(0, bracketStart) +
				"\n" +
				innerContent +
				"\n\t]" +
				originalContent.substring(idx + 1)
			);
		}
	}

	// 没有原始内容：生成完整文件（新建场景）
	return `import type { FriendLink, FriendsPageConfig } from "../types/config";

// 可以在src/content/spec/friends.md中编写友链页面下方的自定义内容

// 友链页面配置
export const friendsPageConfig: FriendsPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// 是否显示底部自定义内容（friends.mdx 中的内容）
	showCustomContent: true,

	// 是否显示评论区，需要先在commentConfig.ts启用评论系统
	showComment: true,

	// 是否开启随机排序配置，如果开启，就会忽略权重，构建时进行一次随机排序
	randomizeSort: false,

	// 友链申请链接，填写后会在友链页面显示申请按钮
	// 使用模板参数直接跳转到友链申请模板
	applyLink:
		"https://github.com/fqzlr/my-blog/issues/new?template=friend-link.yml",

	// 本站信息，用于友链申请指南弹窗中的站点信息展示
	siteInfo: {
		name: "fqzlr",
		desc: "躬身入局，心为主理，行有尺度，自持本心",
		url: "https://fqzlr.com",
		avatar: "https://q1.qlogo.cn/g?b=qq&nk=20447289&s=640",
		email: "20447289@qq.com",
	},

	// 注意事项，用于友链申请指南弹窗中的注意事项展示
	notes: [
		{
			title: "互换原则",
			content: "请先将本站添加到您的友链页面，确认后会添加您的友链",
		},
		{
			title: "链接维护",
			content: "友链网站长期无法访问或内容违规，将会被移除",
		},
		{
			title: "内容要求",
			content: "内容积极向上，不含有任何含色情/反动/暴力等违法违规内容",
		},
		{
			title: "站点要求",
			content: "支持 HTTPS，以原创内容为主，能够正常访问且有持续更新",
		},
	],
};

// 友链配置
export const friendsConfig: FriendLink[] = ${newArrayContent};

// 获取启用的友链并进行排序
export const getEnabledFriends = (): FriendLink[] => {
	const friends = friendsConfig.filter((friend) => friend.enabled);

	if (friendsPageConfig.randomizeSort) {
		return friends.sort(() => Math.random() - 0.5);
	}

	return friends.sort((a, b) => b.weight - a.weight);
};
`;
}

const typeColors: Record<string, { bg: string; text: string }> = {
	Blog: { bg: "#3b82f6", text: "#ffffff" },
	Docs: { bg: "#f59e0b", text: "#ffffff" },
};

const drafts = setupRepoDrafts({
	pageKey: "friends",
	pageName: "友链",
	getContent: () => buildFriendsConfigTS(friends, originalTS),
	setContent: (v) => {
		const parsed = parseFriendsFromTS(v);
		if (parsed.length > 0 || v.includes("friendsConfig")) {
			friends = parsed;
		}
	},
	getPath: () => "src/config/friendsConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () => originalTS,
	setOriginalContent: (v) => (originalTS = v),
	getCommitMsg: (isEdit) =>
		isEdit ? `chore: update friends` : `chore: create friends`,
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1200);
	},
});

let hasChanges = $derived(drafts.hasLocalChanges());

onMount(() => {
	ensureIconify();
	collectFromDOM();
	loadRepoData();
	loadPendingFriends();
});

async function loadRepoData() {
	const existing = await getRepoFile("src/config/friendsConfig.ts");
	if (existing && existing.content) {
		try {
			const repoItems: FriendItem[] = parseFriendsFromTS(existing.content);
			originalTS = existing.content;
			// 用仓库数据中的 weight/enabled 覆盖 DOM 收集的默认值
			const repoMap = new Map(
				repoItems.map((f) => [f.siteurl.replace(/\/$/, ""), f]),
			);
			friends = friends.map((f) => {
				const key = f.siteurl.replace(/\/$/, "");
				const repoItem = repoMap.get(key);
				if (repoItem) {
					return {
						...f,
						weight: repoItem.weight ?? f.weight,
						enabled: repoItem.enabled ?? f.enabled,
					};
				}
				return f;
			});
			// 添加仓库中有但 DOM 中没有的友链
			const existingUrls = new Set(
				friends.map((f) => f.siteurl.replace(/\/$/, "")),
			);
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
	} else {
		// 仓库中不存在文件，用当前 DOM 数据生成原始内容
		originalTS = buildFriendsConfigTS(friends);
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
		const link = card.querySelector(
			"a.friend-card-link",
		) as HTMLAnchorElement | null;
		if (!link) return;
		const title =
			card.querySelector(".friend-card-title")?.textContent?.trim() || "";
		const desc =
			card.querySelector(".friend-card-desc")?.textContent?.trim() ||
			link.dataset.desc ||
			"";
		const img = card.querySelector(
			"img.friend-card-avatar",
		) as HTMLImageElement | null;
		const badge = card.querySelector(".friend-card-type-badge");
		const tag = badge?.textContent?.trim() || "Blog";
		items.push({
			id: card.dataset.friendId || link.href,
			title,
			imgurl: img?.src || "",
			desc,
			siteurl: link.href,
			tags: [tag],
			weight: 10,
			enabled: true,
		});
	});
	friends = items;
	const ts = buildFriendsConfigTS(items);
	originalTS = ts;
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
		weight: 10,
		enabled: true,
		_draft: true,
	};
	friends = [...friends, newFriend];
	editingIndex = friends.length - 1;
}

function handleSaveDraft() {
	const cleanData = friends.map(({ _draft, ...rest }) => ({
		...rest,
		id: rest.id || genId("fr"),
		weight: rest.weight ?? 10,
		enabled: rest.enabled !== false,
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
			weight: rest.weight ?? 10,
			enabled: rest.enabled !== false,
		}));
		friends = cleanData;
		// 先保存当前状态为草稿，确保提交的是最新内容
		drafts.saveToDrafts();
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

// ============ 待审核友链申请 ============

async function loadPendingFriends() {
	pendingLoading = true;
	const result = await getRepoFile("data/pending-friends.json");
	if (result && result.content) {
		try {
			pendingFriends = JSON.parse(result.content);
			pendingFileSha = result.sha;
		} catch {
			pendingFriends = [];
		}
	} else {
		pendingFriends = [];
		pendingFileSha = null;
	}
	pendingLoading = false;
}

async function commitPendingFile(
	updated: PendingFriend[],
	message: string,
): Promise<boolean> {
	const content = JSON.stringify(updated, null, 2);
	let ok: boolean;
	if (pendingFileSha) {
		ok = await updateRepoFile(
			"data/pending-friends.json",
			content,
			pendingFileSha,
			message,
		);
	} else {
		ok = await createRepoFile("data/pending-friends.json", content, message);
	}
	if (ok) {
		const fresh = await getRepoFile("data/pending-friends.json");
		if (fresh) pendingFileSha = fresh.sha;
	}
	return ok;
}

async function approveFriend(index: number) {
	const pf = pendingFriends[index];
	if (!pf) return;

	pendingActionId = pf.id;

	// 添加到本地 friends 数组
	const newFriend: FriendItem = {
		id: genId("fr"),
		title: pf.title,
		imgurl: pf.imgurl,
		desc: pf.desc,
		siteurl: pf.siteurl,
		tags: pf.tags || ["Blog"],
		weight: 10,
		enabled: true,
	};
	friends = [...friends, newFriend];

	// 从 pending 列表移除
	const updatedPending = pendingFriends.filter((_, i) => i !== index);

	// 提交 friendsConfig.ts
	const newConfigContent = buildFriendsConfigTS(friends, originalTS);
	const configOk = fileSha
		? await updateRepoFile(
				"src/config/friendsConfig.ts",
				newConfigContent,
				fileSha,
				`chore: approve friend ${pf.title}`,
			)
		: false;

	if (configOk) {
		// 更新本地 SHA
		const fresh = await getRepoFile("src/config/friendsConfig.ts");
		if (fresh) fileSha = fresh.sha;
		originalTS = newConfigContent;
		originalFriends = deepClone(friends);
	}

	// 更新 pending-friends.json
	const pendingOk = await commitPendingFile(
		updatedPending,
		`chore: remove approved friend ${pf.title}`,
	);

	if (configOk && pendingOk) {
		pendingFriends = updatedPending;
		showToast(`已批准「${pf.title}」并添加到友链`, "success");
	} else {
		showToast("操作部分失败，请检查 GitHub 权限", "error");
	}

	pendingActionId = null;
}

async function rejectFriend(index: number) {
	const pf = pendingFriends[index];
	if (!pf) return;
	if (!confirm(`确定要拒绝「${pf.title}」的申请吗？`)) return;

	pendingActionId = pf.id;

	const updatedPending = pendingFriends.filter((_, i) => i !== index);
	const ok = await commitPendingFile(
		updatedPending,
		`chore: reject friend ${pf.title}`,
	);

	if (ok) {
		pendingFriends = updatedPending;
		showToast(`已拒绝「${pf.title}」的申请`, "info");
	} else {
		showToast("操作失败，请检查 GitHub 权限", "error");
	}

	pendingActionId = null;
}

// ============ 批量审核功能 ============

function toggleSelectPending(id: string) {
	const newSet = new Set(selectedPendingIds);
	if (newSet.has(id)) {
		newSet.delete(id);
	} else {
		newSet.add(id);
	}
	selectedPendingIds = newSet;
}

function selectAllPending() {
	selectedPendingIds = new Set(pendingFriends.map((pf) => pf.id));
}

function clearSelection() {
	selectedPendingIds = new Set();
}

async function batchApprovePending() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		return;
	}
	if (selectedPendingIds.size === 0) {
		showToast("请先选择要批准的申请", "warning");
		return;
	}

	const selectedCount = selectedPendingIds.size;
	if (!confirm(`确定要批准选中的 ${selectedCount} 条友链申请吗？`)) return;

	pendingLoading = true;

	try {
		// 1. 将所有选中的申请添加到 friends 数组
		const approvedFriends: FriendItem[] = [];
		for (const id of selectedPendingIds) {
			const pf = pendingFriends.find((p) => p.id === id);
			if (pf) {
				approvedFriends.push({
					id: genId("fr"),
					title: pf.title,
					imgurl: pf.imgurl,
					desc: pf.desc,
					siteurl: pf.siteurl,
					tags: pf.tags || ["Blog"],
					weight: 10,
					enabled: true,
				});
			}
		}

		friends = [...friends, ...approvedFriends];

		// 2. 更新 friendsConfig.ts
		const newConfigContent = buildFriendsConfigTS(friends, originalTS);
		let configOk = false;
		if (fileSha) {
			configOk = await updateRepoFile(
				"src/config/friendsConfig.ts",
				newConfigContent,
				fileSha,
				`chore: batch approve ${selectedCount} friends`,
			);
		}

		if (configOk) {
			const fresh = await getRepoFile("src/config/friendsConfig.ts");
			if (fresh) fileSha = fresh.sha;
			originalTS = newConfigContent;
			originalFriends = deepClone(friends);
		}

		// 3. 从 pending-friends.json 移除已批准的申请
		const updatedPending = pendingFriends.filter(
			(pf) => !selectedPendingIds.has(pf.id),
		);
		const pendingOk = await commitPendingFile(
			updatedPending,
			`chore: remove ${selectedCount} approved friends from pending`,
		);

		if (configOk && pendingOk) {
			pendingFriends = updatedPending;
			selectedPendingIds = new Set();
			showToast(`已批准 ${selectedCount} 条友链申请`, "success");
		} else {
			showToast("操作部分失败，请检查 GitHub 权限", "error");
		}
	} catch (err) {
		console.error("Batch approve error:", err);
		showToast("批量批准失败", "error");
	} finally {
		pendingLoading = false;
	}
}

async function batchRejectPending() {
	if (!authed) {
		showToast("请先导入 GitHub App 私钥", "warning");
		return;
	}
	if (selectedPendingIds.size === 0) {
		showToast("请先选择要拒绝的申请", "warning");
		return;
	}

	const selectedCount = selectedPendingIds.size;
	if (!confirm(`确定要拒绝选中的 ${selectedCount} 条友链申请吗？`)) return;

	pendingLoading = true;

	try {
		const updatedPending = pendingFriends.filter(
			(pf) => !selectedPendingIds.has(pf.id),
		);
		const ok = await commitPendingFile(
			updatedPending,
			`chore: reject ${selectedCount} friend applications`,
		);

		if (ok) {
			pendingFriends = updatedPending;
			selectedPendingIds = new Set();
			showToast(`已拒绝 ${selectedCount} 条友链申请`, "info");
		} else {
			showToast("操作失败，请检查 GitHub 权限", "error");
		}
	} catch (err) {
		console.error("Batch reject error:", err);
		showToast("批量拒绝失败", "error");
	} finally {
		pendingLoading = false;
	}
}
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="friends-edit-toolbar">
	<EditToolbar
		pageKey="friends"
		pageName="友链"
		mountTo=".page-header-toolbar-slot"
		mainBtnClass="fa-btn"
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
	<!-- 待审核友链申请区域 -->
	{#if pendingLoading}
		<div class="pending-section">
			<div class="pending-loading">
				<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin"></iconify-icon>
				<span>加载待审核申请...</span>
			</div>
		</div>
	{:else if pendingFriends.length > 0}
		<div class="pending-section">
			<div class="pending-header">
				<iconify-icon icon="material-symbols:pending-actions-rounded"></iconify-icon>
				<h3>待审核申请</h3>
				<span class="pending-count">{pendingFriends.length}</span>
				{#if selectedPendingIds.size > 0}
					<div class="pending-batch-actions">
						<button
							class="pending-btn pending-btn-approve"
							onclick={batchApprovePending}
							disabled={pendingLoading}
							title="批量批准选中的申请"
						>
							<iconify-icon icon="material-symbols:check-circle-outline-rounded"></iconify-icon>
							批准 ({selectedPendingIds.size})
						</button>
						<button
							class="pending-btn pending-btn-reject"
							onclick={batchRejectPending}
							disabled={pendingLoading}
							title="批量拒绝选中的申请"
						>
							<iconify-icon icon="material-symbols:cancel-outline-rounded"></iconify-icon>
							拒绝 ({selectedPendingIds.size})
						</button>
						<button
							class="pending-btn pending-btn-clear"
							onclick={clearSelection}
							disabled={pendingLoading}
							title="清空选择"
						>
							<iconify-icon icon="material-symbols:close-rounded"></iconify-icon>
						</button>
					</div>
				{:else}
					<button
						class="pending-btn pending-btn-select-all"
						onclick={selectAllPending}
						disabled={pendingLoading}
						title="全选所有申请"
					>
						<iconify-icon icon="material-symbols:select-all-rounded"></iconify-icon>
						全选
					</button>
				{/if}
			</div>
			<div class="pending-grid">
				{#each pendingFriends as pf, pi (pf.id)}
					<div class="pending-card" class:selected={selectedPendingIds.has(pf.id)}>
						<div class="pending-card-info">
							<input
								type="checkbox"
								class="pending-checkbox"
								checked={selectedPendingIds.has(pf.id)}
								onchange={() => toggleSelectPending(pf.id)}
								disabled={pendingLoading || pendingActionId === pf.id}
							/>
							{#if pf.imgurl}
								<img src={pf.imgurl} alt={pf.title} class="pending-avatar" loading="lazy" onerror={(e) => ((e.target as HTMLImageElement).style.opacity = '0')} />
							{:else}
								<div class="pending-avatar-placeholder">
									<iconify-icon icon="material-symbols:person-outline"></iconify-icon>
								</div>
							{/if}
							<div class="pending-details">
								<h4 class="pending-title">{pf.title}</h4>
								<p class="pending-url">{pf.siteurl}</p>
								<p class="pending-desc">{pf.desc}</p>
								<div class="pending-meta">
									<span class="pending-tag" style="background-color:{getTagColor(pf.tags?.[0] || 'Blog').bg};color:{getTagColor(pf.tags?.[0] || 'Blog').text}">{pf.tags?.[0] || 'Blog'}</span>
									<span class="pending-time">{new Date(pf.appliedAt).toLocaleDateString('zh-CN')}</span>
								</div>
							</div>
						</div>
						<div class="pending-actions">
							<button
								class="pending-btn pending-btn-approve"
								onclick={() => approveFriend(pi)}
								disabled={pendingActionId === pf.id}
								title="批准并添加到友链"
							>
								{#if pendingActionId === pf.id}
									<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin"></iconify-icon>
								{:else}
									<iconify-icon icon="material-symbols:check-circle-outline-rounded"></iconify-icon>
									批准
								{/if}
							</button>
							<button
								class="pending-btn pending-btn-reject"
								onclick={() => rejectFriend(pi)}
								disabled={pendingActionId === pf.id}
								title="拒绝此申请"
							>
								{#if pendingActionId === pf.id}
									<iconify-icon icon="material-symbols:progress-activity-rounded" class="animate-spin"></iconify-icon>
								{:else}
									<iconify-icon icon="material-symbols:cancel-outline-rounded"></iconify-icon>
									拒绝
								{/if}
							</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

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

	/* ============ 待审核申请区域 ============ */

	.pending-section {
		margin-bottom: 20px;
		padding: 16px;
		border-radius: 16px;
		background: rgba(245, 158, 11, 0.05);
		border: 1.5px dashed rgba(245, 158, 11, 0.3);
	}
	:global(.dark) .pending-section {
		background: rgba(245, 158, 11, 0.08);
		border-color: rgba(245, 158, 11, 0.2);
	}

	.pending-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 14px;
		font-size: 15px;
		font-weight: 700;
		color: #d97706;
	}
	:global(.dark) .pending-header {
		color: #fbbf24;
	}
	.pending-header iconify-icon {
		font-size: 20px;
		display: flex;
	}
	.pending-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 700;
	}
	.pending-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 999px;
		background: #f59e0b;
		color: white;
		font-size: 12px;
		font-weight: 700;
	}

	/* 批量操作按钮 */
	.pending-batch-actions {
		display: flex;
		gap: 8px;
		margin-left: auto;
	}
	.pending-btn-select-all,
	.pending-btn-clear {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: 6px;
		border: 1px solid var(--border, rgba(0,0,0,0.1));
		background: transparent;
		color: var(--text-color, #374151);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.pending-btn-select-all:hover:not(:disabled),
	.pending-btn-clear:hover:not(:disabled) {
		background: var(--btn-regular-bg, #f3f4f6);
	}
	:global(.dark) .pending-btn-select-all,
	:global(.dark) .pending-btn-clear {
		border-color: rgba(255,255,255,0.1);
		color: #d1d5db;
	}
	:global(.dark) .pending-btn-select-all:hover:not(:disabled),
	:global(.dark) .pending-btn-clear:hover:not(:disabled) {
		background: rgba(255,255,255,0.05);
	}
	.pending-btn-select-all:disabled,
	.pending-btn-clear:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pending-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 20px;
		color: var(--content-meta, #9ca3af);
		font-size: 14px;
	}

	.pending-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 12px;
	}

	.pending-card {
		border-radius: 12px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0,0,0,0.08));
		overflow: hidden;
		transition: all 0.2s;
	}
	:global(.dark) .pending-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255,255,255,0.08);
	}
	.pending-card:hover {
		border-color: rgba(245, 158, 11, 0.4);
		box-shadow: 0 4px 16px rgba(245, 158, 11, 0.08);
	}
	.pending-card.selected {
		border-color: #f59e0b;
		box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.2);
	}
	:global(.dark) .pending-card.selected {
		border-color: #fbbf24;
		box-shadow: 0 0 0 2px rgba(251, 191, 36, 0.2);
	}

	.pending-card-info {
		display: flex;
		gap: 12px;
		padding: 14px;
	}

	/* 复选框 */
	.pending-checkbox {
		width: 18px;
		height: 18px;
		flex-shrink: 0;
		margin-top: 2px;
		cursor: pointer;
		accent-color: #f59e0b;
	}

	.pending-avatar {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		object-fit: cover;
		flex-shrink: 0;
		background: var(--btn-regular-bg, #f3f4f6);
	}
	:global(.dark) .pending-avatar {
		background: rgba(255,255,255,0.05);
	}
	.pending-avatar-placeholder {
		width: 40px;
		height: 40px;
		border-radius: 10px;
		flex-shrink: 0;
		background: var(--btn-regular-bg, #f3f4f6);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--content-meta, #9ca3af);
		font-size: 20px;
	}
	:global(.dark) .pending-avatar-placeholder {
		background: rgba(255,255,255,0.05);
	}

	.pending-details {
		flex: 1;
		min-width: 0;
	}
	.pending-title {
		margin: 0 0 2px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-color, #1f2937);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	:global(.dark) .pending-title {
		color: #f0f0f0;
	}
	.pending-url {
		margin: 0 0 4px;
		font-size: 11px;
		color: hsl(var(--theme-hue, 165), 60%, 50%);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pending-desc {
		margin: 0 0 6px;
		font-size: 12px;
		color: var(--text-secondary, #6b7280);
		line-height: 1.4;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	:global(.dark) .pending-desc {
		color: #9ca3af;
	}
	.pending-meta {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pending-tag {
		display: inline-block;
		padding: 1px 8px;
		border-radius: 999px;
		font-size: 10px;
		font-weight: 600;
	}
	.pending-time {
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
	}

	.pending-actions {
		display: flex;
		border-top: 1px solid var(--border, rgba(0,0,0,0.06));
	}
	:global(.dark) .pending-actions {
		border-color: rgba(255,255,255,0.06);
	}

	.pending-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 8px;
		border: none;
		background: none;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s;
	}
	.pending-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.pending-btn iconify-icon {
		font-size: 16px;
		display: flex;
	}
	.pending-btn-approve {
		color: #16a34a;
	}
	.pending-btn-approve:hover:not(:disabled) {
		background: rgba(34, 197, 94, 0.1);
	}
	.pending-btn-reject {
		color: #dc2626;
		border-left: 1px solid var(--border, rgba(0,0,0,0.06));
	}
	:global(.dark) .pending-btn-reject {
		border-left-color: rgba(255,255,255,0.06);
	}
	.pending-btn-reject:hover:not(:disabled) {
		background: rgba(239, 68, 68, 0.1);
	}
</style>
