<script lang="ts">
import { onMount, onDestroy } from "svelte";
import { showToast, genId, deepClone, ensureIconify } from "@/utils/editMode";
import { setupRepoDrafts } from "@/utils/draftHelpers";
import type {
	CalendarConfig,
	BirthdayItem,
	ScheduleItem,
	HolidayItem,
} from "@/types/config";

// Props
let { initialConfig }: { initialConfig: CalendarConfig } = $props();

// 状态
let dataLoaded = $state(false);
let saving = $state(false);
let fileSha = $state<string | null>(null);
let editMode = $state(false); // 编辑模式开关

// 数据副本
let birthdays = $state<BirthdayItem[]>([]);
let schedules = $state<ScheduleItem[]>([]);
let builtinHolidays = $state<HolidayItem[]>([]);
let originalBirthdays = $state<BirthdayItem[]>([]);
let originalSchedules = $state<ScheduleItem[]>([]);
let originalBuiltinHolidays = $state<HolidayItem[]>([]);

// 编辑状态
let editingBirthdayIndex = $state(-1);
let editingScheduleIndex = $state(-1);
let editingHolidayIndex = $state(-1);

// 日历选择
let selectedDate = $state(""); // YYYY-MM-DD

// Tab
let activeTab = $state<"birthdays" | "schedules" | "holidays">("birthdays");

// 表单字段（生日）
let birthdayForm = $state({
	name: "",
	type: "solar" as "solar" | "lunar",
	month: 1,
	day: 1,
	icon: "material-symbols:cake",
	note: "",
});

// 表单字段（日程）
let scheduleForm = $state({
	title: "",
	date: "", // 一次性：YYYY-MM-DD，留空则用 recurring
	recurringFreq: "" as "" | "yearly" | "monthly" | "weekly",
	recurringMonth: 1,
	recurringDay: 1,
	recurringWeekday: 0,
	recurringLunar: false,
	note: "",
	icon: "material-symbols:event",
});

// 表单字段（内置节日）
let holidayForm = $state({
	name: "",
	type: "solar" as "solar" | "lunar",
	month: 1,
	day: 1,
	icon: "material-symbols:festival",
});

// 初始化草稿系统
const drafts = setupRepoDrafts({
	pageKey: "calendar",
	pageName: "日历配置",
	getContent: () => generateTsContent(),
	setContent: (v) => {
		const parsed = parseTsContent(v);
		if (parsed) {
			birthdays = parsed.birthdays;
			schedules = parsed.schedules;
			builtinHolidays = parsed.builtinHolidays;
		}
	},
	getPath: () => "src/config/calendarConfig.ts",
	getSha: () => fileSha,
	setSha: (v) => (fileSha = v),
	getOriginalContent: () =>
		generateTsContent(
			originalBirthdays,
			originalSchedules,
			originalBuiltinHolidays,
		),
	setOriginalContent: (v) => {
		const parsed = parseTsContent(v);
		if (parsed) {
			originalBirthdays = parsed.birthdays;
			originalSchedules = parsed.schedules;
			originalBuiltinHolidays = parsed.builtinHolidays;
		}
	},
	getCommitMsg: (isEdit) =>
		isEdit ? "chore: update calendar config" : "chore: create calendar config",
	onSubmitted: () => {
		setTimeout(() => window.location.reload(), 1500);
	},
});

// 生成 TS 内容
function generateTsContent(
	bd: BirthdayItem[] = birthdays,
	sc: ScheduleItem[] = schedules,
	hl: HolidayItem[] = builtinHolidays,
): string {
	const bdJson = JSON.stringify(bd, null, 2);
	const scJson = JSON.stringify(sc, null, 2);
	const hlJson = JSON.stringify(hl, null, 2);
	return `// 此文件由编辑器自动生成，请勿手动修改

export const builtinHolidays: HolidayItem[] = ${hlJson};

export const birthdays: BirthdayItem[] = ${bdJson};

export const schedules: ScheduleItem[] = ${scJson};
`;
}

