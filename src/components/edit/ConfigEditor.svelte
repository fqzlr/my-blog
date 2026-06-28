<script lang="ts">
	import { onMount } from "svelte";
	import EditToolbar from "./EditToolbar.svelte";
	import EditToast from "./EditToast.svelte";
	import {
		hasValidToken,
		getRepoFile,
		updateRepoFile,
		showToast,
		deepClone,
		ensureIconify,
	} from "@/utils/editMode";
	import { repoConfig } from "@/config/editConfig";

	// ============ 类型定义（使用 any 兼容完整 siteConfig） ============
	type FullConfig = Record<string, any>;

	// ============ 状态 ============
	let editMode = $state(false);
	let saving = $state(false);
	let hasChanges = $state(false);
	let codeMode = $state(false);

	let config = $state<FullConfig>({});
	let originalConfig = $state<FullConfig>({});
	let codeContent = $state("");

	// 页面开关标签映射
	const pageLabels: Record<string, string> = {
		friends: "友链页面",
		sponsor: "赞助页面",
		guestbook: "留言板",
		gallery: "相册页面",
		collections: "收藏API",
		stats: "统计页面",
		calendar: "日历页面",
		bangumi: "番剧页面",
		books: "书架页面",
		moviesGames: "影视游戏",
		musicPage: "音乐页面",
		changelog: "更新日志",
		moments: "动态页面",
		admin: "后台管理",
		lifeRoutines: "日常规划",
		lifePlaces: "旅行足迹",
		lifeNotebooks: "笔记本",
	};

	// 语言选项
	const langOptions = [
		{ value: "zh_CN", label: "简体中文 (zh_CN)" },
		{ value: "zh_TW", label: "繁體中文 (zh_TW)" },
		{ value: "en", label: "English (en)" },
		{ value: "ja", label: "日本語 (ja)" },
		{ value: "ru", label: "Русский (ru)" },
	];

	// ============ 生命周期 ============
	onMount(() => {
		ensureIconify();
		loadConfig();
	});

	function loadConfig() {
		try {
			const w = window as any;
			if (w.__SITE_CONFIG__) {
				config = deepClone(w.__SITE_CONFIG__);
				// 确保嵌套对象有默认值
				if (!config.themeColor) config.themeColor = { hue: 165, fixed: false, defaultMode: "light" };
				if (!config.navbar) config.navbar = {};
				if (!config.navbar.logo) config.navbar.logo = { type: "icon", value: "", alt: "logo" };
				if (!config.pages) config.pages = {};
				if (!config.pagination) config.pagination = { postsPerPage: 10 };
				if (!config.postListLayout) config.postListLayout = { defaultMode: "list" };
				originalConfig = deepClone(config);
			}
		} catch (e) {
			console.error("Failed to load site config:", e);
		}
	}

	// ============ 安全访问辅助 ============
	function getThemeColor() {
		return config.themeColor || { hue: 165, fixed: false, defaultMode: "light" };
	}
	function getNavbar() {
		return config.navbar || {};
	}
	function getLogo() {
		return config.navbar?.logo || { type: "icon", value: "", alt: "logo" };
	}
	function getPages() {
		return config.pages || {};
	}

	// ============ 编辑模式控制 ============
	function handleModeChange(e: CustomEvent) {
		editMode = e.detail.editing;
		if (editMode) {
			hasChanges = false;
		} else {
			codeMode = false;
		}
	}

	function handleCancel() {
		config = deepClone(originalConfig);
		hasChanges = false;
		codeMode = false;
		showToast("已取消编辑", "info");
	}

	// ============ 表单更新工具 ============
	function setConfig(path: string[], value: any) {
		let obj: any = config;
		for (let i = 0; i < path.length - 1; i++) {
			if (!obj[path[i]]) obj[path[i]] = {};
			obj = obj[path[i]];
		}
		obj[path[path.length - 1]] = value;
		config = { ...config };
		hasChanges = true;
	}

	function updateKeywords(value: string) {
		config.keywords = value
			.split(/[,，]/)
			.map((s) => s.trim())
			.filter(Boolean);
		config = { ...config };
		hasChanges = true;
	}

	function getKeywordsString(): string {
		return (config.keywords || []).join(", ");
	}

	function updatePageField(key: string, value: boolean) {
		config.pages = { ...config.pages, [key]: value };
		hasChanges = true;
	}

	// ============ 代码模式切换 ============
	function toggleCodeMode() {
		if (!codeMode) {
			codeContent = generateTsCode(config);
		}
		codeMode = !codeMode;
	}

	// ============ TypeScript 代码生成 ============
	/**
	 * 基于原始 siteConfig.ts 的模板结构生成完整 TypeScript 代码
	 * 保留所有配置字段，仅替换可编辑部分的值
	 */
	function generateTsCode(cfg: FullConfig): string {
		const tc = cfg.themeColor || {};
		const nb = cfg.navbar || {};
		const logo = nb.logo || {};
		const pg = cfg.pages || {};
		const pl = cfg.postListLayout || {};
		const pn = cfg.pagination || {};
		const wh = cfg.workHours || { start: 9, end: 18, workDays: [1, 2, 3, 4, 5, 6] };
		const cc = cfg.card || { border: true, followTheme: false };
		const favicon = cfg.favicon || [];
		const rc = cfg.rehypeCallouts || { theme: "github" };
		const an = cfg.analytics || {};
		const hm = cfg.heatmap || {};
		const io = cfg.imageOptimization || {};
		const slm = cfg.showLastModified !== undefined ? cfg.showLastModified : true;
		const ot = cfg.outdatedThreshold !== undefined ? cfg.outdatedThreshold : 30;
		const sp = cfg.sharePoster !== undefined ? cfg.sharePoster : true;
		const goi = cfg.generateOgImages !== undefined ? cfg.generateOgImages : false;
		const doi = cfg.defaultOgImage || "/assets/images/aut.webp";
		const cb = cfg.categoryBar !== undefined ? cfg.categoryBar : true;
		const pw = cfg.pageWidth !== undefined ? cfg.pageWidth : 100;

		// 关键词数组
		const kw = cfg.keywords || [];
		const keywordsStr = kw.length > 0
			? kw.map((k: string) => `\t\t"${k}",`).join("\n")
			: "";

		// favicon 数组
		const faviconStr = favicon.length > 0
			? favicon.map((f: any) => {
					const parts: string[] = [];
					if (f.src !== undefined) parts.push(`src: ${JSON.stringify(f.src)}`);
					if (f.sizes !== undefined) parts.push(`sizes: ${JSON.stringify(f.sizes)}`);
					return `\t\t{ ${parts.join(", ")} },`;
				}).join("\n")
			: "";

		// pages 对象
		const pageKeys = Object.keys(pg);
		const pagesStr = pageKeys.map((k) => `\t\t${k}: ${pg[k]},`).join("\n");

		// workDays 数组
		const workDaysStr = (wh.workDays || [1, 2, 3, 4, 5, 6]).join(", ");

		// analytics 序列化
		const googleId = an.googleAnalyticsId || "";
		const msClarityId = an.microsoftClarityId || "";
		const umami = an.umamiAnalytics || {};
		const la51 = an.la51Analytics || {};
		const umamiReplays = umami.relpays || {};
		const ghHeatmap = hm.github || { enabled: true, username: "" };

		return `import type { SiteConfig } from "@/types/config";
import { fontConfig } from "./fontConfig";

// 定义站点语言
// 语言代码，例如：'zh_CN', 'zh_TW', 'en', 'ja', 'ru'。
const SITE_LANG = ${JSON.stringify(cfg.lang || "zh_CN")};

export const siteConfig: SiteConfig = {
\t// 站点标题
\ttitle: ${JSON.stringify(cfg.title || "")},

\t// 站点副标题
\tsubtitle: ${JSON.stringify(cfg.subtitle || "")},

\t// 站点 URL
\tsite_url: ${JSON.stringify(cfg.site_url || "")},

\t// 站点描述
\tdescription: ${JSON.stringify(cfg.description || "")},

\t// 站点关键词
\tkeywords: [
${keywordsStr}
\t],

\t// 主题色
\tthemeColor: {
\t\t// 主题色的默认色相，范围从 0 到 360。例如：红色：0，青色：200，蓝绿色：250，粉色：345
\t\thue: ${tc.hue ?? 165},
\t\t// 是否对访问者隐藏主题色选择器
\t\tfixed: ${tc.fixed ?? false},
\t\t// 默认模式："light" 亮色，"dark" 暗色
\t\tdefaultMode: ${JSON.stringify(tc.defaultMode || "light")},
\t},

\t// 页面整体宽度（单位：rem）
\tpageWidth: ${pw},

\t// 网站Card样式配置
\tcard: {
\t\t// 是否开启卡片边框和阴影，开启后让网站更有立体感
\t\tborder: ${cc.border !== false},
\t\t// 是否让卡片风格跟随主题色相
\t\tfollowTheme: ${cc.followTheme ?? false},
\t},

\t// Favicon 配置
\tfavicon: [
${faviconStr}
\t],

\t// 导航栏配置
\tnavbar: {
\t\t// 导航栏Logo
\t\tlogo: {
\t\t\ttype: ${JSON.stringify(logo.type || "icon")},
\t\t\tvalue: ${JSON.stringify(logo.value || "")},
\t\t\talt: ${JSON.stringify(logo.alt || "logo")},
\t\t},
\t\t// 导航栏标题
\t\ttitle: ${JSON.stringify(nb.title || "")},
\t\t// 全宽导航栏，导航栏是否占满屏幕宽度
\t\twidthFull: ${nb.widthFull ?? false},
\t\t// 导航菜单对齐方式，left：左对齐，center：居中
\t\tmenuAlign: ${JSON.stringify(nb.menuAlign || "center")},
\t\t// 导航栏图标和标题是否跟随主题色
\t\tfollowTheme: ${nb.followTheme ?? false},
\t\t// 导航栏是否固定在顶部并始终可见
\t\tstickyNavbar: ${nb.stickyNavbar !== false},
\t},

\t// 站点开始日期，用于统计运行天数
\tsiteStartDate: ${JSON.stringify(cfg.siteStartDate || "")},

\t// 站点时区（IANA 时区字符串），用于格式化bangumi、rss里的构建日期时间等等..
\ttimezone: ${JSON.stringify(cfg.timezone || "")},

\t// 上下班时间配置（24小时制），用于首页头像涟漪动效和状态按钮
\tworkHours: {
\t\tstart: ${wh.start ?? 9}, // 上班时间
\t\tend: ${wh.end ?? 18}, // 下班时间
\t\tworkDays: [${workDaysStr}],
\t},

\t// 提醒框（Admonitions）配置
\trehypeCallouts: {
\t\ttheme: ${JSON.stringify(rc.theme || "github")},
\t},

\t// 文章页底部的"上次编辑时间"卡片开关
\tshowLastModified: ${slm},

\t// 文章过期阈值（天数），超过此天数才显示"上次编辑"卡片
\toutdatedThreshold: ${ot},

\t// 是否开启分享海报生成功能
\tsharePoster: ${sp},

\t// OpenGraph图片功能,注意开启后要渲染很长时间，不建议本地调试的时候开启
\tgenerateOgImages: ${goi},

\tdefaultOgImage: ${JSON.stringify(doi)},

\t// 页面开关配置 - 控制特定页面的访问权限，设为false会返回404
\tpages: {
${pagesStr}
\t},

\t// 分类导航栏开关，在首页和归档页顶部显示分类快捷导航
\tcategoryBar: ${cb},

\t// 文章列表布局配置
\tpostListLayout: {
\t\t// 默认布局模式："list" 列表模式（单列布局），"grid" 网格模式（多列布局）
\t\tdefaultMode: ${JSON.stringify(pl.defaultMode || "list")},
\t\t// 移动端默认布局模式，不设置则跟随 defaultMode
\t\tmobileDefaultMode: ${JSON.stringify(pl.mobileDefaultMode || "list")},
\t\t// 是否在文章列表中显示标签
\t\tshowTags: ${pl.showTags !== false},
\t\t// 文章简介显示行数，设为 0 则不截断
\t\tdescriptionLines: ${pl.descriptionLines ?? 2},
\t\t// 是否允许用户切换布局
\t\tallowSwitch: ${pl.allowSwitch !== false},
\t\t// 网格布局配置
\t\tgrid: {
\t\t\t// 是否开启瀑布流布局
\t\t\tmasonry: ${pl.grid?.masonry ?? false},
\t\t\t// 网格模式卡片最小宽度(px)
\t\t\tcolumnWidth: ${pl.grid?.columnWidth ?? 320},
\t\t},
\t},

\t// 分页配置
\tpagination: {
\t\t// 每页显示的文章数量
\t\tpostsPerPage: ${pn.postsPerPage ?? 10},
\t},

\t// 统计分析
\tanalytics: {
\t\t// Google Analytics ID
\t\tgoogleAnalyticsId: ${JSON.stringify(googleId)},
\t\t// Microsoft Clarity ID
\t\tmicrosoftClarityId: ${JSON.stringify(msClarityId)},
\t\t// Umami 统计配置
\t\tumamiAnalytics: {
\t\t\twebsiteId: ${JSON.stringify(umami.websiteId || "")},
\t\t\tshareId: ${JSON.stringify(umami.shareId || "")},
\t\t\tscriptUrl: ${JSON.stringify(umami.scriptUrl || "")},
\t\t\t// 是否追踪出站链接
\t\t\ttrackOutboundLinks: ${umami.trackOutboundLinks !== false},
\t\t\t// 是否收集浏览器性能指标
\t\t\tcollectWebVitals: ${umami.collectWebVitals ?? false},
\t\t\t// 会话回放配置
\t\t\trelpays: {
\t\t\t\t// 是否启用会话回放
\t\t\t\tenabled: ${umamiReplays.enabled ?? false},
\t\t\t\t// 录制会话采样率，范围 0-1
\t\t\t\tsampleRate: ${umamiReplays.sampleRate ?? 0.15},
\t\t\t\t// 隐私遮罩级别
\t\t\t\tmaskLevel: ${JSON.stringify(umamiReplays.maskLevel || "moderate")},
\t\t\t\t// 单次录制最大时长（毫秒）
\t\t\t\tmaxDuration: ${umamiReplays.maxDuration ?? 300000},
\t\t\t\t// 需要排除录制的元素 CSS 选择器
\t\t\t\tblockSelector: ${JSON.stringify(umamiReplays.blockSelector || "")},
\t\t\t},
\t\t},
\t\t// 51la 统计配置
\t\tla51Analytics: {
\t\t\t// 51la 统计 ID
\t\t\tId: ${JSON.stringify(la51.Id || "")},
\t\t\t// 自定义 SDK JS 地址
\t\t\tsdkUrl: ${JSON.stringify(la51.sdkUrl || "")},
\t\t\t// 多个统计 ID 的数据分离标识
\t\t\tck: ${JSON.stringify(la51.ck || "")},
\t\t\t// 是否开启事件分析功能
\t\t\tautoTrack: ${la51.autoTrack ?? false},
\t\t\t// Hash路由模式
\t\t\thashMode: ${la51.hashMode ?? false},
\t\t\t// 是否开启网站录屏功能
\t\t\tscreenRecord: ${la51.screenRecord !== false},
\t\t},
\t},

\t// 热力图配置
\theatmap: {
\t\tgithub: {
\t\t\tenabled: ${ghHeatmap.enabled !== false},
\t\t\tusername: ${JSON.stringify(ghHeatmap.username || "")},
\t\t},
\t},

\t// 图像优化及响应式配置
\timageOptimization: {
\t\t// 输出图片格式
\t\tformats: ${JSON.stringify(io.formats || "webp")},
\t\t// 图片压缩质量 (1-100)
\t\tquality: ${io.quality ?? 85},
\t\t// 为特定域名的图片添加 referrerpolicy="no-referrer" 属性
\t\tnoReferrerDomains: ${JSON.stringify(io.noReferrerDomains || [])},
\t},

\t// 字体配置
\tfont: fontConfig,

\t// 站点语言，在本配置文件顶部SITE_LANG定义
\tlang: SITE_LANG,

\t// 备案号配置，留空则不显示
\tbeian: ${JSON.stringify(cfg.beian || "")},

\t// 公安网备号配置，留空则不显示
\tpoliceBeian: ${JSON.stringify(cfg.policeBeian || "")},
};
`;
	}

	// ============ 保存到 GitHub ============
	async function handleSave() {
		if (!hasValidToken()) {
			showToast("请先导入密钥再保存", "warning");
			return;
		}
		saving = true;
		try {
			const filePath = "src/config/siteConfig.ts";
			const newContent = codeMode ? codeContent : generateTsCode(config);

			// 先获取当前文件的 SHA
			const existing = await getRepoFile(filePath, repoConfig);
			if (!existing) {
				showToast("无法获取远程文件信息，请检查仓库权限", "error");
				saving = false;
				return;
			}

			const ok = await updateRepoFile(
				filePath,
				newContent,
				existing.sha,
				"chore: 更新站点配置",
				repoConfig,
			);

			if (ok) {
				showToast("保存成功！配置将在部署后生效", "success");
				hasChanges = false;
				originalConfig = deepClone(config);
				setTimeout(() => window.location.reload(), 1500);
			} else {
				showToast("保存失败，请检查 Token 权限（需要 repo 权限）", "error");
			}
		} catch (e) {
			showToast("保存失败：" + (e as Error).message, "error");
		}
		saving = false;
	}

	const huePreviewColor = $derived(`hsl(${getThemeColor().hue}, 70%, 50%)`);
