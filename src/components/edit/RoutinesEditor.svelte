<script lang="ts">
import { onMount } from "svelte";
import EditToolbar from "./EditToolbar.svelte";
import EditToast from "./EditToast.svelte";
import { marked } from "marked";
import {
	hasValidToken,
	showToast,
	ensureIconify,
	getRepoFile,
	updateRepoFile,
	createRepoFile,
	deleteRepoFile,
	genId,
	deepClone,
	saveDraft,
	getDraft,
	deleteDraft,
	registerSubmitHandler,
} from "@/utils/editMode";
import { repoConfig } from "@/config/editConfig";

interface RoutineItem {
	id: string;
	slug: string;
	name: string;
	time: string;
	icon: string;
	color: string;
	description: string;
	body: string;
	updatedAt: string;
	sha?: string;
	_draft?: boolean;
	_deleted?: boolean;
}

let editMode = $state(false);
let saving = $state(false);
let hasChanges = $state(false);
let routines = $state<RoutineItem[]>([]);
let originalRoutines = $state<RoutineItem[]>([]);
let editingIndex = $state(-1);
let editPreview = $state("");

const emojiOptions = [
	"📌",
	"📝",
	"🎯",
	"⏰",
	"💪",
	"🧘",
	"📚",
	"💤",
	"🏃",
	"🍎",
	"💧",
	"☀️",
	"🌙",
	"✅",
	"🚀",
	"🔥",
	"💡",
	"🎨",
	"🎵",
	"❤️",
];

onMount(() => {
	ensureIconify();
	collectFromDOM();
	const draft = getDraft<any>("routines");
	if (draft?.routines) {
		if (confirm("发现未提交的日常规划草稿，是否恢复？")) {
			routines = draft.routines;
			hasChanges = true;
			showToast("草稿已恢复", "success");
		} else {
			deleteDraft("routines");
		}
	}
	window.addEventListener("blog:batch-submit", handleBatchSubmit);
	return () =>
		window.removeEventListener("blog:batch-submit", handleBatchSubmit);
});

function htmlToMarkdown(html: string): string {
	if (!html) return "";
	return html
		.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "# $1\n")
		.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
		.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
		.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "#### $1\n")
		.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n")
		.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
		.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**")
		.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
		.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*")
		.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
		.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
		.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, "$1")
		.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, "$1")
		.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
		.replace(/<br\s*\/?>/gi, "\n")
		.replace(/<hr\s*\/?>/gi, "---\n")
		.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, "> $1\n")
		.replace(/<[^>]+>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&")
		.trim();
}

function collectFromDOM() {
	const result: RoutineItem[] = [];
	document.querySelectorAll(".routine-card").forEach((card) => {
		const iconEl = card.querySelector(".routine-icon-wrap span");
		const icon = iconEl?.textContent?.trim() || "📌";
		const nameEl = card.querySelector(".routine-title");
		const name = nameEl?.textContent?.trim() || "";
		const timeEl = card.querySelector(".routine-time");
		const time = timeEl?.textContent?.trim() || "";
		const descEl = card.querySelector(".routine-desc");
		const description = descEl?.textContent?.trim() || "";
		const contentEl = card.querySelector(".routine-content");
		const bodyHtml = contentEl?.innerHTML || "";
		const body = htmlToMarkdown(bodyHtml);
		const slug = slugify(name) || genId("rt").slice(-6);
		result.push({
			id: genId("rt"),
			slug,
			name,
			time,
			icon,
			color: "",
			description,
			body,
			updatedAt: new Date().toISOString().slice(0, 10),
		});
	});
	routines = result;
	originalRoutines = deepClone(result);
}

function hideSSRContent() {
	document
		.querySelectorAll(".routine-card")
		.forEach((c) => ((c as HTMLElement).style.display = "none"));
	const grids = document.querySelectorAll(".routines-grid");
	grids.forEach((g) => ((g as HTMLElement).style.display = "none"));
	const empty = document.querySelector(".w-full.p-12.text-center");
	if (empty) (empty as HTMLElement).style.display = "none";
	const stats = document.querySelector(".stat-pill")?.parentElement;
	if (stats) (stats as HTMLElement).style.display = "none";
}