// 解析 TS 内容
function parseTsContent(content: string): {
	birthdays: BirthdayItem[];
	schedules: ScheduleItem[];
	builtinHolidays: HolidayItem[];
} | null {
	try {
		const bdMatch = content.match(
			/export\s+const\s+birthdays\s*[:=]\s*(\[[\s\S]*?\])\s*;/m,
		);
		const scMatch = content.match(
			/export\s+const\s+schedules\s*[:=]\s*(\[[\s\S]*?\])\s*;/m,
		);
		const hlMatch = content.match(
			/export\s+const\s+builtinHolidays\s*[:=]\s*(\[[\s\S]*?\])\s*;/m,
		);
		if (bdMatch && scMatch) {
			return {
				birthdays: JSON.parse(bdMatch[1]),
				schedules: JSON.parse(scMatch[1]),
				builtinHolidays: hlMatch ? JSON.parse(hlMatch[1]) : [],
			};
		}
		return null;
	} catch {
		return null;
	}
}

onMount(() => {
	ensureIconify();
	const restored = drafts.restoreFromDrafts();
	if (!restored) {
		birthdays = deepClone(initialConfig.birthdays || []);
		schedules = deepClone(initialConfig.schedules || []);
		builtinHolidays = deepClone(initialConfig.builtinHolidays || []);
	}
	originalBirthdays = deepClone(birthdays);
	originalSchedules = deepClone(schedules);
	originalBuiltinHolidays = deepClone(builtinHolidays);
	dataLoaded = true;

	// 监听 EditToolbar 的模式切换事件
	window.addEventListener(
		"edit:modeChange",
		handleEditModeChange as EventListener,
	);
});

onDestroy(() => {
	window.removeEventListener(
		"edit:modeChange",
		handleEditModeChange as EventListener,
	);
});

function handleEditModeChange(e: Event) {
	const ce = e as CustomEvent<{ editing: boolean }>;
	editMode = ce.detail?.editing ?? false;
}

// ==================== 生日管理 ====================

function startAddBirthday() {
	editingBirthdayIndex = -1;
	birthdayForm = {
		name: "",
		type: "solar",
		month: 1,
		day: 1,
		icon: "material-symbols:cake",
		note: "",
	};
}

function startEditBirthday(index: number) {
	editingBirthdayIndex = index;
	const b = birthdays[index];
	birthdayForm = {
		name: b.name,
		type: b.date.type,
		month: b.date.month,
		day: b.date.day,
		icon: b.icon || "material-symbols:cake",
		note: b.note || "",
	};
}

function saveBirthday() {
	if (!birthdayForm.name.trim()) {
		showToast("请输入名称", "warning");
		return;
	}
	const item: BirthdayItem = {
		name: birthdayForm.name.trim(),
		date: {
			type: birthdayForm.type,
			month: birthdayForm.month,
			day: birthdayForm.day,
		},
		icon: birthdayForm.icon.trim() || "material-symbols:cake",
		note: birthdayForm.note.trim() || undefined,
	};
	if (editingBirthdayIndex >= 0) {
		birthdays[editingBirthdayIndex] = item;
	} else {
		birthdays.push(item);
	}
	editingBirthdayIndex = -1;
	showToast(editingBirthdayIndex >= 0 ? "已更新" : "已添加", "success");
}

function cancelEditBirthday() {
	editingBirthdayIndex = -1;
}

function deleteBirthday(index: number) {
	const b = birthdays[index];
	if (!confirm(`确定要删除「${b.name}」吗？`)) return;
	birthdays.splice(index, 1);
	if (editingBirthdayIndex === index) editingBirthdayIndex = -1;
	else if (editingBirthdayIndex > index) editingBirthdayIndex--;
	showToast("已删除，记得点击保存", "info");
}

function moveUpBirthday(index: number) {
	if (index <= 0) return;
	[birthdays[index - 1], birthdays[index]] = [
		birthdays[index],
		birthdays[index - 1],
	];
	if (editingBirthdayIndex === index) editingBirthdayIndex = index - 1;
	else if (editingBirthdayIndex === index - 1) editingBirthdayIndex = index;
}

