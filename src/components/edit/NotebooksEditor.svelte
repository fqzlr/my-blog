<script lang="ts">
  import { onMount } from "svelte";
  import EditToolbar from "./EditToolbar.svelte";
  import EditToast from "./EditToast.svelte";
  import {
    hasValidToken,
    showToast,
    ensureIconify,
    getRepoFile,
    createRepoFile,
    updateRepoFile,
    deleteRepoFile,
    genId,
    deepClone,
  } from "@/utils/editMode";
  import { repoConfig } from "@/config/editConfig";

  interface NotebookItem {
    id: string;
    folderName: string;
    name: string;
    summary: string;
    cover: string;
    entries: number;
    updatedAt: string;
    _draft?: boolean;
    _deleted?: boolean;
  }

  let editMode = $state(false);
  let saving = $state(false);
  let hasChanges = $state(false);
  let notebooks = $state<NotebookItem[]>([]);
  let originalNotebooks = $state<NotebookItem[]>([]);
  let editingIndex = $state(-1);

  onMount(() => {
    ensureIconify();
    collectFromDOM();
  });

  function collectFromDOM() {
    const result: NotebookItem[] = [];
    document.querySelectorAll(".diary-notebook").forEach((card) => {
      const link = card as HTMLAnchorElement;
      const href = link.getAttribute("href") || "";
      const folderName = href.replace(/\/$/, "").split("/").pop() || "";
      const nameEl = card.querySelector(".diary-cover-name");
      const name = nameEl?.textContent?.trim() || "";
      const descEl = card.querySelector(".diary-cover-desc");
      const summary = descEl?.textContent?.trim() || "";
      const img = card.querySelector("img.diary-cover-img") as HTMLImageElement | null;
      const cover = img?.src || "";
      const metaEl = card.querySelector(".diary-cover-meta");
      const entriesText = metaEl?.textContent?.trim() || "0";
      const entries = parseInt(entriesText.replace(/[^\d]/g, "")) || 0;
      const dateSpan = card.querySelector(".diary-notebook-footer span");
      const updatedAt = dateSpan?.textContent?.trim() || "";
      result.push({
        id: genId("nb"),
        folderName,
        name,
        summary,
        cover: isExternalUrl(cover) ? cover : "",
        entries,
        updatedAt,
      });
    });
    notebooks = result;
    originalNotebooks = deepClone(result);
  }

  function isExternalUrl(url: string): boolean {
    return url.startsWith("http://") || url.startsWith("https://");
  }

  function hideSSRContent() {
    const grid = document.querySelector(".diary-grid");
    if (grid) (grid as HTMLElement).style.display = "none";
    const empty = document.querySelector(".diary-empty");
    if (empty) (empty as HTMLElement).style.display = "none";
    const footer = document.querySelector(".diary-page section:last-child");
    if (footer) (footer as HTMLElement).style.display = "none";
  }

  function showSSRContent() {
    const grid = document.querySelector(".diary-grid");
    if (grid) (grid as HTMLElement).style.display = "";
    const empty = document.querySelector(".diary-empty");
    if (empty) (empty as HTMLElement).style.display = "";
    const footer = document.querySelector(".diary-page section:last-child");
    if (footer) (footer as HTMLElement).style.display = "";
  }

  function handleModeChange(e: CustomEvent) {
    editMode = e.detail.editing;
    if (editMode) { hideSSRContent(); editingIndex = -1; }
    else { showSSRContent(); }
  }

  function handleCancel() {
    notebooks = deepClone(originalNotebooks);
    hasChanges = false; editingIndex = -1; showSSRContent();
  }

  function startEdit(index: number) { editingIndex = index; }

  function updateField(index: number, field: keyof NotebookItem, value: string | number) {
    notebooks[index] = { ...notebooks[index], [field]: value };
    notebooks = [...notebooks];
    hasChanges = true;
  }

  function finishEdit(index: number) {
    const n = notebooks[index];
    if (!n.name.trim()) { showToast("笔记本名称不能为空", "warning"); return; }
    editingIndex = -1; hasChanges = true;
    showToast("已修改，记得点击保存", "info");
  }

  function cancelItemEdit(index: number) {
    const n = notebooks[index];
    if (n._draft && !n.name.trim()) {
      notebooks = notebooks.filter((_, i) => i !== index);
    } else {
      const orig = originalNotebooks.find(o => o.folderName === n.folderName && !n._draft);
      if (orig) { notebooks[index] = deepClone(orig); notebooks = [...notebooks]; }
    }
    editingIndex = -1;
  }

  function deleteItem(index: number) {
    const n = notebooks[index];
    if (!confirm(`确定要删除笔记本「${n.name}」吗？\n注意：这只会删除 _index.json 元数据，不会删除笔记内容文件。`)) return;
    if (n._draft) { notebooks = notebooks.filter((_, i) => i !== index); }
    else { notebooks[index] = { ...notebooks[index], _deleted: true }; notebooks = [...notebooks]; }
    hasChanges = true;
    if (editingIndex === index) editingIndex = -1;
    else if (editingIndex > index) editingIndex--;
    showToast("已标记删除，记得点击保存", "info");
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const arr = [...notebooks]; [arr[index-1], arr[index]] = [arr[index], arr[index-1]];
    notebooks = arr; hasChanges = true;
  }

  function moveDown(index: number) {
    if (index >= notebooks.length - 1) return;
    const arr = [...notebooks]; [arr[index], arr[index+1]] = [arr[index+1], arr[index]];
    notebooks = arr; hasChanges = true;
  }

  function restoreItem(index: number) {
    notebooks[index] = { ...notebooks[index], _deleted: false };
    notebooks = [...notebooks]; hasChanges = true;
  }

  function handleAdd() {
    const folderName = "notebook-" + Date.now().toString(36);
    notebooks = [{
      id: genId("nb"), folderName, name: "", summary: "", cover: "",
      entries: 0, updatedAt: new Date().toISOString().slice(0,10), _draft: true,
    }, ...notebooks];
    editingIndex = 0; hasChanges = true;
  }

  function buildIndexJson(n: NotebookItem): string {
    const obj: Record<string, string> = { name: n.name };
    if (n.summary) obj.summary = n.summary;
    if (n.cover) obj.cover = n.cover;
    return JSON.stringify(obj, null, "\t") + "\n";
  }

  async function handleSave() {
    if (!hasValidToken()) { showToast("GitHub 代理未配置，请联系管理员", "warning"); return; }
    saving = true;
    try {
      let allOk = true;
      for (let i = 0; i < notebooks.length; i++) {
        const n = notebooks[i];
        const filePath = `src/content/life/notebooks/${n.folderName}/_index.json`;

        if (n._deleted) {
          const file = await getRepoFile(filePath, repoConfig);
          if (file && file.sha) {
            const ok = await deleteRepoFile(filePath, file.sha, `chore(notebooks): remove ${n.folderName} index`, repoConfig);
            if (!ok) allOk = false;
          }
          continue;
        }

        const content = buildIndexJson(n);
        let folderName = n.folderName;

        if (n._draft) {
          folderName = "notebook-" + Date.now().toString(36) + "-" + slugify(n.name).slice(0, 20);
          const folderPath = `src/content/life/notebooks/${folderName}/`;
          const readmePath = folderPath + "README.md";
          const indexPath = folderPath + "_index.json";
          const okIdx = await createRepoFile(indexPath, content, `chore(notebooks): add ${folderName} notebook`, repoConfig);
          const okReadme = await createRepoFile(readmePath, `# ${n.name}\n\n${n.summary}\n`, `chore(notebooks): init ${folderName} readme`, repoConfig);
          if (!okIdx || !okReadme) allOk = false;
        } else {
          let sha = "";
          const file = await getRepoFile(filePath, repoConfig);
          if (file) sha = file.sha;
          if (sha) {
            const ok = await updateRepoFile(filePath, content, sha, `chore(notebooks): update ${folderName}`, repoConfig);
            if (!ok) allOk = false;
          } else {
            const ok = await createRepoFile(filePath, content, `chore(notebooks): create ${folderName} index`, repoConfig);
            if (!ok) allOk = false;
          }
        }
      }
      if (allOk) {
        showToast("保存成功！页面将刷新以应用更改", "success");
        hasChanges = false;
        setTimeout(() => window.location.reload(), 1200);
      } else { showToast("部分操作失败，请检查 GitHub App 权限配置", "error"); }
    } catch (err) { showToast("保存出错：" + (err as Error).message, "error"); }
    saving = false;
  }

  function slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[\s]+/g,"-").replace(/[^\w\u4e00-\u9fa5-]/g,"").replace(/-+/g,"-").replace(/^-|-$/g,"") || "notebook";
  }
