/**
 * 日历页面客户端数据加载工具
 * 供 CalendarGrid / EventOverview / EventDetailPanel 组件在客户端获取数据
 */

import type { BirthdayItem, ScheduleItem } from "@/types/config";

export interface CalendarConfigData {
	title?: string;
	description?: string;
	show: { posts: boolean; lunarDate: boolean };
	overview: { futureDays: number; maxItems: number };
	birthdays: BirthdayItem[];
	schedules: ScheduleItem[];
}

export interface CalendarAllData {
	config: CalendarConfigData;
	holidays: any[];
	posts: any[];
}

let _cache: CalendarAllData | null = null;
let _promise: Promise<CalendarAllData> | null = null;

async function fetchJson(url: string): Promise<any> {
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		return await res.json();
	} catch {
		return null;
	}
}

async function fetchGitHubJson(path: string): Promise<any> {
	// 优先直接访问 public/ 静态文件（无需 GitHub API 代理，本地开发可用）
	if (path.startsWith("public/")) {
		try {
			const res = await fetch("/" + path.slice(7));
			if (res.ok) return await res.json();
		} catch {}
	}
	const branch =
		(typeof window !== "undefined" && (window as any).__DEPLOY_BRANCH__) ||
		"master";
	const owner = "fqzlr";
	const repo = "my-blog";
	const apiPath = `repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
	const res = await fetch("/api/github", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			path: apiPath,
			method: "GET",
			headers: { Accept: "application/vnd.github+json" },
		}),
	});
	if (!res.ok) throw new Error("HTTP " + res.status);
	const data = await res.json();
	const text = decodeURIComponent(
		escape(atob(data.content.replace(/\n/g, ""))),
	);
	return JSON.parse(text);
}

async function _loadCalendarData(): Promise<CalendarAllData> {
	const [config, holidays, posts] = await Promise.all([
		fetchGitHubJson("public/calendarConfig.json"),
		fetchJson("/api/holidays.json"),
		fetchJson("/api/allPostMeta.json"),
	]);

	return {
		config: config || {
			show: { posts: true, lunarDate: true },
			overview: { futureDays: 30, maxItems: 6 },
			birthdays: [],
			schedules: [],
		},
		holidays: holidays || [],
		posts: posts || [],
	};
}

/**
 * 加载日历所需的全部数据（带缓存，多次调用只请求一次）
 */
export function loadCalendarData(): Promise<CalendarAllData> {
	if (_cache) return Promise.resolve(_cache);
	if (!_promise) {
		_promise = _loadCalendarData().then((data) => {
			_cache = data;
			return data;
		});
	}
	return _promise;
}