</script>

<EditToast />

<!-- 编辑工具栏 -->
<div class="config-edit-toolbar">
	<EditToolbar
		pageName="站点配置"
		{saving}
		{hasChanges}
		showAddButton={false}
		on:modeChange={(e) => handleModeChange(e)}
		on:save={() => handleSave()}
		on:cancel={() => handleCancel()}
	/>
	{#if editMode}
		<button
			class="code-toggle-btn"
			class:code-toggle-btn-active={codeMode}
			onclick={toggleCodeMode}
			title={codeMode ? "切换到可视化编辑" : "切换到代码编辑"}
		>
			<iconify-icon icon={codeMode ? "material-symbols:visibility-rounded" : "material-symbols:code-rounded"} class="text-sm"></iconify-icon>
			{codeMode ? "可视化" : "代码"}
		</button>
	{/if}
</div>

<!-- 编辑模式内容 -->
{#if editMode}
	{#if codeMode}
		<!-- 代码编辑模式 -->
		<div class="config-card">
			<div class="config-card-header">
				<iconify-icon icon="material-symbols:code-rounded" class="text-lg"></iconify-icon>
				<h3>TypeScript 代码编辑</h3>
			</div>
			<div class="code-editor-wrap">
				<textarea
					bind:value={codeContent}
					class="code-textarea"
					spellcheck="false"
					oninput={() => (hasChanges = true)}
				></textarea>
			</div>
		</div>
	{:else}
		<!-- 可视化表单编辑模式 -->
		<div class="config-form">
			<!-- a. 基础信息 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:info-outline-rounded" class="text-lg"></iconify-icon>
					<h3>基础信息</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点标题</label>
							<input
								type="text"
								value={config.title || ""}
								oninput={(e) => setConfig(["title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点标题"
							/>
						</div>
						<div class="form-group">
							<label>副标题</label>
							<input
								type="text"
								value={config.subtitle || ""}
								oninput={(e) => setConfig(["subtitle"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="站点副标题"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点 URL</label>
							<input
								type="url"
								value={config.site_url || ""}
								oninput={(e) => setConfig(["site_url"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="https://example.com/"
							/>
						</div>
						<div class="form-group form-group-full">
							<label>站点描述</label>
							<textarea
								value={config.description || ""}
								oninput={(e) => setConfig(["description"], (e.target as HTMLTextAreaElement).value)}
								class="form-textarea"
								rows={2}
								placeholder="用于 SEO meta description"
							></textarea>
						</div>
						<div class="form-group form-group-full">
							<label>关键词（逗号分隔）</label>
							<input
								type="text"
								value={getKeywordsString()}
								oninput={(e) => updateKeywords((e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="关键词1, 关键词2, 关键词3"
							/>
						</div>
						<div class="form-group">
							<label>语言</label>
							<select
								value={config.lang || "zh_CN"}
								onchange={(e) => setConfig(["lang"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								{#each langOptions as opt}
									<option value={opt.value}>{opt.label}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>
			</div>

			<!-- b. 主题设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:palette-outline-rounded" class="text-lg"></iconify-icon>
					<h3>主题设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group form-group-full">
							<label>
								主题色 Hue:
								<span class="hue-value" style="color:{huePreviewColor}">{getThemeColor().hue}</span>
							</label>
							<div class="hue-slider-wrap">
								<input
									type="range"
									min={0}
									max={360}
									value={getThemeColor().hue}
									oninput={(e) => setConfig(["themeColor", "hue"], parseInt((e.target as HTMLInputElement).value))}
									class="hue-slider"
									style={`--hue-preview:${huePreviewColor}`}
								/>
								<div class="hue-preview-dot" style={`background:${huePreviewColor}`}></div>
							</div>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getThemeColor().fixed}
									onchange={(e) => setConfig(["themeColor", "fixed"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>固定主题色（隐藏选择器）</span>
							</label>
						</div>
						<div class="form-group">
							<label>默认模式</label>
							<select
								value={getThemeColor().defaultMode || "light"}
								onchange={(e) => setConfig(["themeColor", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="light">浅色 (light)</option>
								<option value="dark">暗色 (dark)</option>
								<option value="auto">跟随系统 (auto)</option>
							</select>
						</div>
					</div>
				</div>
			</div>

			<!-- c. 导航栏设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:navigation-rounded" class="text-lg"></iconify-icon>
					<h3>导航栏设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>Logo 类型</label>
							<select
								value={getLogo().type || "icon"}
								onchange={(e) => setConfig(["navbar", "logo", "type"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="icon">图标 (icon)</option>
								<option value="image">本地图片 (image)</option>
								<option value="url">网络图片 (url)</option>
							</select>
						</div>
						<div class="form-group">
							<label>Logo 值</label>
							<input
								type="text"
								value={getLogo().value || ""}
								oninput={(e) => setConfig(["navbar", "logo", "value"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder={getLogo().type === "icon" ? "material-symbols:home" : "图片路径或URL"}
							/>
						</div>
						<div class="form-group">
							<label>导航标题</label>
							<input
								type="text"
								value={getNavbar().title || ""}
								oninput={(e) => setConfig(["navbar", "title"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则使用站点标题"
							/>
						</div>
						<div class="form-group">
							<label>菜单对齐</label>
							<select
								value={getNavbar().menuAlign || "center"}
								onchange={(e) => setConfig(["navbar", "menuAlign"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="left">左对齐 (left)</option>
								<option value="center">居中 (center)</option>
							</select>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().widthFull ?? false}
									onchange={(e) => setConfig(["navbar", "widthFull"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>全宽导航栏</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().followTheme ?? false}
									onchange={(e) => setConfig(["navbar", "followTheme"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>图标标题跟随主题色</span>
							</label>
						</div>
						<div class="form-group form-check-group">
							<label class="form-check-label">
								<input
									type="checkbox"
									checked={getNavbar().stickyNavbar !== false}
									onchange={(e) => setConfig(["navbar", "stickyNavbar"], (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span>固定导航栏</span>
							</label>
						</div>
					</div>
				</div>
			</div>

			<!-- d. 页面开关 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:toggle-on-outline-rounded" class="text-lg"></iconify-icon>
					<h3>页面开关</h3>
				</div>
				<div class="config-card-body">
					<div class="pages-grid">
						{#each Object.entries(getPages()) as [key, val]}
							<label class="page-toggle-item" class:page-toggle-off={!val}>
								<input
									type="checkbox"
									checked={val}
									onchange={(e) => updatePageField(key, (e.target as HTMLInputElement).checked)}
									class="form-check"
								/>
								<span class="page-toggle-label">{pageLabels[key] || key}</span>
								<span class="page-toggle-key">{key}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<!-- e. 页脚信息 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:verified-outline-rounded" class="text-lg"></iconify-icon>
					<h3>页脚备案信息</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>ICP 备案号</label>
							<input
								type="text"
								value={config.beian || ""}
								oninput={(e) => setConfig(["beian"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则不显示"
							/>
						</div>
						<div class="form-group">
							<label>公安备案号</label>
							<input
								type="text"
								value={config.policeBeian || ""}
								oninput={(e) => setConfig(["policeBeian"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="留空则不显示"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- f. 其他设置 -->
			<div class="config-card">
				<div class="config-card-header">
					<iconify-icon icon="material-symbols:settings-outline-rounded" class="text-lg"></iconify-icon>
					<h3>其他设置</h3>
				</div>
				<div class="config-card-body">
					<div class="form-grid">
						<div class="form-group">
							<label>站点开始日期</label>
							<input
								type="date"
								value={config.siteStartDate || ""}
								oninput={(e) => setConfig(["siteStartDate"], (e.target as HTMLInputElement).value)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>时区</label>
							<input
								type="text"
								value={config.timezone || ""}
								oninput={(e) => setConfig(["timezone"], (e.target as HTMLInputElement).value)}
								class="form-input"
								placeholder="Asia/Shanghai"
							/>
						</div>
						<div class="form-group">
							<label>每页文章数</label>
							<input
								type="number"
								min={1}
								max={50}
								value={config.pagination?.postsPerPage ?? 10}
								oninput={(e) => setConfig(["pagination", "postsPerPage"], parseInt((e.target as HTMLInputElement).value) || 10)}
								class="form-input"
							/>
						</div>
						<div class="form-group">
							<label>文章列表默认模式</label>
							<select
								value={config.postListLayout?.defaultMode || "list"}
								onchange={(e) => setConfig(["postListLayout", "defaultMode"], (e.target as HTMLSelectElement).value)}
								class="form-select"
							>
								<option value="list">列表模式 (list)</option>
								<option value="grid">网格模式 (grid)</option>
							</select>
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* 工具栏区域 */
	.config-edit-toolbar {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.code-toggle-btn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 7px 14px;
		border-radius: 10px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		border: 1.5px solid var(--border, #e5e7eb);
		background: var(--card-bg, white);
		color: var(--text-secondary, #6b7280);
		white-space: nowrap;
	}
	.code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 60%, 50%);
		color: hsl(var(--theme-hue, 165), 70%, 45%);
	}
	.code-toggle-btn-active {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%) !important;
		color: hsl(var(--theme-hue, 165), 70%, 45%) !important;
		background: color-mix(in srgb, hsl(var(--theme-hue, 165), 70%, 50%) 8%, transparent) !important;
	}
	:global(.dark) .code-toggle-btn {
		background: rgba(255, 255, 255, 0.05);
		border-color: rgba(255, 255, 255, 0.15);
		color: rgba(255, 255, 255, 0.7);
	}
	:global(.dark) .code-toggle-btn:hover {
		border-color: hsl(var(--theme-hue, 165), 60%, 60%);
		color: hsl(var(--theme-hue, 165), 70%, 65%);
	}

	/* 配置卡片 */
	.config-form {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.config-card {
		border-radius: 16px;
		background: var(--card-bg, white);
		border: 1px solid var(--border, rgba(0, 0, 0, 0.08));
		overflow: hidden;
		transition: border-color 0.2s;
	}
	:global(.dark) .config-card {
		background: rgba(23, 23, 23, 0.8);
		border-color: rgba(255, 255, 255, 0.08);
	}
	.config-card:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.2);
	}

	.config-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.06));
		color: hsl(var(--theme-hue, 165), 70%, 45%);
		font-weight: 600;
		font-size: 15px;
	}
	:global(.dark) .config-card-header {
		border-bottom-color: rgba(255, 255, 255, 0.06);
	}
	.config-card-header h3 {
		margin: 0;
		font-size: 15px;
		font-weight: 600;
	}

	.config-card-body {
		padding: 18px 20px;
	}

	/* 表单网格 */
	.form-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 14px;
	}
	.form-group-full {
		grid-column: 1 / -1;
	}

	.form-group label {
		display: block;
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary, #4b5563);
		margin-bottom: 5px;
	}
	:global(.dark) .form-group label {
		color: #d1d5db;
	}

	.hue-value {
		font-weight: 700;
		margin-left: 6px;
		font-variant-numeric: tabular-nums;
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
		transition: border-color 0.2s, box-shadow 0.2s;
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

	/* Hue 滑块 */
	.hue-slider-wrap {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.hue-slider {
		flex: 1;
		-webkit-appearance: none;
		appearance: none;
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			hsl(0, 70%, 50%),
			hsl(60, 70%, 50%),
			hsl(120, 70%, 50%),
			hsl(180, 70%, 50%),
			hsl(240, 70%, 50%),
			hsl(300, 70%, 50%),
			hsl(360, 70%, 50%)
		);
		outline: none;
		cursor: pointer;
	}
	.hue-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(165, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
		transition: transform 0.15s;
	}
	.hue-slider::-webkit-slider-thumb:hover {
		transform: scale(1.15);
	}
	.hue-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--hue-preview, hsl(165, 70%, 50%));
		border: 3px solid white;
		box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
		cursor: pointer;
	}
	.hue-preview-dot {
		width: 28px;
		height: 28px;
		border-radius: 8px;
		flex-shrink: 0;
		border: 2px solid var(--border, rgba(0,0,0,0.1));
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
	}
	:global(.dark) .hue-preview-dot {
		border-color: rgba(255,255,255,0.15);
	}

	/* 复选框 */
	.form-check-group {
		display: flex;
		align-items: center;
	}
	.form-check-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text-color, #1f2937);
		margin-top: 20px;
		font-weight: 500;
	}
	:global(.dark) .form-check-label {
		color: #d1d5db;
	}
	.form-check {
		width: 18px;
		height: 18px;
		accent-color: hsl(var(--theme-hue, 165), 70%, 50%);
		cursor: pointer;
		border-radius: 4px;
	}

	/* 页面开关网格 */
	.pages-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 8px;
	}
	.page-toggle-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 8px;
		border: 1px solid var(--border, rgba(0,0,0,0.06));
		background: var(--bg-color, #fafafa);
		cursor: pointer;
		transition: all 0.15s;
	}
	:global(.dark) .page-toggle-item {
		background: rgba(255,255,255,0.03);
		border-color: rgba(255,255,255,0.06);
	}
	.page-toggle-item:hover {
		border-color: hsla(var(--theme-hue, 165), 70%, 50%, 0.3);
		background: color-mix(in srgb, hsl(var(--theme-hue, 165), 70%, 50%) 5%, transparent);
	}
	.page-toggle-off {
		opacity: 0.6;
	}
	.page-toggle-label {
		font-size: 13px;
		font-weight: 500;
		color: var(--text-color, #1f2937);
		flex: 1;
	}
	:global(.dark) .page-toggle-label {
		color: #d1d5db;
	}
	.page-toggle-key {
		font-size: 11px;
		color: var(--content-meta, #9ca3af);
		font-family: monospace;
	}

	/* 代码编辑器 */
	.code-editor-wrap {
		padding: 16px 20px;
	}
	.code-textarea {
		width: 100%;
		min-height: 500px;
		padding: 14px;
		border: 1.5px solid var(--border, #d1d5db);
		border-radius: 10px;
		font-family: "Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace;
		font-size: 13px;
		line-height: 1.6;
		background: var(--bg-color, #fafafa);
		color: var(--text-color, #1f2937);
		outline: none;
		resize: vertical;
		tab-size: 2;
		box-sizing: border-box;
		white-space: pre;
		overflow: auto;
	}
	:global(.dark) .code-textarea {
		background: #0d0d18;
		border-color: #374151;
		color: #e5e7eb;
	}
	.code-textarea:focus {
		border-color: hsl(var(--theme-hue, 165), 70%, 50%);
		box-shadow: 0 0 0 2px hsla(var(--theme-hue, 165), 70%, 50%, 0.1);
	}
</style>