</script>

<EditToast />

<div class="nb-edit-toolbar">
  <EditToolbar
    pageName="笔记本"
    mountTo=".page-header-toolbar-slot"
    {saving} {hasChanges}
    on:modeChange={(e) => handleModeChange(e)}
    on:add={handleAdd} on:save={handleSave} on:cancel={handleCancel}
  />
</div>

{#if editMode}
  <div class="nb-edit-grid">
    {#each notebooks as n, i (i + "-" + n.id)}
      {#if !n._deleted}
        <div class="nb-card" class:nb-card-draft={n._draft} class:nb-card-editing={editingIndex === i}>
          {#if editingIndex !== i}
            <div class="nb-card-actions">
              {#if i > 0}<button class="nb-action-btn nb-action-move" onclick={() => moveUp(i)} title="上移"><iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon></button>{/if}
              {#if i < notebooks.filter(x => !x._deleted).length - 1}<button class="nb-action-btn nb-action-move" onclick={() => moveDown(i)} title="下移"><iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon></button>{/if}
              <button class="nb-action-btn nb-action-edit" onclick={() => startEdit(i)} title="编辑"><iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon></button>
              <button class="nb-action-btn nb-action-delete" onclick={() => deleteItem(i)} title="删除"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon></button>
            </div>
            <div class="nb-card-display">
              <div class="nb-cover-area">
                {#if n.cover && isExternalUrl(n.cover)}
                  <img src={n.cover} alt={n.name} class="nb-cover-img" />
                {:else}
                  <div class="nb-cover-placeholder"><span>📔</span></div>
                {/if}
              </div>
              <div class="nb-card-text">
                <div class="nb-card-meta">
                  <span class="nb-tag">笔记</span>
                  <span class="nb-meta">{n.entries} 篇</span>
                  {#if n._draft}<span class="nb-badge-draft">新增</span>{/if}
                </div>
                <h3 class="nb-card-name">{n.name || "未命名笔记本"}</h3>
                <p class="nb-card-desc">{n.summary || "暂无描述"}</p>
                <div class="nb-card-footer">
                  <span class="nb-date">{n.updatedAt || "未更新"}</span>
                  <iconify-icon icon="material-symbols:chevron-right-rounded"></iconify-icon>
                </div>
              </div>
            </div>
          {:else}
            <div class="nb-card-form">
              <div class="nb-form-header"><iconify-icon icon="material-symbols:book-edit-outline-rounded"></iconify-icon><span>编辑笔记本</span>{#if n._draft}<span class="nb-badge-draft">新增</span>{/if}</div>
              <div class="nb-form-group">
                <label>笔记本名称 *</label>
                <input type="text" class="nb-input" value={n.name} oninput={(e) => updateField(i, "name", (e.target as HTMLInputElement).value)} placeholder="笔记本名称" />
              </div>
              <div class="nb-form-group">
                <label>封面图片 URL</label>
                <input type="text" class="nb-input" value={n.cover} oninput={(e) => updateField(i, "cover", (e.target as HTMLInputElement).value)} placeholder="网络图片URL，留空使用默认封面" />
                {#if n.cover && isExternalUrl(n.cover)}
                  <img src={n.cover} alt="预览" class="nb-cover-preview" />
                {/if}
              </div>
              <div class="nb-form-group">
                <label>描述</label>
                <textarea class="nb-textarea" value={n.summary} oninput={(e) => updateField(i, "summary", (e.target as HTMLTextAreaElement).value)} placeholder="笔记本简介" rows="2"></textarea>
              </div>
              <div class="nb-form-actions">
                <button class="nb-btn nb-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="nb-btn nb-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="nb-card nb-card-deleted">
          <div class="nb-deleted-info"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon><span>{n.name} 已标记删除</span></div>
          <button class="nb-btn nb-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}
    {#if notebooks.filter(n => !n._deleted).length === 0}
      <div class="nb-empty"><iconify-icon icon="material-symbols:menu-book-outline-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon><p>暂无笔记本，点击"添加"创建</p></div>
    {/if}
  </div>
{/if}

<style>
  .nb-edit-toolbar { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  .nb-edit-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.5rem; }
  .nb-card {
    position: relative; display: flex; flex-direction: column; text-decoration: none;
    border-radius: var(--radius-xl); overflow: hidden; background: var(--card-bg,white);
    border: 1px solid var(--line-divider); transition: all 0.2s;
  }
  :global(.dark) .nb-card { background: rgba(23,23,23,0.8); }
  .nb-card:hover { border-color: hsla(var(--theme-hue,165),70%,50%,0.3); }
  .nb-card-draft { border-style: dashed; border-color: hsla(var(--theme-hue,165),70%,50%,0.5); }
  .nb-card-editing { grid-column: 1 / -1; border-color: hsla(var(--theme-hue,165),70%,50%,0.6); box-shadow: 0 0 0 3px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .nb-card-deleted { opacity: 0.6; border-style: dashed; border-color: rgba(239,68,68,0.3); display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; grid-column: 1 / -1; }
  .nb-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
  .nb-card:hover .nb-card-actions { opacity: 1; }
  .nb-action-btn {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; border: none; cursor: pointer; font-size: 15px;
    backdrop-filter: blur(8px); transition: all 0.15s; color: white; background: rgba(100,116,139,0.9);
  }
  .nb-action-btn iconify-icon { display: flex; }
  .nb-action-btn:hover { transform: scale(1.1); background: rgba(71,85,105,1); }
  .nb-action-edit { background: rgba(59,130,246,0.9) !important; }
  .nb-action-edit:hover { background: rgba(37,99,235,1) !important; }
  .nb-action-delete { background: rgba(239,68,68,0.9) !important; }
  .nb-action-delete:hover { background: rgba(220,38,38,1) !important; }
  .nb-card-display { display: flex; flex-direction: column; }
  .nb-cover-area { position: relative; aspect-ratio: 2/1; overflow: hidden; background: linear-gradient(135deg,var(--card-bg) 0%,color-mix(in srgb,var(--primary) 8%,var(--card-bg)) 100%); }
  .nb-cover-img { width: 100%; height: 100%; object-fit: cover; }
  .nb-cover-placeholder { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 3.5rem; opacity: 0.35; }
  .nb-card-text { padding: 1.25rem 1.25rem 0.75rem; position: relative; }
  .nb-card-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .nb-tag { padding: 2px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; background: color-mix(in srgb,var(--primary) 20%,transparent); color: var(--primary); }
  .nb-meta { font-size: 12px; color: var(--content-meta); }
  .nb-badge-draft { padding: 1px 8px; border-radius: 999px; background: hsl(var(--theme-hue,165),70%,50%); color: white; font-size: 11px; font-weight: 600; }
  .nb-card-name { margin: 0; font-size: 18px; font-weight: 700; color: var(--deep-text); line-height: 1.3; }
  .nb-card-desc { margin: 4px 0 0; font-size: 13px; color: var(--content-meta); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .nb-card-footer { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.25rem; margin-top: auto; border-top: 1px solid var(--line-divider); color: var(--content-meta); font-size: 12px; }
  .nb-deleted-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ef4444; }
  .nb-card-form { padding: 20px; }
  .nb-form-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: hsl(var(--theme-hue,165),70%,45%); }
  .nb-form-group { margin-bottom: 12px; }
  .nb-form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary,#4b5563); margin-bottom: 4px; }
  :global(.dark) .nb-form-group label { color: #d1d5db; }
  .nb-input, .nb-textarea {
    width: 100%; padding: 8px 12px; border: 1.5px solid var(--border,#d1d5db); border-radius: 8px;
    font-size: 13px; background: var(--bg-color,white); color: var(--text-color,#1f2937);
    outline: none; transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
  }
  :global(.dark) .nb-input, :global(.dark) .nb-textarea { background: #0f0f1a; border-color: #374151; color: #e5e7eb; }
  .nb-input:focus, .nb-textarea:focus { border-color: hsl(var(--theme-hue,165),70%,50%); box-shadow: 0 0 0 2px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .nb-textarea { resize: vertical; min-height: 60px; }
  .nb-cover-preview { margin-top: 8px; max-width: 200px; max-height: 100px; border-radius: 8px; object-fit: cover; }
  .nb-form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .nb-btn { flex: 1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; display: flex; align-items: center; justify-content: center; font-family: inherit; }
  .nb-btn-cancel { background: var(--bg-secondary,#f3f4f6); color: var(--text-color,#374151); }
  .nb-btn-cancel:hover { background: var(--border,#e5e7eb); }
  :global(.dark) .nb-btn-cancel { background: #2d2d44; color: #d1d5db; }
  .nb-btn-save { background: hsl(var(--theme-hue,165),70%,50%); color: white; }
  .nb-btn-save:hover { background: hsl(var(--theme-hue,165),75%,45%); }
  .nb-btn-restore { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #22c55e; background: transparent; color: #22c55e; transition: all 0.15s; font-family: inherit; }
  .nb-btn-restore:hover { background: #22c55e; color: white; }
  .nb-empty { grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--content-meta,#9ca3af); font-size: 14px; border-radius: var(--radius-3xl); border: 2px dashed var(--line-divider); }
</style>
