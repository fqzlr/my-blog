<script lang="ts">
  import { onMount } from "svelte";
  import EditToolbar from "./EditToolbar.svelte";
  import EditToast from "./EditToast.svelte";
  import {
    showToast,
    ensureIconify,
    getRepoFile,
    genId,
    deepClone,
  } from "@/utils/editMode";
  import { setupRepoDrafts } from "@/utils/draftHelpers";
  import { repoConfig } from "@/config/editConfig";

  interface SponsorMethod {
    id: string;
    name: string;
    icon?: string;
    qrCode?: string;
    link?: string;
    description?: string;
    enabled: boolean;
    _draft?: boolean;
    _deleted?: boolean;
  }

  interface SponsorItem {
    id: string;
    name: string;
    amount?: string;
    date?: string;
    avatar?: string;
    _draft?: boolean;
    _deleted?: boolean;
  }

  interface SponsorState {
    title: string;
    description: string;
    usage: string;
    showSponsorsList: boolean;
    methods: SponsorMethod[];
    sponsors: SponsorItem[];
  }

  let editMode = $state(false);
  let saving = $state(false);
  let editingMethod = $state(-1);
  let editingSponsor = $state(-1);
  let state = $state<SponsorState>({
    title: "",
    description: "",
    usage: "",
    showSponsorsList: true,
    methods: [],
    sponsors: [],
  });
  let originalState = $state<SponsorState | null>(null);
  let activeTab = $state<"methods" | "sponsors">("methods");
  let fileSha = $state<string | null>(null);
  let originalCodeContent = $state("");

  const filePath = "src/config/sponsorConfig.ts";

  const drafts = setupRepoDrafts({
    pageKey: "sponsor",
    pageName: "赞助页面",
    getContent: () => generateConfigTs(),
    setContent: () => {},
    getPath: () => filePath,
    getSha: () => fileSha,
    setSha: (v) => (fileSha = v),
    getOriginalContent: () => originalCodeContent,
    setOriginalContent: (v) => { originalCodeContent = v; originalState = deepClone(state); },
    getCommitMsg: (isEdit) => isEdit ? "chore(sponsor): 更新赞助配置" : "chore(sponsor): 创建赞助配置",
    onSubmitted: () => {
      setTimeout(() => window.location.reload(), 1200);
    },
  });
  let hasChanges = $derived(drafts.hasLocalChanges());

  onMount(() => {
    ensureIconify();
    collectFromDOM();
    initRepoState();
  });

  function collectFromDOM() {
    // 从页面头部收集基本信息
    const titleEl = document.querySelector("h1[data-pagefind-meta='title']");
    const descEl = document.querySelector("p.text-base.text-neutral-600");
    const usageBox = document.querySelector(".usage-info-box p");

    // 收集赞助方式
    const methods: SponsorMethod[] = [];
    const tabBtns = document.querySelectorAll("[data-sponsor-tab]");
    tabBtns.forEach((btn) => {
      const idx = parseInt((btn as HTMLElement).dataset.sponsorTab || "0");
      const name = btn.textContent?.trim() || "";
      const iconEl = btn.querySelector("iconify-icon, [class*='icon']");
      const icon = iconEl?.getAttribute("icon") || "";
      const panel = document.querySelector(`[data-sponsor-panel="${idx}"]`);
      let qrCode = "";
      let link = "";
      let description = "";
      let enabled = true;
      if (panel) {
        const img = panel.querySelector("img");
        if (img) qrCode = img.getAttribute("src") || "";
        const a = panel.querySelector("a.afd-btn");
        if (a) link = (a as HTMLAnchorElement).href || "";
        const subtext = panel.querySelector(".afd-card-subtext");
        if (subtext) description = subtext.textContent?.trim() || "";
        const empty = panel.querySelector(".sponsor-qr-card__empty");
        if (empty) enabled = false;
      }
      methods.push({
        id: genId("sm"),
        name: name || "未命名",
        icon: icon || undefined,
        qrCode: qrCode || undefined,
        link: link || undefined,
        description: description || undefined,
        enabled,
      });
    });

    // 收集赞助者
    const sponsors: SponsorItem[] = [];
    document.querySelectorAll(".sponsor-row").forEach((row) => {
      const nameEl = row.querySelector(".sponsor-name");
      const name = nameEl?.textContent?.trim() || "";
      const avatarImg = row.querySelector(".sponsor-avatar__img") as HTMLImageElement | null;
      const avatar = avatarImg?.src || "";
      const avatarFallback = row.querySelector(".sponsor-avatar span")?.textContent?.trim() || "";
      const dateEl = row.querySelector(".sponsor-date");
      const date = dateEl?.textContent?.trim() || "";
      const amountEl = row.querySelector(".sponsor-amount");
      const amount = amountEl?.textContent?.trim() || "";
      sponsors.push({
        id: genId("sp"),
        name,
        amount: amount || undefined,
        date: date || undefined,
        avatar: avatar || undefined,
      });
    });

    state = {
      title: titleEl?.textContent?.trim() || "赞助",
      description: descEl?.textContent?.trim() || "",
      usage: usageBox?.textContent?.trim() || "",
      showSponsorsList: true,
      methods,
      sponsors,
    };
    originalState = deepClone(state);
    originalCodeContent = generateConfigTs();
  }

  async function initRepoState() {
    try {
      const file = await getRepoFile(filePath, repoConfig);
      if (file) {
        fileSha = file.sha;
      }
    } catch {}
    drafts.restoreFromDrafts();
  }

  function hideSSRContent() {
    const qrCard = document.querySelector(".sponsor-qr-card__outer");
    const sponsorListSection = document.querySelector(".sponsor-list")?.closest(".flex.w-full");
    const usageBox = document.querySelector(".usage-info-box");
    if (qrCard) (qrCard as HTMLElement).style.display = "none";
    if (sponsorListSection) (sponsorListSection as HTMLElement).style.display = "none";
    const usageParent = usageBox?.parentElement as HTMLElement | null;
    if (usageParent) usageParent.style.display = "none";
  }

  function showSSRContent() {
    const qrCard = document.querySelector(".sponsor-qr-card__outer");
    const sponsorListSection = document.querySelector(".sponsor-list")?.closest(".flex.w-full");
    const usageBox = document.querySelector(".usage-info-box");
    if (qrCard) (qrCard as HTMLElement).style.display = "";
    if (sponsorListSection) (sponsorListSection as HTMLElement).style.display = "";
    const usageParent = usageBox?.parentElement as HTMLElement | null;
    if (usageParent) usageParent.style.display = "";
  }

  function handleModeChange(e: CustomEvent) {
    editMode = e.detail.editing;
    if (editMode) {
      hideSSRContent();
      editingMethod = -1;
      editingSponsor = -1;
    } else {
      showSSRContent();
    }
  }

  function handleCancel() {
    if (originalState) {
      state = deepClone(originalState);
    }
    editingMethod = -1;
    editingSponsor = -1;
    drafts.clearDrafts();
    showSSRContent();
  }

  // ===== Methods 操作 =====
  function startEditMethod(index: number) {
    editingMethod = index;
    editingSponsor = -1;
  }

  function updateMethodField(index: number, field: keyof SponsorMethod, value: string | boolean) {
    state.methods[index] = { ...state.methods[index], [field]: value };
    state = { ...state };

  }

  function finishEditMethod(index: number) {
    const m = state.methods[index];
    if (!m.name.trim()) {
      showToast("支付方式名称不能为空", "warning");
      return;
    }
    editingMethod = -1;

    showToast("已修改，记得点击保存", "info");
  }

  function cancelMethodEdit(index: number) {
    const m = state.methods[index];
    if (m._draft && !m.name.trim()) {
      state.methods = state.methods.filter((_, i) => i !== index);
      state = { ...state };
    } else if (originalState) {
      const orig = originalState.methods.find(o => o.id === m.id);
      if (orig) {
        state.methods[index] = deepClone(orig);
        state = { ...state };
      }
    }
    editingMethod = -1;
  }

  function deleteMethod(index: number) {
    const m = state.methods[index];
    if (!confirm(`确定要删除「${m.name}」吗？`)) return;
    if (m._draft) {
      state.methods = state.methods.filter((_, i) => i !== index);
      state = { ...state };
    } else {
      state.methods[index] = { ...state.methods[index], _deleted: true };
      state = { ...state };
    }

    if (editingMethod === index) editingMethod = -1;
    else if (editingMethod > index) editingMethod--;
    showToast("已标记删除，记得点击保存", "info");
  }

  function moveMethodUp(index: number) {
    if (index <= 0) return;
    const arr = [...state.methods];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    state.methods = arr;
    state = { ...state };

  }

  function moveMethodDown(index: number) {
    if (index >= state.methods.length - 1) return;
    const arr = [...state.methods];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    state.methods = arr;
    state = { ...state };

  }

  function restoreMethod(index: number) {
    state.methods[index] = { ...state.methods[index], _deleted: false };
    state = { ...state };

  }

  function addMethod() {
    state.methods = [
      ...state.methods,
      {
        id: genId("sm"),
        name: "",
        icon: "",
        qrCode: "",
        link: "",
        description: "",
        enabled: true,
        _draft: true,
      },
    ];
    state = { ...state };
    editingMethod = state.methods.length - 1;
    editingSponsor = -1;

  }

  // ===== Sponsors 操作 =====
  function startEditSponsor(index: number) {
    editingSponsor = index;
    editingMethod = -1;
  }

  function updateSponsorField(index: number, field: keyof SponsorItem, value: string) {
    state.sponsors[index] = { ...state.sponsors[index], [field]: value };
    state = { ...state };

  }

  function finishEditSponsor(index: number) {
    const s = state.sponsors[index];
    if (!s.name.trim()) {
      showToast("赞助者名称不能为空", "warning");
      return;
    }
    editingSponsor = -1;

    showToast("已修改，记得点击保存", "info");
  }

  function cancelSponsorEdit(index: number) {
    const s = state.sponsors[index];
    if (s._draft && !s.name.trim()) {
      state.sponsors = state.sponsors.filter((_, i) => i !== index);
      state = { ...state };
    } else if (originalState) {
      const orig = originalState.sponsors.find(o => o.id === s.id);
      if (orig) {
        state.sponsors[index] = deepClone(orig);
        state = { ...state };
      }
    }
    editingSponsor = -1;
  }

  function deleteSponsor(index: number) {
    const s = state.sponsors[index];
    if (!confirm(`确定要删除「${s.name}」吗？`)) return;
    if (s._draft) {
      state.sponsors = state.sponsors.filter((_, i) => i !== index);
      state = { ...state };
    } else {
      state.sponsors[index] = { ...state.sponsors[index], _deleted: true };
      state = { ...state };
    }

    if (editingSponsor === index) editingSponsor = -1;
    else if (editingSponsor > index) editingSponsor--;
    showToast("已标记删除，记得点击保存", "info");
  }

  function moveSponsorUp(index: number) {
    if (index <= 0) return;
    const arr = [...state.sponsors];
    [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
    state.sponsors = arr;
    state = { ...state };

  }

  function moveSponsorDown(index: number) {
    if (index >= state.sponsors.length - 1) return;
    const arr = [...state.sponsors];
    [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
    state.sponsors = arr;
    state = { ...state };

  }

  function restoreSponsor(index: number) {
    state.sponsors[index] = { ...state.sponsors[index], _deleted: false };
    state = { ...state };

  }

  function addSponsor() {
    state.sponsors = [
      ...state.sponsors,
      {
        id: genId("sp"),
        name: "",
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        avatar: "",
        _draft: true,
      },
    ];
    state = { ...state };
    editingSponsor = state.sponsors.length - 1;
    editingMethod = -1;

  }

  function updateStateField<K extends keyof SponsorState>(field: K, value: SponsorState[K]) {
    state = { ...state, [field]: value };

  }

  function generateConfigTs(): string {
    const lines = [
      'import type { SponsorConfig } from "../types/config";',
      "",
      "export const sponsorConfig: SponsorConfig = {",
      `\ttitle: ${JSON.stringify(state.title)},`,
      "",
      `\tdescription: ${JSON.stringify(state.description)},`,
      "",
      `\tusage: ${JSON.stringify(state.usage)},`,
      "",
      `\tshowSponsorsList: ${state.showSponsorsList},`,
      "",
      "\tshowComment: true,",
      "",
      "\tshowButtonInPost: true,",
      "",
      "\tmethods: [",
    ];

    for (const m of state.methods.filter(m => !m._deleted)) {
      lines.push("\t\t{");
      lines.push(`\t\t\tname: ${JSON.stringify(m.name)},`);
      if (m.icon) lines.push(`\t\t\ticon: ${JSON.stringify(m.icon)},`);
      if (m.qrCode) lines.push(`\t\t\tqrCode: ${JSON.stringify(m.qrCode)},`);
      if (m.link) lines.push(`\t\t\tlink: ${JSON.stringify(m.link)},`);
      if (m.description) lines.push(`\t\t\tdescription: ${JSON.stringify(m.description)},`);
      lines.push(`\t\t\tenabled: ${m.enabled},`);
      lines.push("\t\t},");
    }

    lines.push("\t],");
    lines.push("");
    lines.push("\tsponsors: [");

    for (const s of state.sponsors.filter(s => !s._deleted)) {
      lines.push("\t\t{");
      lines.push(`\t\t\tname: ${JSON.stringify(s.name)},`);
      if (s.avatar) lines.push(`\t\t\tavatar: ${JSON.stringify(s.avatar)},`);
      if (s.amount) lines.push(`\t\t\tamount: ${JSON.stringify(s.amount)},`);
      if (s.date) lines.push(`\t\t\tdate: ${JSON.stringify(s.date)},`);
      lines.push("\t\t},");
    }

    lines.push("\t],");
    lines.push("};");
    lines.push("");
    return lines.join("\n");
  }

  function handleSaveDraft() {
    drafts.saveToDrafts();
  }

  async function handleSubmit() {
    saving = true;
    try { await drafts.submitDrafts(); } finally { saving = false; }
  }
</script>

<EditToast />

<div class="sp-edit-toolbar">
  <EditToolbar
    pageKey="sponsor"
    pageName="赞助页面"
    mountTo=".page-header-toolbar-slot"
    {saving}
    {hasChanges}
    on:modeChange={(e) => handleModeChange(e)}
    on:add={() => {
      activeTab === "methods" ? addMethod() : addSponsor();
    }}
    on:saveDraft={() => handleSaveDraft()}
    on:submit={() => handleSubmit()}
    on:cancel={handleCancel}
  />
</div>

{#if editMode}
  <div class="sp-edit-panel">
    <!-- 页面设置 -->
    <div class="sp-settings-card">
      <div class="sp-section-header">
        <iconify-icon icon="material-symbols:settings-outline-rounded"></iconify-icon>
        <span>页面设置</span>
      </div>
      <div class="sp-settings-grid">
        <div class="sp-form-group">
          <label>页面标题</label>
          <input type="text" class="sp-input" value={state.title} oninput={(e) => updateStateField("title", (e.target as HTMLInputElement).value)} />
        </div>
        <div class="sp-form-group">
          <label>页面描述</label>
          <input type="text" class="sp-input" value={state.description} oninput={(e) => updateStateField("description", (e.target as HTMLInputElement).value)} />
        </div>
        <div class="sp-form-group sp-form-group-full">
          <label>赞助用途说明</label>
          <input type="text" class="sp-input" value={state.usage} oninput={(e) => updateStateField("usage", (e.target as HTMLInputElement).value)} placeholder="说明赞助资金的用途，留空不显示" />
        </div>
      </div>
    </div>

    <!-- Tab 切换 -->
    <div class="sp-tabs">
      <button
        class="sp-tab"
        class:sp-tab-active={activeTab === "methods"}
        onclick={() => { activeTab = "methods"; editingMethod = -1; editingSponsor = -1; }}
      >
        <iconify-icon icon="material-symbols:payments-outline-rounded"></iconify-icon>
        赞助方式 ({state.methods.filter(m => !m._deleted).length})
      </button>
      <button
        class="sp-tab"
        class:sp-tab-active={activeTab === "sponsors"}
        onclick={() => { activeTab = "sponsors"; editingMethod = -1; editingSponsor = -1; }}
      >
        <iconify-icon icon="material-symbols:group-outline-rounded"></iconify-icon>
        赞助名单 ({state.sponsors.filter(s => !s._deleted).length})
      </button>
    </div>

    {#if activeTab === "methods"}
      <div class="sp-list">
        {#each state.methods as m, i (i + "-" + m.id)}
          {#if !m._deleted}
            <div
              class="sp-card"
              class:sp-card-draft={m._draft}
              class:sp-card-editing={editingMethod === i}
            >
              {#if editingMethod !== i}
                <div class="sp-card-actions">
                  {#if i > 0}
                    <button class="sp-action-btn sp-action-move" onclick={() => moveMethodUp(i)} title="上移">
                      <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                    </button>
                  {/if}
                  {#if i < state.methods.filter(x => !x._deleted).length - 1}
                    <button class="sp-action-btn sp-action-move" onclick={() => moveMethodDown(i)} title="下移">
                      <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                    </button>
                  {/if}
                  <button class="sp-action-btn" onclick={() => updateMethodField(i, "enabled", !m.enabled)} title={m.enabled ? "禁用" : "启用"}>
                    <iconify-icon icon={m.enabled ? "material-symbols:visibility-rounded" : "material-symbols:visibility-off-rounded"}></iconify-icon>
                  </button>
                  <button class="sp-action-btn sp-action-edit" onclick={() => startEditMethod(i)} title="编辑">
                    <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
                  </button>
                  <button class="sp-action-btn sp-action-delete" onclick={() => deleteMethod(i)} title="删除">
                    <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
                  </button>
                </div>
                <div class="sp-card-display">
                  <div class="sp-card-meta">
                    {#if m.icon}
                      <iconify-icon icon={m.icon} width="20"></iconify-icon>
                    {/if}
                    <span class="sp-card-name">{m.name}</span>
                    {#if !m.enabled}
                      <span class="sp-badge-disabled">已禁用</span>
                    {/if}
                    {#if m._draft}
                      <span class="sp-badge-draft">新增</span>
                    {/if}
                  </div>
                  <div class="sp-card-details">
                    {#if m.link}
                      <span class="sp-detail-item">
                        <iconify-icon icon="material-symbols:link-rounded"></iconify-icon>
                        {m.link}
                      </span>
                    {/if}
                    {#if m.qrCode}
                      <span class="sp-detail-item">
                        <iconify-icon icon="material-symbols:qr-code-2-rounded"></iconify-icon>
                        {m.qrCode}
                      </span>
                    {/if}
                    {#if m.description}
                      <span class="sp-detail-item sp-detail-desc">{m.description}</span>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="sp-card-edit">
                  <div class="sp-form-header">
                    <iconify-icon icon="material-symbols:edit-document-outline-rounded"></iconify-icon>
                    <span>编辑赞助方式</span>
                    {#if m._draft}<span class="sp-badge-draft">新增</span>{/if}
                  </div>
                  <div class="sp-form-row">
                    <div class="sp-form-group">
                      <label>名称</label>
                      <input type="text" class="sp-input" value={m.name} oninput={(e) => updateMethodField(i, "name", (e.target as HTMLInputElement).value)} placeholder="如：微信支付" />
                    </div>
                    <div class="sp-form-group">
                      <label>图标 (Iconify)</label>
                      <input type="text" class="sp-input" value={m.icon || ""} oninput={(e) => updateMethodField(i, "icon", (e.target as HTMLInputElement).value)} placeholder="如：fa7-brands:weixin" />
                    </div>
                  </div>
                  <div class="sp-form-row">
                    <div class="sp-form-group">
                      <label>二维码图片路径</label>
                      <input type="text" class="sp-input" value={m.qrCode || ""} oninput={(e) => updateMethodField(i, "qrCode", (e.target as HTMLInputElement).value)} placeholder="如：/assets/images/wechat.png" />
                    </div>
                    <div class="sp-form-group">
                      <label>跳转链接（如爱发电）</label>
                      <input type="text" class="sp-input" value={m.link || ""} oninput={(e) => updateMethodField(i, "link", (e.target as HTMLInputElement).value)} placeholder="如：https://ifdian.net/a/xxx" />
                    </div>
                  </div>
                  <div class="sp-form-group">
                    <label>描述</label>
                    <input type="text" class="sp-input" value={m.description || ""} oninput={(e) => updateMethodField(i, "description", (e.target as HTMLInputElement).value)} placeholder="描述文本" />
                  </div>
                  <div class="sp-form-group">
                    <label class="sp-checkbox-label">
                      <input type="checkbox" checked={m.enabled} onchange={(e) => updateMethodField(i, "enabled", (e.target as HTMLInputElement).checked)} />
                      启用该支付方式
                    </label>
                  </div>
                  <div class="sp-form-actions">
                    <button class="sp-btn sp-btn-cancel" onclick={() => cancelMethodEdit(i)}>取消</button>
                    <button class="sp-btn sp-btn-save" onclick={() => finishEditMethod(i)}>完成</button>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <div class="sp-card sp-card-deleted">
              <div class="sp-deleted-info">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
                <span>{m.name} 已标记删除</span>
              </div>
              <button class="sp-btn sp-btn-restore" onclick={() => restoreMethod(i)}>撤销删除</button>
            </div>
          {/if}
        {/each}

        {#if state.methods.filter(m => !m._deleted).length === 0}
          <div class="sp-empty">
            <iconify-icon icon="material-symbols:payments-outline-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon>
            <p>暂无赞助方式，点击"添加"创建</p>
          </div>
        {/if}
      </div>
    {/if}

    {#if activeTab === "sponsors"}
      <div class="sp-list">
        {#each state.sponsors as s, i (i + "-" + s.id)}
          {#if !s._deleted}
            <div
              class="sp-card sp-card-sponsor"
              class:sp-card-draft={s._draft}
              class:sp-card-editing={editingSponsor === i}
            >
              {#if editingSponsor !== i}
                <div class="sp-card-actions">
                  {#if i > 0}
                    <button class="sp-action-btn sp-action-move" onclick={() => moveSponsorUp(i)} title="上移">
                      <iconify-icon icon="material-symbols:keyboard-arrow-up-rounded"></iconify-icon>
                    </button>
                  {/if}
                  {#if i < state.sponsors.filter(x => !x._deleted).length - 1}
                    <button class="sp-action-btn sp-action-move" onclick={() => moveSponsorDown(i)} title="下移">
                      <iconify-icon icon="material-symbols:keyboard-arrow-down-rounded"></iconify-icon>
                    </button>
                  {/if}
                  <button class="sp-action-btn sp-action-edit" onclick={() => startEditSponsor(i)} title="编辑">
                    <iconify-icon icon="material-symbols:edit-outline-rounded"></iconify-icon>
                  </button>
                  <button class="sp-action-btn sp-action-delete" onclick={() => deleteSponsor(i)} title="删除">
                    <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
                  </button>
                </div>
                <div class="sp-card-display">
                  <div class="sp-sponsor-row">
                    <div class="sp-sponsor-avatar">
                      {#if s.avatar}
                        <img src={s.avatar} alt={s.name} />
                      {:else}
                        <span>{s.name.charAt(0)}</span>
                      {/if}
                    </div>
                    <div class="sp-sponsor-info">
                      <span class="sp-sponsor-name">{s.name}</span>
                      {#if s.date}
                        <span class="sp-sponsor-date">{s.date}</span>
                      {/if}
                    </div>
                    {#if s.amount}
                      <span class="sp-sponsor-amount">{s.amount}</span>
                    {/if}
                    {#if s._draft}
                      <span class="sp-badge-draft">新增</span>
                    {/if}
                  </div>
                </div>
              {:else}
                <div class="sp-card-edit">
                  <div class="sp-form-header">
                    <iconify-icon icon="material-symbols:person-edit-outline-rounded"></iconify-icon>
                    <span>编辑赞助者</span>
                    {#if s._draft}<span class="sp-badge-draft">新增</span>{/if}
                  </div>
                  <div class="sp-form-row">
                    <div class="sp-form-group">
                      <label>名称</label>
                      <input type="text" class="sp-input" value={s.name} oninput={(e) => updateSponsorField(i, "name", (e.target as HTMLInputElement).value)} placeholder="赞助者名称" />
                    </div>
                    <div class="sp-form-group">
                      <label>金额</label>
                      <input type="text" class="sp-input" value={s.amount || ""} oninput={(e) => updateSponsorField(i, "amount", (e.target as HTMLInputElement).value)} placeholder="如：¥50" />
                    </div>
                  </div>
                  <div class="sp-form-row">
                    <div class="sp-form-group">
                      <label>日期</label>
                      <input type="date" class="sp-input" value={s.date || ""} oninput={(e) => updateSponsorField(i, "date", (e.target as HTMLInputElement).value)} />
                    </div>
                    <div class="sp-form-group">
                      <label>头像 URL</label>
                      <input type="text" class="sp-input" value={s.avatar || ""} oninput={(e) => updateSponsorField(i, "avatar", (e.target as HTMLInputElement).value)} placeholder="头像图片链接" />
                    </div>
                  </div>
                  <div class="sp-form-actions">
                    <button class="sp-btn sp-btn-cancel" onclick={() => cancelSponsorEdit(i)}>取消</button>
                    <button class="sp-btn sp-btn-save" onclick={() => finishEditSponsor(i)}>完成</button>
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <div class="sp-card sp-card-deleted">
              <div class="sp-deleted-info">
                <iconify-icon icon="material-symbols:delete-outline-rounded"></iconify-icon>
                <span>{s.name} 已标记删除</span>
              </div>
              <button class="sp-btn sp-btn-restore" onclick={() => restoreSponsor(i)}>撤销删除</button>
            </div>
          {/if}
        {/each}

        {#if state.sponsors.filter(s => !s._deleted).length === 0}
          <div class="sp-empty">
            <iconify-icon icon="material-symbols:group-outline-rounded" style="font-size:48px;opacity:0.3;"></iconify-icon>
            <p>暂无赞助者，点击"添加"创建</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .sp-edit-toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: 4px;
  }

  .sp-edit-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .sp-settings-card {
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 1px solid var(--border, rgba(0,0,0,0.08));
    padding: 20px;
  }
  :global(.dark) .sp-settings-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }

  .sp-section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }

  .sp-settings-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .sp-form-group-full {
    grid-column: 1 / -1;
  }

  .sp-tabs {
    display: flex;
    gap: 4px;
    padding: 4px;
    background: var(--btn-regular-bg, #f3f4f6);
    border-radius: 12px;
  }
  :global(.dark) .sp-tabs {
    background: rgba(255,255,255,0.05);
  }
  .sp-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--text-secondary, #6b7280);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    font-family: inherit;
  }
  .sp-tab:hover {
    color: var(--deep-text);
  }
  .sp-tab-active {
    background: var(--card-bg, white);
    color: hsl(var(--theme-hue, 165), 70%, 45%);
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    font-weight: 600;
  }
  :global(.dark) .sp-tab-active {
    background: rgba(30, 30, 30, 0.9);
  }

  .sp-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .sp-card {
    position: relative;
    border-radius: 16px;
    background: var(--card-bg, white);
    border: 1px solid var(--border, rgba(0,0,0,0.08));
    overflow: hidden;
    transition: all 0.2s;
  }
  :global(.dark) .sp-card {
    background: rgba(23, 23, 23, 0.8);
    border-color: rgba(255,255,255,0.08);
  }
  .sp-card:hover {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
  }
  .sp-card-draft {
    border-style: dashed;
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.5);
  }
  .sp-card-editing {
    border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.6);
    box-shadow: 0 0 0 3px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .sp-card-deleted {
    opacity: 0.6;
    border-style: dashed;
    border-color: rgba(239, 68, 68, 0.3);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
  }

  .sp-card-actions {
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 4px;
    z-index: 10;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .sp-card:hover .sp-card-actions {
    opacity: 1;
  }
  .sp-action-btn {
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
    background: rgba(100, 116, 139, 0.9);
  }
  .sp-action-btn iconify-icon { display: flex; }
  .sp-action-btn:hover {
    background: rgba(71, 85, 105, 1);
    transform: scale(1.1);
  }
  .sp-action-edit { background: rgba(59, 130, 246, 0.9) !important; }
  .sp-action-edit:hover { background: rgba(37, 99, 235, 1) !important; }
  .sp-action-delete { background: rgba(239, 68, 68, 0.9) !important; }
  .sp-action-delete:hover { background: rgba(220, 38, 38, 1) !important; }

  .sp-card-display { padding: 16px 20px; }
  .sp-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }
  .sp-card-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--deep-text);
  }
  .sp-badge-disabled {
    padding: 1px 8px;
    border-radius: 999px;
    background: rgba(100, 116, 139, 0.15);
    color: #94a3b8;
    font-size: 11px;
    font-weight: 500;
  }
  .sp-badge-draft {
    padding: 1px 8px;
    border-radius: 999px;
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
    font-size: 11px;
    font-weight: 600;
  }
  .sp-card-details {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .sp-detail-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--content-meta, #9ca3af);
    word-break: break-all;
  }
  .sp-detail-desc {
    color: var(--text-secondary, #6b7280);
  }

  .sp-sponsor-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .sp-sponsor-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    background: var(--btn-plain-bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    font-weight: 700;
    color: var(--content-meta);
  }
  .sp-sponsor-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .sp-sponsor-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sp-sponsor-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--deep-text);
  }
  .sp-sponsor-date {
    font-size: 12px;
    color: var(--content-meta);
  }
  .sp-sponsor-amount {
    font-size: 15px;
    font-weight: 700;
    color: hsl(45, 80%, 50%);
    padding-right: 40px;
  }

  .sp-deleted-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #ef4444;
  }

  /* 编辑表单 */
  .sp-card-edit { padding: 20px; }
  .sp-form-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 600;
    color: hsl(var(--theme-hue, 165), 70%, 45%);
  }
  .sp-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }
  .sp-form-group {
    margin-bottom: 12px;
  }
  .sp-form-group label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary, #4b5563);
    margin-bottom: 4px;
  }
  :global(.dark) .sp-form-group label {
    color: #d1d5db;
  }
  .sp-checkbox-label {
    display: flex !important;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-weight: 500 !important;
    margin-bottom: 0 !important;
  }
  .sp-checkbox-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: hsl(var(--theme-hue, 165), 70%, 50%);
  }
  .sp-input {
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
  :global(.dark) .sp-input {
    background: #0f0f1a;
    border-color: #374151;
    color: #e5e7eb;
  }
  .sp-input:focus {
    border-color: hsl(var(--theme-hue, 165), 70%, 50%);
    box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
  }
  .sp-form-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
  }
  .sp-btn {
    flex: 1;
    padding: 8px 16px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: inherit;
  }
  .sp-btn-cancel {
    background: var(--bg-secondary, #f3f4f6);
    color: var(--text-color, #374151);
  }
  .sp-btn-cancel:hover { background: var(--border, #e5e7eb); }
  :global(.dark) .sp-btn-cancel {
    background: #2d2d44;
    color: #d1d5db;
  }
  :global(.dark) .sp-btn-cancel:hover { background: #3d3d55; }
  .sp-btn-save {
    background: hsl(var(--theme-hue, 165), 70%, 50%);
    color: white;
  }
  .sp-btn-save:hover {
    background: hsl(var(--theme-hue, 165), 75%, 45%);
  }
  .sp-btn-restore {
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid #22c55e;
    background: transparent;
    color: #22c55e;
    transition: all 0.15s;
    font-family: inherit;
  }
  .sp-btn-restore:hover {
    background: #22c55e;
    color: white;
  }

  .sp-empty {
    text-align: center;
    padding: 48px 20px;
    color: var(--content-meta, #9ca3af);
    font-size: 14px;
    border-radius: 16px;
    border: 2px dashed var(--border, rgba(0,0,0,0.1));
  }

  @media (max-width: 640px) {
    .sp-settings-grid,
    .sp-form-row {
      grid-template-columns: 1fr;
    }
  }
</style>