function moveDownBirthday(index: number) {
	if (index >= birthdays.length - 1) return;
	[birthdays[index + 1], birthdays[index]] = [
		birthdays[index],
		birthdays[index + 1],
	];
	if (editingBirthdayIndex === index) editingBirthdayIndex = index + 1;
	else if (editingBirthdayIndex === index + 1) editingBirthdayIndex = index;
}

// ==================== 日程管理 ====================

function startAddSchedule() {
	editingScheduleIndex = -1;
	scheduleForm = {
		title: "",
		date: "",
		recurringFreq: "",
		recurringMonth: 1,
		recurringDay: 1,
		recurringWeekday: 0,
		recurringLunar: false,
		note: "",
		icon: "material-symbols:event",
	};
}

function startEditSchedule(index: number) {
	editingScheduleIndex = index;
	const s = schedules[index];
	scheduleForm = {
		title: s.title,
		date: s.date || "",
		recurringFreq: s.recurring?.freq || "",
		recurringMonth: s.recurring?.month || 1,
		recurringDay: s.recurring?.day || 1,
		recurringWeekday: s.recurring?.weekday ?? 0,
		recurringLunar: s.recurring?.lunar || false,
		note: s.note || "",
		icon: s.icon || "material-symbols:event",
	};
}

function saveSchedule() {
	if (!scheduleForm.title.trim()) {
		showToast("请输入标题", "warning");
		return;
	}
	const item: ScheduleItem = {
		title: scheduleForm.title.trim(),
		note: scheduleForm.note.trim() || undefined,
		icon: scheduleForm.icon.trim() || "material-symbols:event",
	};
	if (scheduleForm.date.trim()) {
		item.date = scheduleForm.date.trim();
	} else if (scheduleForm.recurringFreq) {
		item.recurring = {
			freq: scheduleForm.recurringFreq,
		};
		if (scheduleForm.recurringFreq === "yearly") {
			item.recurring.month = scheduleForm.recurringMonth;
			item.recurring.day = scheduleForm.recurringDay;
			item.recurring.lunar = scheduleForm.recurringLunar;
		} else if (scheduleForm.recurringFreq === "monthly") {
			item.recurring.day = scheduleForm.recurringDay;
		} else if (scheduleForm.recurringFreq === "weekly") {
			item.recurring.weekday = scheduleForm.recurringWeekday;
		}
	}
	if (editingScheduleIndex >= 0) {
		schedules[editingScheduleIndex] = item;
	} else {
		schedules.push(item);
	}
	editingScheduleIndex = -1;
	showToast(editingScheduleIndex >= 0 ? "已更新" : "已添加", "success");
}

function cancelEditSchedule() {
	editingScheduleIndex = -1;
}

function deleteSchedule(index: number) {
	const s = schedules[index];
	if (!confirm(`确定要删除「${s.title}」吗？`)) return;
	schedules.splice(index, 1);
	if (editingScheduleIndex === index) editingScheduleIndex = -1;
	else if (editingScheduleIndex > index) editingScheduleIndex--;
	showToast("已删除，记得点击保存", "info");
}

function moveUpSchedule(index: number) {
	if (index <= 0) return;
	[schedules[index - 1], schedules[index]] = [
		schedules[index],
		schedules[index - 1],
	];
	if (editingScheduleIndex === index) editingScheduleIndex = index - 1;
	else if (editingScheduleIndex === index - 1) editingScheduleIndex = index;
}

function moveDownSchedule(index: number) {
	if (index >= schedules.length - 1) return;
	[schedules[index + 1], schedules[index]] = [
		schedules[index],
		schedules[index + 1],
	];
	if (editingScheduleIndex === index) editingScheduleIndex = index + 1;
	else if (editingScheduleIndex === index + 1) editingScheduleIndex = index;
}

// ==================== 内置节日管理 ====================

function startAddHoliday() {
	editingHolidayIndex = -1;
	holidayForm = {
		name: "",
		type: "solar",
		month: 1,
		day: 1,
		icon: "material-symbols:festival",
	};
}

function startEditHoliday(index: number) {
	editingHolidayIndex = index;
	const h = builtinHolidays[index];
	holidayForm = {
		name: h.name,
		type: h.date.type,
		month: h.date.month,
		day: h.date.day,
		icon: h.icon || "material-symbols:festival",
	};
}