function showSSRContent() {
	document
		.querySelectorAll(".routine-card")
		.forEach((c) => ((c as HTMLElement).style.display = ""));
	const grids = document.querySelectorAll(".routines-grid");
	grids.forEach((g) => ((g as HTMLElement).style.display = ""));
	const empty = document.querySelector(".w-full.p-12.text-center");
	if (empty) (empty as HTMLElement).style.display = "";
	const stats = document.querySelector(".stat-pill")?.parentElement;
	if (stats) (stats as HTMLElement).style.display = "";
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

function handleCancel() {
	routines = deepClone(originalRoutines);
	hasChanges = false;
	editingIndex = -1;
	showSSRContent();
}

function startEdit(index: number) {
	editingIndex = index;
	updatePreview(index);
}

function updatePreview(index: number) {
	const r = routines[index];
	if (!r) {
		editPreview = "";
		return;
	}
	try {
		editPreview = marked.parse(r.body || "", {
			gfm: true,
			breaks: true,
		}) as string;
	} catch {
		editPreview = r.body || "";
	}
}

function updateField(
	index: number,
	field: keyof RoutineItem,
	value: string | number,
) {
	routines[index] = { ...routines[index], [field]: value };
	routines = [...routines];
	if (field === "body") updatePreview(index);
	hasChanges = true;
}

function finishEdit(index: number) {
	const r = routines[index];
	if (!r.name.trim()) {
		showToast("名称不能为空", "warning");
		return;
	}
	editingIndex = -1;
	hasChanges = true;
	showToast("已修改，记得点击保存", "info");
}

function cancelItemEdit(index: number) {
	const r = routines[index];
	if (r._draft && !r.name.trim()) {
		routines = routines.filter((_, i) => i !== index);
	} else {
		const orig = originalRoutines.find((o) => o.slug === r.slug && !r._draft);
		if (orig) {
			routines[index] = deepClone(orig);
			routines = [...routines];
		}
	}
	editingIndex = -1;
}

function deleteItem(index: number) {
	const r = routines[index];
	if (!confirm(`确定要删除「${r.name}」吗？`)) return;
	if (r._draft) {
		routines = routines.filter((_, i) => i !== index);
	} else {
		routines[index] = { ...routines[index], _deleted: true };
		routines = [...routines];
	}
	hasChanges = true;
	if (editingIndex === index) editingIndex = -1;
	else if (editingIndex > index) editingIndex--;
	showToast("已标记删除，记得点击保存", "info");
}

function moveUp(index: number) {
	if (index <= 0) return;
	const arr = [...routines];
	[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
	routines = arr;
	hasChanges = true;
	if (editingIndex === index) editingIndex = index - 1;
	else if (editingIndex === index - 1) editingIndex = index;
}

function moveDown(index: number) {
	if (index >= routines.length - 1) return;
	const arr = [...routines];
	[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
	routines = arr;
	hasChanges = true;
	if (editingIndex === index) editingIndex = index + 1;
	else if (editingIndex === index + 1) editingIndex = index;
}

function restoreItem(index: number) {
	routines[index] = { ...routines[index], _deleted: false };
	routines = [...routines];
	hasChanges = true;
}

function handleAdd() {
	routines = [
		{
			id: genId("rt"),
			slug: "",
			name: "",
			time: "",
			icon: "📌",
			color: "",
			description: "",
			body: "",
			updatedAt: new Date().toISOString().slice(0, 10),
			_draft: true,
		},
		...routines,
	];
	editingIndex = 0;
	hasChanges = true;
	editPreview = "";
}

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.trim()
			.replace(/[\s]+/g, "-")
			.replace(/[^\w\u4e00-\u9fa5-]/g, "")
			.replace(/-+/g, "-")
			.replace(/^-|-$/g, "") || "routine"
	);
}

function buildRoutineMd(r: RoutineItem): string {
	const lines = ["---"];
	lines.push(`name: "${r.name.replace(/"/g, '\\"')}"`);
	if (r.time) lines.push(`time: "${r.time.replace(/"/g, '\\"')}"`);
	if (r.icon) lines.push(`icon: "${r.icon}"`);
	if (r.color) lines.push(`color: "${r.color}"`);
	if (r.description)
		lines.push(`description: "${r.description.replace(/"/g, '\\"')}"`);
	lines.push(`updatedAt: ${r.updatedAt}`);
	lines.push("---");
	lines.push("");
	lines.push(r.body.trim());
	lines.push("");
	return lines.join("\n");
}

function handleSaveDraft() {
	saveDraft({
		pageKey: "routines",
		pageName: "日常规划",
		description: `共 ${routines.length} 条规划`,
		operation: "update",
		payload: { routines },
	});
	showToast("日常规划草稿已保存", "success");
}
async function handleBatchSubmit() {
	const draft = getDraft<any>("routines");
	if (draft?.routines) {
		routines = draft.routines;
		await handleSave();
		if (!saving) deleteDraft("routines");
	}
}

async function handleSave(): Promise<boolean> {
	if (!hasValidToken()) {
		showToast("GitHub 代理未配置，请联系管理员", "warning");
		return false;
	}
	saving = true;
	try {
		let allOk = true;
		for (let i = 0; i < routines.length; i++) {
			const r = routines[i];
			if (r._deleted) {
				if (r.slug && !r._draft) {
					const filePath = `src/content/life/routines/${r.slug}.md`;
					const file = await getRepoFile(filePath, repoConfig);
					if (file && file.sha) {
						const ok = await deleteRepoFile(
							filePath,
							file.sha,
							`chore(routines): remove ${r.slug}`,
							repoConfig,
						);
						if (!ok) allOk = false;
					}
				}
				continue;
			}
			const md = buildRoutineMd(r);
			let slug = r.slug;
			if (r._draft || !slug) {
				slug = slugify(r.name);
				const ok = await createRepoFile(
					`src/content/life/routines/${slug}.md`,
					md,
					`chore(routines): add ${slug}`,
					repoConfig,
				);
				if (!ok) allOk = false;
			} else {
				const filePath = `src/content/life/routines/${slug}.md`;
				let sha = r.sha;
				if (!sha) {
					const f = await getRepoFile(filePath, repoConfig);
					if (f) sha = f.sha;
				}
				if (sha) {
					const ok = await updateRepoFile(
						filePath,
						md,
						sha,
						`chore(routines): update ${slug}`,
						repoConfig,
					);
					if (!ok) allOk = false;
				} else {
					const ok = await createRepoFile(
						filePath,
						md,
						`chore(routines): create ${slug}`,
						repoConfig,
					);
					if (!ok) allOk = false;
				}
			}
		}
		if (allOk) {
			showToast("保存成功！页面将刷新以应用更改", "success");
			hasChanges = false;
			setTimeout(() => window.location.reload(), 1200);
		} else {
			showToast("部分操作失败，请检查 GitHub App 权限配置", "error");
		}
		return allOk;
	} catch (err) {
		showToast("保存出错：" + (err as Error).message, "error");
		return false;
	} finally {
		saving = false;
	}
}

// 注册批量提交处理程序
registerSubmitHandler("routines", async (draft) => {
	if (draft.payload?.routines) {
		routines = draft.payload.routines;
		const ok = await handleSave();
		return ok;
	}
	return false;
});
</script>

<EditToast />

<div class="rt-edit-toolbar">
  <EditToolbar
    pageName="日常规划"
    mountTo=".page-header-toolbar-slot"
    {saving} {hasChanges}
    on:modeChange={(e) => handleModeChange(e)}
    on:add={handleAdd} on:submit={handleSave} on:saveDraft={() => handleSaveDraft()} on:cancel={handleCancel}
  />
</div>

{#if editMode}
  <div class="rt-edit-list">
    {#each routines as r, i (i + "-" + r.id)}
      {#if !r._deleted}
        <div class="rt-card" class:rt-card-draft={r._draft} class:rt-card-editing={editingIndex === i}>
          {#if editingIndex !== i}
            <div class="rt-card-actions">
              {#if i > 0}<button class="rt-action-btn rt-action-move" onclick={() => moveUp(i)} title="上移"><iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon></button>{/if}
              {#if i < routines.filter(x => !x._deleted).length - 1}<button class="rt-action-btn rt-action-move" onclick={() => moveDown(i)} title="下移"><iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon></button>{/if}
              <button class="rt-action-btn rt-action-edit" onclick={() => startEdit(i)} title="编辑"><iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon></button>
              <button class="rt-action-btn rt-action-delete" onclick={() => deleteItem(i)} title="删除"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon></button>
            </div>
            <div class="rt-card-display">
              <div class="rt-card-header">
                <div class="rt-icon-wrap"><span>{r.icon || "📌"}</span></div>
                <div class="rt-card-info">
                  <div class="rt-card-title-row">
                    <h3 class="rt-card-name">{r.name || "未命名"}</h3>
                    {#if r.time}<span class="rt-card-time">{r.time}</span>{/if}
                    {#if r._draft}<span class="rt-badge-draft">新增</span>{/if}
                  </div>
                  {#if r.description}<p class="rt-card-desc">{r.description}</p>{/if}
                </div>
              </div>
              {#if r.body}
                <div class="rt-card-body-preview">{@html marked.parse(r.body.slice(0, 300) + (r.body.length > 300 ? "..." : ""), { gfm: true, breaks: true })}</div>
              {/if}
            </div>
          {:else}
            <div class="rt-card-form">
              <div class="rt-form-header"><iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon><span>编辑规划</span>{#if r._draft}<span class="rt-badge-draft">新增</span>{/if}</div>
              <div class="rt-form-row">
                <div class="rt-form-group rt-form-group-icon">
                  <label>图标</label>
                  <div class="rt-icon-picker">
                    <input type="text" class="rt-input rt-input-icon" value={r.icon} oninput={(e) => updateField(i, "icon", (e.target as HTMLInputElement).value)} placeholder="📌" maxlength="4" />
                    <div class="rt-emoji-grid">
                      {#each emojiOptions as emoji}
                        <button type="button" class:rt-emoji-active={r.icon === emoji} onclick={() => updateField(i, "icon", emoji)}>{emoji}</button>
                      {/each}
                    </div>
                  </div>
                </div>
                <div class="rt-form-group">
                  <label>名称 *</label>
                  <input type="text" class="rt-input" value={r.name} oninput={(e) => updateField(i, "name", (e.target as HTMLInputElement).value)} placeholder="规划名称" />
                </div>
                <div class="rt-form-group">
                  <label>时间</label>
                  <input type="text" class="rt-input" value={r.time} oninput={(e) => updateField(i, "time", (e.target as HTMLInputElement).value)} placeholder="如：早上 7:00-8:00" />
                </div>
              </div>
              <div class="rt-form-group">
                <label>描述</label>
                <input type="text" class="rt-input" value={r.description} oninput={(e) => updateField(i, "description", (e.target as HTMLInputElement).value)} placeholder="简短描述" />
              </div>
              <div class="rt-form-group">
                <label>详细内容（Markdown）</label>
                <div class="rt-md-split">
                  <textarea class="rt-md-textarea" value={r.body} oninput={(e) => updateField(i, "body", (e.target as HTMLTextAreaElement).value)} placeholder="规划详细内容，支持 Markdown..." spellcheck="false"></textarea>
                  <div class="rt-md-preview">{@html editPreview}</div>
                </div>
              </div>
              <div class="rt-form-group">
                <label>更新日期</label>
                <input type="date" class="rt-input rt-input-date" value={r.updatedAt} oninput={(e) => updateField(i, "updatedAt", (e.target as HTMLInputElement).value)} />
              </div>
              <div class="rt-form-actions">
                <button class="rt-btn rt-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="rt-btn rt-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="rt-card rt-card-deleted">
          <div class="rt-deleted-info"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon><span>{r.name} 已标记删除</span></div>
          <button class="rt-btn rt-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}
    {#if routines.filter(r => !r._deleted).length === 0}
      <div class="rt-empty"><iconify-icon icon="material-symbols:checklist-outline-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon><p>暂无日常规划，点击"添加"创建</p></div>
    {/if}
  </div>
{/if}

<style>
  .rt-edit-toolbar { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  .rt-edit-list { display: flex; flex-direction: column; gap: 12px; }
  .rt-card {
    position: relative; border-radius: 16px; background: var(--card-bg, white);
    border: 2px solid #000; overflow: hidden; transition: all 0.2s;
  }
  :global(.dark) .rt-card { background: rgba(23,23,23,0.8); border-color: #3f3f46; }
  .rt-card:hover { border-color: var(--primary); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .rt-card-draft { border-style: dashed; border-color: hsla(var(--theme-hue,165),70%,50%,0.5); }
  .rt-card-editing { border-color: hsla(var(--theme-hue,165),70%,50%,0.6); box-shadow: 0 0 0 3px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .rt-card-deleted { opacity: 0.6; border-style: dashed; border-color: rgba(239,68,68,0.3); display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
  .rt-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
  .rt-card:hover .rt-card-actions { opacity: 1; }
  .rt-action-btn {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; border: none; cursor: pointer; font-size: 15px;
    backdrop-filter: blur(8px); transition: all 0.15s; color: white; background: rgba(100,116,139,0.9);
  }
  .rt-action-btn iconify-icon { display: flex; }
  .rt-action-btn:hover { transform: scale(1.1); background: rgba(71,85,105,1); }
  .rt-action-edit { background: rgba(59,130,246,0.9) !important; }
  .rt-action-edit:hover { background: rgba(37,99,235,1) !important; }
  .rt-action-delete { background: rgba(239,68,68,0.9) !important; }
  .rt-action-delete:hover { background: rgba(220,38,38,1) !important; }
  .rt-card-display { padding: 16px 20px; }
  .rt-card-header { display: flex; align-items: flex-start; gap: 12px; }
  .rt-icon-wrap { width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 12px; background: var(--btn-plain-bg-hover); font-size: 20px; flex-shrink: 0; }
  :global(.dark) .rt-icon-wrap { background: oklch(0.18 0 0); }
  .rt-card-info { flex: 1; min-width: 0; }
  .rt-card-title-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .rt-card-name { margin: 0; font-size: 16px; font-weight: 700; color: var(--deep-text); }
  .rt-card-time { display: inline-block; padding: 1px 8px; border-radius: 9999px; background: var(--btn-plain-bg-hover); color: var(--primary); font-size: 11px; font-weight: 600; }
  :global(.dark) .rt-card-time { background: oklch(0.18 0 0); }
  .rt-badge-draft { padding: 1px 8px; border-radius: 999px; background: hsl(var(--theme-hue,165),70%,50%); color: white; font-size: 11px; font-weight: 600; }
  .rt-card-desc { margin: 4px 0 0; font-size: 13px; color: var(--content-meta); line-height: 1.5; }
  .rt-card-body-preview { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line-divider); font-size: 12px; color: var(--content-meta); line-height: 1.6; max-height: 100px; overflow: hidden; }
  .rt-card-body-preview :global(p) { margin: 0.25rem 0; }
  .rt-deleted-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ef4444; }
  .rt-card-form { padding: 20px; }
  .rt-form-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: hsl(var(--theme-hue,165),70%,45%); }
  .rt-form-row { display: grid; grid-template-columns: 1fr 2fr 1fr; gap: 10px; margin-bottom: 10px; }
  .rt-form-group { margin-bottom: 10px; }
  .rt-form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary,#4b5563); margin-bottom: 4px; }
  :global(.dark) .rt-form-group label { color: #d1d5db; }
  .rt-input {
    width: 100%; padding: 7px 10px; border: 1.5px solid var(--border,#d1d5db); border-radius: 8px;
    font-size: 13px; background: var(--bg-color,white); color: var(--text-color,#1f2937);
    outline: none; transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
  }
  :global(.dark) .rt-input { background: #0f0f1a; border-color: #374151; color: #e5e7eb; }
  .rt-input:focus { border-color: hsl(var(--theme-hue,165),70%,50%); box-shadow: 0 0 0 2px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .rt-input-icon { text-align: center; font-size: 18px; }
  .rt-icon-picker { display: flex; flex-direction: column; gap: 6px; }
  .rt-emoji-grid { display: flex; flex-wrap: wrap; gap: 2px; }
  .rt-emoji-grid button { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid transparent; border-radius: 6px; background: transparent; cursor: pointer; font-size: 16px; transition: all 0.1s; padding: 0; }
  .rt-emoji-grid button:hover { background: var(--btn-plain-bg-hover); }
  .rt-emoji-active { background: hsl(var(--theme-hue,165),70%,50%,0.15) !important; border-color: hsl(var(--theme-hue,165),70%,50%) !important; }
  .rt-md-split { display: grid; grid-template-columns: 1fr 1fr; border: 1.5px solid var(--border,#d1d5db); border-radius: 8px; overflow: hidden; min-height: 150px; }
  :global(.dark) .rt-md-split { border-color: #374151; }
  .rt-md-textarea {
    width: 100%; padding: 10px; border: none; resize: vertical; font-family: "Cascadia Code","Fira Code",monospace;
    font-size: 12px; line-height: 1.6; background: var(--bg-color,#fafafa); color: var(--text-color,#1f2937);
    outline: none; min-height: 150px; box-sizing: border-box;
  }
  :global(.dark) .rt-md-textarea { background: #0d0d18; color: #e5e7eb; }
  .rt-md-preview { padding: 10px; overflow-y: auto; font-size: 12px; line-height: 1.6; color: var(--deep-text); border-left: 1px solid var(--border,#d1d5db); background: var(--card-bg,white); min-height: 150px; }
  :global(.dark) .rt-md-preview { border-left-color: #374151; background: rgba(23,23,23,0.5); }
  .rt-md-preview :global(h1),.rt-md-preview :global(h2),.rt-md-preview :global(h3) { margin: 0.5rem 0 0.25rem; font-size: 1em; }
  .rt-md-preview :global(p) { margin: 0.25rem 0; }
  .rt-md-preview :global(code) { background: var(--btn-plain-bg-hover); padding: 1px 4px; border-radius: 3px; font-size: 0.85em; }
  .rt-md-preview :global(pre) { background: var(--btn-plain-bg-hover); padding: 0.5rem; border-radius: 6px; overflow-x: auto; }
  .rt-md-preview :global(ul),.rt-md-preview :global(ol) { padding-left: 1.2em; margin: 0.25rem 0; }
  .rt-md-preview :global(blockquote) { border-left: 3px solid var(--primary); padding-left: 0.6rem; margin: 0.4rem 0; color: var(--content-meta); }
  .rt-form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .rt-btn { flex: 1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; display: flex; align-items: center; justify-content: center; font-family: inherit; }
  .rt-btn-cancel { background: var(--bg-secondary,#f3f4f6); color: var(--text-color,#374151); }
  .rt-btn-cancel:hover { background: var(--border,#e5e7eb); }
  :global(.dark) .rt-btn-cancel { background: #2d2d44; color: #d1d5db; }
  .rt-btn-save { background: hsl(var(--theme-hue,165),70%,50%); color: white; }
  .rt-btn-save:hover { background: hsl(var(--theme-hue,165),75%,45%); }
  .rt-btn-restore { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #22c55e; background: transparent; color: #22c55e; transition: all 0.15s; font-family: inherit; }
  .rt-btn-restore:hover { background: #22c55e; color: white; }
  .rt-empty { text-align: center; padding: 48px 20px; color: var(--content-meta,#9ca3af); font-size: 14px; border-radius: 16px; border: 2px dashed var(--border,rgba(0,0,0,0.1)); }
  @media (max-width: 640px) {
    .rt-form-row { grid-template-columns: 1fr; }
    .rt-form-group-icon { grid-column: 1; }
    .rt-md-split { grid-template-columns: 1fr; }
    .rt-md-preview { border-left: none; border-top: 1px solid var(--border,#d1d5db); }
  }
</style>
