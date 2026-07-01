<script lang="ts">
  import { onMount } from "svelte";
  import EditToolbar from "./EditToolbar.svelte";
  import EditToast from "./EditToast.svelte";
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

  interface PlaceItem {
    id: string;
    slug: string;
    province: string;
    city: string;
    district: string;
    experience: string;
    visitCount: number;
    date: string;
    body: string;
    sha?: string;
    _draft?: boolean;
    _deleted?: boolean;
  }

  let editMode = $state(false);
  let saving = $state(false);
  let hasChanges = $state(false);
  let places = $state<PlaceItem[]>([]);
  let originalPlaces = $state<PlaceItem[]>([]);
  let editingIndex = $state(-1);

  onMount(() => {
    ensureIconify();
    collectFromDOM();
    const draft = getDraft<any>("places");
    if (draft?.places) {
      if (confirm("发现未提交的旅行足迹草稿，是否恢复？")) {
        places = draft.places;
        hasChanges = true;
        showToast("草稿已恢复", "success");
      } else { deleteDraft("places"); }
    }
    window.addEventListener("blog:batch-submit", handleBatchSubmit);
    return () => window.removeEventListener("blog:batch-submit", handleBatchSubmit);
  });

  function htmlToMarkdown(html: string): string {
    if (!html) return "";
    return html
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "## $1\n")
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "### $1\n")
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "$1\n")
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**")
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*")
      .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`")
      .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
      .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();
  }

  function collectFromDOM() {
    const result: PlaceItem[] = [];
    document.querySelectorAll(".place-card").forEach((card, idx) => {
      const nameEl = card.querySelector(".place-name");
      const nameText = nameEl?.textContent?.trim() || "";
      const parts = nameText.split("·").map(s => s.trim());
      const province = parts[0] || "";
      const city = parts[1] || "";
      const expEl = card.querySelector(".place-exp");
      const experience = expEl?.textContent?.trim() || "";
      const metaDiv = card.querySelector(".text-right");
      const countText = metaDiv?.querySelector(".font-semibold")?.textContent?.trim() || "1";
      const visitCount = parseInt(countText.replace(/[^\d]/g, "")) || 1;
      const dateText = metaDiv?.querySelector("div:last-child")?.textContent?.trim() || "";
      const date = dateText || new Date().toISOString().slice(0, 10);
      const slug = date + "-" + genId("pl").slice(-4);
      result.push({
        id: genId("pl"),
        slug,
        province,
        city,
        district: "",
        experience,
        visitCount,
        date,
        body: "",
      });
    });
    places = result;
    originalPlaces = deepClone(result);
  }

  function hideSSRContent() {
    const mapSection = document.getElementById("life-map")?.closest("div.mb-6");
    const statsRow = document.querySelector(".stat-pill")?.parentElement;
    const listSection = document.querySelector(".places-grid")?.parentElement;
    const headings = document.querySelectorAll("h2.text-lg");
    if (mapSection) (mapSection as HTMLElement).style.display = "none";
    if (statsRow) (statsRow as HTMLElement).style.display = "none";
    headings.forEach(h => { if (h.textContent?.includes("足迹地图") || h.textContent?.includes("地点列表")) (h as HTMLElement).style.display = "none"; });
  }

  function showSSRContent() {
    const mapSection = document.getElementById("life-map")?.closest("div.mb-6");
    const statsRow = document.querySelector(".stat-pill")?.parentElement;
    const headings = document.querySelectorAll("h2.text-lg");
    if (mapSection) (mapSection as HTMLElement).style.display = "";
    if (statsRow) (statsRow as HTMLElement).style.display = "";
    headings.forEach(h => { (h as HTMLElement).style.display = ""; });
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
    places = deepClone(originalPlaces);
    hasChanges = false;
    editingIndex = -1;
    showSSRContent();
  }

  function startEdit(index: number) { editingIndex = index; }

  function updateField(index: number, field: keyof PlaceItem, value: string | number) {
    places[index] = { ...places[index], [field]: value };
    places = [...places];
    hasChanges = true;
  }

  function finishEdit(index: number) {
    const p = places[index];
    if (!p.province.trim()) { showToast("省份不能为空", "warning"); return; }
    editingIndex = -1;
    hasChanges = true;
    showToast("已修改，记得点击保存", "info");
  }

  function cancelItemEdit(index: number) {
    const p = places[index];
    if (p._draft && !p.province.trim()) {
      places = places.filter((_, i) => i !== index);
    } else if (originalPlaces) {
      const orig = originalPlaces.find(o => o.slug === p.slug && !p._draft);
      if (orig) { places[index] = deepClone(orig); places = [...places]; }
    }
    editingIndex = -1;
  }

  function deleteItem(index: number) {
    const p = places[index];
    if (!confirm(`确定要删除「${p.province}${p.city ? " · " + p.city : ""}」吗？`)) return;
    if (p._draft) { places = places.filter((_, i) => i !== index); }
    else { places[index] = { ...places[index], _deleted: true }; places = [...places]; }
    hasChanges = true;
    if (editingIndex === index) editingIndex = -1;
    else if (editingIndex > index) editingIndex--;
    showToast("已标记删除，记得点击保存", "info");
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    const arr = [...places];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    places = arr; hasChanges = true;
  }

  function moveDown(index: number) {
    if (index >= places.length - 1) return;
    const arr = [...places];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    places = arr; hasChanges = true;
  }

  function restoreItem(index: number) {
    places[index] = { ...places[index], _deleted: false };
    places = [...places]; hasChanges = true;
  }

  function handleAdd() {
    places = [{
      id: genId("pl"),
      slug: "",
      province: "",
      city: "",
      district: "",
      experience: "",
      visitCount: 1,
      date: new Date().toISOString().slice(0, 10),
      body: "",
      _draft: true,
    }, ...places];
    editingIndex = 0;
    hasChanges = true;
  }

  function slugify(text: string): string {
    return text.toLowerCase().trim().replace(/[\s]+/g, "-").replace(/[^\w\u4e00-\u9fa5-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "") || "place";
  }

  function buildPlaceMd(p: PlaceItem): string {
    const lines = ["---"];
    lines.push(`date: ${p.date}`);
    lines.push(`province: "${p.province.replace(/"/g, '\\"')}"`);
    if (p.city) lines.push(`city: "${p.city.replace(/"/g, '\\"')}"`);
    if (p.district) lines.push(`district: "${p.district.replace(/"/g, '\\"')}"`);
    if (p.experience) lines.push(`experience: "${p.experience.replace(/"/g, '\\"')}"`);
    lines.push(`visitCount: ${p.visitCount}`);
    lines.push("---");
    if (p.body && p.body.trim()) {
      lines.push("");
      lines.push(p.body.trim());
      lines.push("");
    }
    return lines.join("\n");
  }

  function handleSaveDraft() {
    saveDraft({
      pageKey: "places",
      pageName: "旅行足迹",
      description: `共 ${places.length} 个地点`,
      operation: "update",
      payload: { places },
    });
    showToast("旅行足迹草稿已保存", "success");
  }
  async function handleBatchSubmit() {
    const draft = getDraft<any>("places");
    if (draft?.places) { places = draft.places; await handleSave(); if (!saving) deleteDraft("places"); }
  }

  async function handleSave(): Promise<boolean> {
    if (!hasValidToken()) { showToast("GitHub 代理未配置，请联系管理员", "warning"); return false; }
    saving = true;
    try {
      let allOk = true;
      for (let i = 0; i < places.length; i++) {
        const p = places[i];
        if (p._deleted) {
          if (p.slug && !p._draft) {
            const filePath = `src/content/life/places/${p.slug}.md`;
            const file = await getRepoFile(filePath, repoConfig);
            if (file && file.sha) {
              const ok = await deleteRepoFile(filePath, file.sha, `chore(places): remove ${p.slug}`, repoConfig);
              if (!ok) allOk = false;
            }
          }
          continue;
        }
        const md = buildPlaceMd(p);
        let slug = p.slug;
        if (p._draft || !slug) {
          slug = `${p.date}-${slugify(p.province + p.city).slice(0, 20)}`;
          const ok = await createRepoFile(`src/content/life/places/${slug}.md`, md, `chore(places): add ${slug}`, repoConfig);
          if (!ok) allOk = false;
        } else {
          const filePath = `src/content/life/places/${slug}.md`;
          let sha = p.sha;
          if (!sha) { const f = await getRepoFile(filePath, repoConfig); if (f) sha = f.sha; }
          if (sha) { const ok = await updateRepoFile(filePath, md, sha, `chore(places): update ${slug}`, repoConfig); if (!ok) allOk = false; }
          else { const ok = await createRepoFile(filePath, md, `chore(places): create ${slug}`, repoConfig); if (!ok) allOk = false; }
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
  registerSubmitHandler("places", async (draft) => {
    if (draft.payload?.type === "gist") return false; // places 不使用 gist
    if (draft.payload?.places) {
      places = draft.payload.places;
      const ok = await handleSave();
      return ok;
    }
    return false;
  });
</script>

<EditToast />

<div class="pl-edit-toolbar">
  <EditToolbar
    pageName="旅行足迹"
    mountTo=".page-header-toolbar-slot"
    {saving}
    {hasChanges}
    on:modeChange={(e) => handleModeChange(e)}
    on:add={handleAdd}
    on:submit={handleSave}
    on:saveDraft={() => handleSaveDraft()}
    on:cancel={handleCancel}
  />
</div>

{#if editMode}
  <div class="pl-edit-list">
    {#each places as p, i (i + "-" + p.id)}
      {#if !p._deleted}
        <div class="pl-card" class:pl-card-draft={p._draft} class:pl-card-editing={editingIndex === i}>
          {#if editingIndex !== i}
            <div class="pl-card-actions">
              {#if i > 0}<button class="pl-action-btn pl-action-move" onclick={() => moveUp(i)} title="上移"><iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon></button>{/if}
              {#if i < places.filter(x => !x._deleted).length - 1}<button class="pl-action-btn pl-action-move" onclick={() => moveDown(i)} title="下移"><iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon></button>{/if}
              <button class="pl-action-btn pl-action-edit" onclick={() => startEdit(i)} title="编辑"><iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon></button>
              <button class="pl-action-btn pl-action-delete" onclick={() => deleteItem(i)} title="删除"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon></button>
            </div>
            <div class="pl-card-display">
              <div class="pl-card-meta">
                <iconify-icon icon="material-symbols:location-on-rounded" style="color:#ef4444;"></iconify-icon>
                <span class="pl-card-name">{p.province || "未知省份"}{p.city ? ` · ${p.city}` : ""}</span>
                <span class="pl-card-count">到访 {p.visitCount} 次</span>
                <span class="pl-card-date">{p.date}</span>
                {#if p._draft}<span class="pl-badge-draft">新增</span>{/if}
              </div>
              {#if p.experience}<p class="pl-card-exp">{p.experience}</p>{/if}
            </div>
          {:else}
            <div class="pl-card-form">
              <div class="pl-form-header"><iconify-icon icon="material-symbols:edit-location-alt-rounded"></iconify-icon><span>编辑地点</span>{#if p._draft}<span class="pl-badge-draft">新增</span>{/if}</div>
              <div class="pl-form-row">
                <div class="pl-form-group"><label>省份 *</label><input type="text" class="pl-input" value={p.province} oninput={(e) => updateField(i, "province", (e.target as HTMLInputElement).value)} placeholder="如：浙江" /></div>
                <div class="pl-form-group"><label>城市</label><input type="text" class="pl-input" value={p.city} oninput={(e) => updateField(i, "city", (e.target as HTMLInputElement).value)} placeholder="如：杭州" /></div>
              </div>
              <div class="pl-form-row">
                <div class="pl-form-group"><label>区/县</label><input type="text" class="pl-input" value={p.district} oninput={(e) => updateField(i, "district", (e.target as HTMLInputElement).value)} placeholder="如：西湖区" /></div>
                <div class="pl-form-group"><label>日期</label><input type="date" class="pl-input" value={p.date} oninput={(e) => updateField(i, "date", (e.target as HTMLInputElement).value)} /></div>
                <div class="pl-form-group"><label>到访次数</label><input type="number" class="pl-input" min="1" value={p.visitCount} oninput={(e) => updateField(i, "visitCount", parseInt((e.target as HTMLInputElement).value) || 1)} /></div>
              </div>
              <div class="pl-form-group"><label>体验/备注</label><input type="text" class="pl-input" value={p.experience} oninput={(e) => updateField(i, "experience", (e.target as HTMLInputElement).value)} placeholder="旅行体验描述" /></div>
              <div class="pl-form-actions">
                <button class="pl-btn pl-btn-cancel" onclick={() => cancelItemEdit(i)}>取消</button>
                <button class="pl-btn pl-btn-save" onclick={() => finishEdit(i)}>完成</button>
              </div>
            </div>
          {/if}
        </div>
      {:else}
        <div class="pl-card pl-card-deleted">
          <div class="pl-deleted-info"><iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon><span>{p.province}{p.city ? ` · ${p.city}` : ""} 已标记删除</span></div>
          <button class="pl-btn pl-btn-restore" onclick={() => restoreItem(i)}>撤销删除</button>
        </div>
      {/if}
    {/each}
    {#if places.filter(p => !p._deleted).length === 0}
      <div class="pl-empty"><iconify-icon icon="material-symbols:explore-off-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon><p>暂无地点记录，点击"添加"创建</p></div>
    {/if}
  </div>
{/if}

<style>
  .pl-edit-toolbar { display: flex; justify-content: flex-end; margin-bottom: 4px; }
  .pl-edit-list { display: flex; flex-direction: column; gap: 8px; }
  .pl-card {
    position: relative; border-radius: 16px; background: var(--card-bg, white);
    border: 2px solid #000; overflow: hidden; transition: all 0.2s;
  }
  :global(.dark) .pl-card { background: rgba(23,23,23,0.8); border-color: #3f3f46; }
  .pl-card:hover { border-color: var(--primary); box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
  .pl-card-draft { border-style: dashed; border-color: hsla(var(--theme-hue,165),70%,50%,0.5); }
  .pl-card-editing { border-color: hsla(var(--theme-hue,165),70%,50%,0.6); box-shadow: 0 0 0 3px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .pl-card-deleted { opacity: 0.6; border-style: dashed; border-color: rgba(239,68,68,0.3); display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; }
  .pl-card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 4px; z-index: 10; opacity: 0; transition: opacity 0.2s; }
  .pl-card:hover .pl-card-actions { opacity: 1; }
  .pl-action-btn {
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; border: none; cursor: pointer; font-size: 15px;
    backdrop-filter: blur(8px); transition: all 0.15s; color: white; background: rgba(100,116,139,0.9);
  }
  .pl-action-btn iconify-icon { display: flex; }
  .pl-action-btn:hover { transform: scale(1.1); }
  .pl-action-move:hover { background: rgba(71,85,105,1); }
  .pl-action-edit { background: rgba(59,130,246,0.9) !important; }
  .pl-action-edit:hover { background: rgba(37,99,235,1) !important; }
  .pl-action-delete { background: rgba(239,68,68,0.9) !important; }
  .pl-action-delete:hover { background: rgba(220,38,38,1) !important; }
  .pl-card-display { padding: 14px 20px; }
  .pl-card-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pl-card-name { font-size: 15px; font-weight: 700; color: var(--deep-text); }
  .pl-card-count { font-size: 12px; font-weight: 600; color: var(--primary); }
  .pl-card-date { font-size: 12px; color: var(--content-meta); margin-left: auto; padding-right: 80px; }
  .pl-badge-draft { padding: 1px 8px; border-radius: 999px; background: hsl(var(--theme-hue,165),70%,50%); color: white; font-size: 11px; font-weight: 600; }
  .pl-card-exp { margin: 6px 0 0; font-size: 13px; color: var(--content-meta); line-height: 1.5; padding-right: 80px; }
  .pl-deleted-info { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #ef4444; }
  .pl-card-form { padding: 20px; }
  .pl-form-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 14px; font-weight: 600; color: hsl(var(--theme-hue,165),70%,45%); }
  .pl-form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .pl-form-group { margin-bottom: 10px; }
  .pl-form-group label { display: block; font-size: 12px; font-weight: 600; color: var(--text-secondary,#4b5563); margin-bottom: 4px; }
  :global(.dark) .pl-form-group label { color: #d1d5db; }
  .pl-input {
    width: 100%; padding: 7px 10px; border: 1.5px solid var(--border,#d1d5db); border-radius: 8px;
    font-size: 13px; background: var(--bg-color,white); color: var(--text-color,#1f2937);
    outline: none; transition: border-color 0.2s; box-sizing: border-box; font-family: inherit;
  }
  :global(.dark) .pl-input { background: #0f0f1a; border-color: #374151; color: #e5e7eb; }
  .pl-input:focus { border-color: hsl(var(--theme-hue,165),70%,50%); box-shadow: 0 0 0 2px hsla(var(--theme-hue,165),70%,50%,0.1); }
  .pl-form-actions { display: flex; gap: 8px; margin-top: 16px; }
  .pl-btn { flex: 1; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.15s; border: none; display: flex; align-items: center; justify-content: center; font-family: inherit; }
  .pl-btn-cancel { background: var(--bg-secondary,#f3f4f6); color: var(--text-color,#374151); }
  .pl-btn-cancel:hover { background: var(--border,#e5e7eb); }
  :global(.dark) .pl-btn-cancel { background: #2d2d44; color: #d1d5db; }
  .pl-btn-save { background: hsl(var(--theme-hue,165),70%,50%); color: white; }
  .pl-btn-save:hover { background: hsl(var(--theme-hue,165),75%,45%); }
  .pl-btn-restore { padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; border: 1px solid #22c55e; background: transparent; color: #22c55e; transition: all 0.15s; font-family: inherit; }
  .pl-btn-restore:hover { background: #22c55e; color: white; }
  .pl-empty { text-align: center; padding: 48px 20px; color: var(--content-meta,#9ca3af); font-size: 14px; border-radius: 16px; border: 2px dashed var(--border,rgba(0,0,0,0.1)); }
  @media (max-width: 640px) { .pl-form-row { grid-template-columns: 1fr; } .pl-card-date, .pl-card-exp { padding-right: 0; } }
</style>