function saveHoliday() {
	if (!holidayForm.name.trim()) {
		showToast("请输入名称", "warning");
		return;
	}
	const item: HolidayItem = {
		name: holidayForm.name.trim(),
		date: {
			type: holidayForm.type,
			month: holidayForm.month,
			day: holidayForm.day,
		},
		icon: holidayForm.icon.trim() || "material-symbols:festival",
	};
	if (editingHolidayIndex >= 0) {
		builtinHolidays[editingHolidayIndex] = item;
	} else {
		builtinHolidays.push(item);
	}
	editingHolidayIndex = -1;
	showToast(editingHolidayIndex >= 0 ? "已更新" : "已添加", "success");
}

function cancelEditHoliday() {
	editingHolidayIndex = -1;
}

function deleteHoliday(index: number) {
	const h = builtinHolidays[index];
	if (!confirm(`确定要删除「${h.name}」吗？`)) return;
	builtinHolidays.splice(index, 1);
	if (editingHolidayIndex === index) editingHolidayIndex = -1;
	else if (editingHolidayIndex > index) editingHolidayIndex--;
	showToast("已删除，记得点击保存", "info");
}

function moveUpHoliday(index: number) {
	if (index <= 0) return;
	[builtinHolidays[index - 1], builtinHolidays[index]] = [
		builtinHolidays[index],
		builtinHolidays[index - 1],
	];
	if (editingHolidayIndex === index) editingHolidayIndex = index - 1;
	else if (editingHolidayIndex === index - 1) editingHolidayIndex = index;
}

function moveDownHoliday(index: number) {
	if (index >= builtinHolidays.length - 1) return;
	[builtinHolidays[index + 1], builtinHolidays[index]] = [
		builtinHolidays[index],
		builtinHolidays[index + 1],
	];
	if (editingHolidayIndex === index) editingHolidayIndex = index + 1;
	else if (editingHolidayIndex === index + 1) editingHolidayIndex = index;
}

// ==================== 提交 ====================

async function handleSubmit() {
	if (editingBirthdayIndex >= 0) {
		saveBirthday();
		if (editingBirthdayIndex >= 0) return;
	}
	if (editingScheduleIndex >= 0) {
		saveSchedule();
		if (editingScheduleIndex >= 0) return;
	}
	if (editingHolidayIndex >= 0) {
		saveHoliday();
		if (editingHolidayIndex >= 0) return;
	}
	saving = true;
	try {
		drafts.saveToDrafts();
		await drafts.submitDrafts();
	} catch (e: any) {
		showToast(`提交失败: ${e.message}`, "error");
	} finally {
		saving = false;
	}
}

function handleCancel() {
	drafts.clearDrafts();
	window.location.reload();
}

function handleSaveDraft() {
	drafts.saveToDrafts();
}

// ==================== 工具函数 ====================

const weekdayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function formatDate(dateStr: string): string {
	if (!dateStr) return "";
	const d = new Date(dateStr);
	return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 (${weekdayNames[d.getDay()]})`;
}

function getScheduleDescription(s: ScheduleItem): string {
	if (s.date) {
		return `一次性 · ${formatDate(s.date)}`;
	}
	if (!s.recurring) return "";
	const r = s.recurring;
	if (r.freq === "yearly") {
		return `每年${r.lunar ? "农历" : "公历"}${r.month}月${r.day}日`;
	}
	if (r.freq === "monthly") {
		return `每月${r.day}日`;
	}
	if (r.freq === "weekly") {
		return `每周${weekdayNames[r.weekday!]}`;
	}
	return "";
}
</script>

<div class="calendar-editor">
	<!-- Tab 切换 -->
	<div class="tab-bar">
		<button
			class="tab-btn"
			class:active={activeTab === "birthdays"}
			onclick={() => (activeTab = "birthdays")}
		>
			<iconify-icon icon="material-symbols:cake"></iconify-icon>
			生日/纪念日 ({birthdays.length})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === "schedules"}
			onclick={() => (activeTab = "schedules")}
		>
			<iconify-icon icon="material-symbols:event"></iconify-icon>
			自定义日程 ({schedules.length})
		</button>
		<button
			class="tab-btn"
			class:active={activeTab === "holidays"}
			onclick={() => (activeTab = "holidays")}
		>
			<iconify-icon icon="material-symbols:festival"></iconify-icon>
			内置节日 ({builtinHolidays.length})
		</button>
	</div>

	<!-- 左侧：列表 + 表单 -->
	<div class="editor-main">
		{#if activeTab === "birthdays"}
			<div class="list-panel">
				<h3>生日/纪念日列表</h3>
				{#if birthdays.length === 0}
					<p class="empty-hint">暂无生日/纪念日，点击下方按钮添加</p>
				{:else}
					{#each birthdays as b, i}
						<div class="item-card">
							<div class="item-header">
								<span class="item-name">{b.name}</span>
								<div class="item-actions">
									<button
										class="action-btn action-move"
										onclick={() => moveUpBirthday(i)}
										disabled={i === 0}
										title="上移"
									>
										<iconify-icon icon="material-symbols:arrow-upward"></iconify-icon>
									</button>
									<button
										class="action-btn action-move"
										onclick={() => moveDownBirthday(i)}
										disabled={i === birthdays.length - 1}
										title="下移"
									>
										<iconify-icon icon="material-symbols:arrow-downward"></iconify-icon>
									</button>
									<button class="action-btn" onclick={() => startEditBirthday(i)} title="编辑">
										<iconify-icon icon="material-symbols:edit"></iconify-icon>
									</button>
									<button class="action-btn action-delete" onclick={() => deleteBirthday(i)} title="删除">
										<iconify-icon icon="material-symbols:delete"></iconify-icon>
									</button>
								</div>
							</div>
							<div class="item-meta">
								<span class="item-date">
									{b.date.type === "lunar" ? "🌙 农历" : "☀️ 公历"} {b.date.month}月{b.date.day}日
								</span>
								{#if b.note}
									<span class="item-note">· {b.note}</span>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
				<button class="add-btn" onclick={startAddBirthday}>
					<iconify-icon icon="material-symbols:add-circle-outline"></iconify-icon>
					添加生日/纪念日
				</button>
			</div>

			{#if editingBirthdayIndex >= 0 || birthdayForm.name}
				<div class="form-panel">
					<h3>{editingBirthdayIndex >= 0 ? "编辑生日/纪念日" : "新增生日/纪念日"}</h3>
					<div class="form-group">
						<label>名称</label>
						<input type="text" bind:value={birthdayForm.name} placeholder="例如：我的生日" />
					</div>
					<div class="form-row">
						<div class="form-group">
							<label>日期类型</label>
							<select bind:value={birthdayForm.type}>
								<option value="solar">公历</option>
								<option value="lunar">农历</option>
							</select>
						</div>
						<div class="form-group">
							<label>月份</label>
							<input type="number" min="1" max="12" bind:value={birthdayForm.month} />
						</div>
						<div class="form-group">
							<label>日期</label>
							<input type="number" min="1" max="31" bind:value={birthdayForm.day} />
						</div>
					</div>
					<div class="form-group">
						<label>图标（Iconify）</label>
						<input type="text" bind:value={birthdayForm.icon} placeholder="material-symbols:cake" />
					</div>
					<div class="form-group">
						<label>备注</label>
						<textarea bind:value={birthdayForm.note} rows="2" placeholder="可选"></textarea>
					</div>
					<div class="form-actions">
						<button class="btn-secondary" onclick={cancelEditBirthday}>取消</button>
						<button class="btn-primary" onclick={saveBirthday}>保存</button>
					</div>
				</div>
			{/if}
		{/if}

		{#if activeTab === "schedules"}
			<div class="list-panel">
				<h3>自定义日程列表</h3>
				{#if schedules.length === 0}
					<p class="empty-hint">暂无日程，点击下方按钮添加</p>
				{:else}
					{#each schedules as s, i}
						<div class="item-card">
							<div class="item-header">
								<span class="item-name">{s.title}</span>
								<div class="item-actions">
									<button
										class="action-btn action-move"
										onclick={() => moveUpSchedule(i)}
										disabled={i === 0}
										title="上移"
									>
										<iconify-icon icon="material-symbols:arrow-upward"></iconify-icon>
									</button>
									<button
										class="action-btn action-move"
										onclick={() => moveDownSchedule(i)}
										disabled={i === schedules.length - 1}
										title="下移"
									>
										<iconify-icon icon="material-symbols:arrow-downward"></iconify-icon>
									</button>
									<button class="action-btn" onclick={() => startEditSchedule(i)} title="编辑">
										<iconify-icon icon="material-symbols:edit"></iconify-icon>
									</button>
									<button class="action-btn action-delete" onclick={() => deleteSchedule(i)} title="删除">
										<iconify-icon icon="material-symbols:delete"></iconify-icon>
									</button>
								</div>
							</div>
							<div class="item-meta">
								<span class="item-date">{getScheduleDescription(s)}</span>
								{#if s.note}
									<span class="item-note">· {s.note}</span>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
				<button class="add-btn" onclick={startAddSchedule}>
					<iconify-icon icon="material-symbols:add-circle-outline"></iconify-icon>
					添加日程
				</button>
			</div>

			{#if editingScheduleIndex >= 0 || scheduleForm.title}
				<div class="form-panel">
					<h3>{editingScheduleIndex >= 0 ? "编辑日程" : "新增日程"}</h3>
					<div class="form-group">
						<label>标题</label>
						<input type="text" bind:value={scheduleForm.title} placeholder="例如：Python 学习" />
					</div>
					<div class="form-group">
						<label>重复方式</label>
						<select bind:value={scheduleForm.recurringFreq}>
							<option value="">一次性（指定日期）</option>
							<option value="yearly">每年重复</option>
							<option value="monthly">每月重复</option>
							<option value="weekly">每周重复</option>
						</select>
					</div>
					{#if !scheduleForm.recurringFreq}
						<div class="form-group">
							<label>日期</label>
							<input type="date" bind:value={scheduleForm.date} />
						</div>
					{:else if scheduleForm.recurringFreq === "yearly"}
						<div class="form-row">
							<div class="form-group">
								<label>月份</label>
								<input type="number" min="1" max="12" bind:value={scheduleForm.recurringMonth} />
							</div>
							<div class="form-group">
								<label>日期</label>
								<input type="number" min="1" max="31" bind:value={scheduleForm.recurringDay} />
							</div>
							<div class="form-group">
								<label>
									<input type="checkbox" bind:checked={scheduleForm.recurringLunar} />
									农历
								</label>
							</div>
						</div>
					{:else if scheduleForm.recurringFreq === "monthly"}
						<div class="form-group">
							<label>每月几号</label>
							<input type="number" min="1" max="31" bind:value={scheduleForm.recurringDay} />
						</div>
					{:else if scheduleForm.recurringFreq === "weekly"}
						<div class="form-group">
							<label>星期几</label>
							<select bind:value={scheduleForm.recurringWeekday}>
								{#each weekdayNames as name, i}
									<option value={i}>{name}</option>
								{/each}
							</select>
						</div>
					{/if}
					<div class="form-group">
						<label>图标（Iconify）</label>
						<input type="text" bind:value={scheduleForm.icon} placeholder="material-symbols:event" />
					</div>
					<div class="form-group">
						<label>备注</label>
						<textarea bind:value={scheduleForm.note} rows="2" placeholder="可选"></textarea>
					</div>
					<div class="form-actions">
						<button class="btn-secondary" onclick={cancelEditSchedule}>取消</button>
						<button class="btn-primary" onclick={saveSchedule}>保存</button>
					</div>
				</div>
			{/if}
		{/if}

		{#if activeTab === "holidays"}
			<div class="list-panel">
				<h3>内置节日列表</h3>
				{#if builtinHolidays.length === 0}
					<p class="empty-hint">暂无内置节日，点击下方按钮添加</p>
				{:else}
					{#each builtinHolidays as h, i}
						<div class="item-card">
							<div class="item-header">
								<span class="item-name">{h.name}</span>
								<div class="item-actions">
									<button
										class="action-btn action-move"
										onclick={() => moveUpHoliday(i)}
										disabled={i === 0}
										title="上移"
									>
										<iconify-icon icon="material-symbols:arrow-upward"></iconify-icon>
									</button>
									<button
										class="action-btn action-move"
										onclick={() => moveDownHoliday(i)}
										disabled={i === builtinHolidays.length - 1}
										title="下移"
									>
										<iconify-icon icon="material-symbols:arrow-downward"></iconify-icon>
									</button>
									<button
										class="action-btn action-edit"
										onclick={() => startEditHoliday(i)}
										title="编辑"
									>
										<iconify-icon icon="material-symbols:edit"></iconify-icon>
									</button>
									<button
										class="action-btn action-delete"
										onclick={() => deleteHoliday(i)}
										title="删除"
									>
										<iconify-icon icon="material-symbols:delete"></iconify-icon>
									</button>
								</div>
							</div>
							<div class="item-detail">
								{h.date.type === "lunar" ? "农历" : "公历"} {h.date.month}月{h.date.day}日
								{#if h.icon}
									· <iconify-icon icon={h.icon}></iconify-icon>
								{/if}
							</div>
						</div>
					{/each}
				{/if}
				<button class="btn-add" onclick={startAddHoliday}>
					<iconify-icon icon="material-symbols:add"></iconify-icon>
					添加节日
				</button>
			</div>

			{#if editingHolidayIndex >= 0 || builtinHolidays.length === 0 || editingHolidayIndex === -2}
				<div class="form-panel">
					<h3>{editingHolidayIndex >= 0 ? "编辑节日" : "新增节日"}</h3>
					<div class="form-group">
						<label>名称</label>
						<input type="text" bind:value={holidayForm.name} placeholder="如：春节" />
					</div>
					<div class="form-group">
						<label>日期类型</label>
						<select bind:value={holidayForm.type}>
							<option value="solar">公历</option>
							<option value="lunar">农历</option>
						</select>
					</div>
					<div class="form-group">
						<label>月</label>
						<input type="number" min="1" max="12" bind:value={holidayForm.month} />
					</div>
					<div class="form-group">
						<label>日</label>
						<input type="number" min="1" max="31" bind:value={holidayForm.day} />
					</div>
					<div class="form-group">
						<label>图标（Iconify）</label>
						<input type="text" bind:value={holidayForm.icon} placeholder="material-symbols:festival" />
					</div>
					<div class="form-actions">
						<button class="btn-secondary" onclick={cancelEditHoliday}>取消</button>
						<button class="btn-primary" onclick={saveHoliday}>保存</button>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<style>
	.calendar-editor {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		border-radius: 12px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
	}
	:global(.dark) .calendar-editor {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.tab-bar {
		display: flex;
		gap: 0.5rem;
		border-bottom: 2px solid var(--border, rgba(0, 0, 0, 0.08));
		padding-bottom: 0.5rem;
	}
	:global(.dark) .tab-bar {
		border-color: rgba(255, 255, 255, 0.08);
	}

	.tab-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.5rem 1rem;
		border: none;
		background: transparent;
		color: var(--text-secondary, #6b7280);
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		border-radius: 6px;
		transition: all 0.15s;
	}
	.tab-btn:hover {
		background: var(--btn-regular-bg, #f3f4f6);
	}
	:global(.dark) .tab-btn:hover {
		background: rgba(255, 255, 255, 0.05);
	}
	.tab-btn.active {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}

	.editor-main {
		display: grid;
		grid-template-columns: 1fr 320px;
		gap: 1rem;
	}

	.list-panel,
	.form-panel {
		border-radius: 8px;
		padding: 1rem;
		background: var(--bg-color, #fafafa);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.06));
	}
	:global(.dark) .list-panel,
	:global(.dark) .form-panel {
		background: rgba(255, 255, 255, 0.02);
		border-color: rgba(255, 255, 255, 0.06);
	}

	.list-panel h3,
	.form-panel h3 {
		margin: 0 0 1rem 0;
		font-size: 1rem;
		font-weight: 600;
		color: var(--deep-text, #1f2937);
	}
	:global(.dark) .list-panel h3,
	:global(.dark) .form-panel h3 {
		color: #e5e7eb;
	}

	.empty-hint {
		color: var(--content-meta, #9ca3af);
		font-size: 0.9rem;
		text-align: center;
		padding: 2rem 0;
	}

	.item-card {
		background: white;
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		border-radius: 8px;
		padding: 0.75rem;
		margin-bottom: 0.5rem;
		transition: box-shadow 0.15s;
	}
	:global(.dark) .item-card {
		background: rgba(255, 255, 255, 0.03);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.item-card:hover {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.item-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.25rem;
	}

	.item-name {
		font-weight: 600;
		color: var(--deep-text, #1f2937);
	}
	:global(.dark) .item-name {
		color: #e5e7eb;
	}

	.item-actions {
		display: flex;
		gap: 0.25rem;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		border: none;
		background: transparent;
		color: var(--text-secondary, #6b7280);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.action-btn:hover:not(:disabled) {
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, #1f2937);
	}
	:global(.dark) .action-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.05);
		color: #e5e7eb;
	}
	.action-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}
	.action-delete:hover:not(:disabled) {
		background: #fee2e2;
		color: #dc2626;
	}
	:global(.dark) .action-delete:hover:not(:disabled) {
		background: rgba(220, 38, 38, 0.2);
	}
	.action-move {
		color: var(--content-meta, #9ca3af);
	}

	.item-meta {
		font-size: 0.85rem;
		color: var(--content-meta, #6b7280);
	}
	:global(.dark) .item-meta {
		color: #9ca3af;
	}

	.add-btn {
		width: 100%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.4rem;
		padding: 0.6rem;
		border: 2px dashed var(--border, rgba(0, 0, 0, 0.12));
		background: transparent;
		color: var(--text-secondary, #6b7280);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.15s;
		font-size: 0.9rem;
	}
	.add-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		color: hsl(var(--theme-hue, 165), 70%, 50%);
		background: rgba(0, 0, 0, 0.02);
	}
	:global(.dark) .add-btn:hover {
		background: rgba(255, 255, 255, 0.02);
	}

	.form-group {
		margin-bottom: 0.75rem;
	}
	.form-group label {
		display: block;
		margin-bottom: 0.3rem;
		font-size: 0.85rem;
		font-weight: 500;
		color: var(--text-secondary, #4b5563);
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}
	.form-group input[type="text"],
	.form-group input[type="number"],
	.form-group input[type="date"],
	.form-group select,
	.form-group textarea {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border, rgba(0, 0, 0, 0.12));
		border-radius: 6px;
		background: white;
		color: var(--deep-text, #1f2937);
		font-size: 0.9rem;
		outline: none;
		transition: border-color 0.15s;
	}
	:global(.dark) .form-group input,
	:global(.dark) .form-group select,
	:global(.dark) .form-group textarea {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.12);
		color: #e5e7eb;
	}
	.form-group input:focus,
	.form-group select:focus,
	.form-group textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
	}
	.form-group textarea {
		resize: vertical;
		min-height: 60px;
	}

	.form-row {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.5rem;
	}

	.form-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.btn-primary,
	.btn-secondary {
		flex: 1;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		font-size: 0.9rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-primary {
		background: hsl(var(--theme-hue, 165), 70%, 50%);
		color: white;
	}
	.btn-primary:hover {
		background: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.btn-secondary {
		background: var(--btn-regular-bg, #f3f4f6);
		color: var(--deep-text, #1f2937);
	}
	:global(.dark) .btn-secondary {
		background: rgba(255, 255, 255, 0.05);
		color: #e5e7eb;
	}
	.btn-secondary:hover {
		background: var(--btn-hover-bg, #e5e7eb);
	}
	:global(.dark) .btn-secondary:hover {
		background: rgba(255, 255, 255, 0.08);
	}

	@media (max-width: 1024px) {
		.editor-main {
			grid-template-columns: 1fr;
		}
	}
</style>
