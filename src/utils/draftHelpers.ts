/**
 * 草稿暂存辅助函数
 * 为 Gist 类型和 Repo 文件类型的编辑器提供统一的草稿保存/恢复/提交逻辑
 */
import {
	saveDraft,
	getDraftsByPage,
	removeDraft,
	clearDraftsByPage,
	registerSubmitHandler,
	createGist,
	writeGistFile,
	updateRepoFile,
	createRepoFile,
	getRepoFile,
	showToast,
	type DraftChange,
} from "./editMode";

// ============ Gist 类型编辑器草稿辅助 ============

export interface GistDraftContext<T> {
	pageKey: string;
	pageName: string;
	getData: () => T;
	setData: (data: T) => void;
	getOriginalData: () => T;
	setOriginalData: (data: T) => void;
	gistConfig: { gistId: string; fileName: string };
	onSubmitted?: () => void;
}

export function setupGistDrafts<T>(ctx: GistDraftContext<T>) {
	const { pageKey, pageName, getData, setData, getOriginalData, setOriginalData, gistConfig, onSubmitted } = ctx;

	function saveToDrafts(): DraftChange | null {
		const data = getData();
		const original = getOriginalData();
		if (JSON.stringify(data) === JSON.stringify(original) && getDraftsByPage(pageKey).length === 0) {
			showToast("没有需要暂存的更改", "info");
			return null;
		}
		clearDraftsByPage(pageKey);
		const change = saveDraft({
			pageKey,
			pageName,
			description: `更新 ${pageName}`,
			operation: "update",
			payload: {
				type: "gist",
				gistId: gistConfig.gistId,
				fileName: gistConfig.fileName,
				data: JSON.parse(JSON.stringify(data)),
			},
		});
		showToast(`已暂存 ${pageName} 到本地`, "success");
		return change;
	}

	function restoreFromDrafts(): boolean {
		const drafts = getDraftsByPage(pageKey);
		if (drafts.length === 0) return false;
		const latest = drafts[drafts.length - 1];
		if (latest.payload?.type === "gist" && latest.payload.data) {
			setData(latest.payload.data as T);
			if (latest.payload.gistId) {
				gistConfig.gistId = String(latest.payload.gistId);
			}
			showToast(`已恢复 ${pageName} 的暂存数据`, "info");
			return true;
		}
		return false;
	}

	async function doSubmit(data: T, targetGistId: string): Promise<boolean> {
		const content = JSON.stringify(data, null, 2);
		let ok = false;
		let finalGistId = targetGistId;
		if (!finalGistId) {
			finalGistId = await createGist(
				`Blog ${pageName} Data`,
				gistConfig.fileName,
				content,
			);
			if (!finalGistId) {
				showToast(`提交 ${pageName} 失败：创建 Gist 失败，请检查权限`, "error");
				return false;
			}
			gistConfig.gistId = finalGistId;
			ok = true;
		} else {
			ok = await writeGistFile(finalGistId, gistConfig.fileName, content);
		}
		if (ok) {
			setOriginalData(JSON.parse(JSON.stringify(data)));
			showToast(`${pageName} 已提交到 GitHub`, "success");
		} else {
			showToast(`提交 ${pageName} 失败`, "error");
		}
		return ok;
	}

	async function submitDrafts(): Promise<boolean> {
		const drafts = getDraftsByPage(pageKey);
		let dataToSubmit: T;
		let gistIdToUse: string;
		if (drafts.length > 0) {
			const latest = drafts[drafts.length - 1];
			if (latest.payload?.type === "gist" && latest.payload.data) {
				dataToSubmit = latest.payload.data as T;
				gistIdToUse = String(latest.payload.gistId || gistConfig.gistId);
			} else {
				return false;
			}
		} else {
			dataToSubmit = getData();
			gistIdToUse = gistConfig.gistId;
		}
		const original = getOriginalData();
		if (JSON.stringify(dataToSubmit) === JSON.stringify(original) && gistIdToUse) {
			showToast("没有需要提交的更改", "info");
			return false;
		}
		const ok = await doSubmit(dataToSubmit, gistIdToUse);
		if (ok) {
			clearDraftsByPage(pageKey);
			onSubmitted?.();
		}
		return ok;
	}

	registerSubmitHandler(pageKey, async (draft) => {
		if (draft.payload?.type === "gist" && draft.payload.data) {
			return doSubmit(draft.payload.data as T, String(draft.payload.gistId || gistConfig.gistId));
		}
		return false;
	});

	function hasLocalChanges(): boolean {
		return getDraftsByPage(pageKey).length > 0 || JSON.stringify(getData()) !== JSON.stringify(getOriginalData());
	}

	return { saveToDrafts, restoreFromDrafts, submitDrafts, hasLocalChanges, clearDrafts: () => clearDraftsByPage(pageKey) };
}

// ============ Repo 文件类型编辑器草稿辅助 ============

export interface RepoDraftContext {
	pageKey: string;
	pageName: string;
	getContent: () => string;
	setContent: (content: string) => void;
	getPath: () => string;
	getSha: () => string | null;
	setSha: (sha: string | null) => void;
	getOriginalContent: () => string;
	setOriginalContent: (content: string) => void;
	getCommitMsg?: (isEdit: boolean) => string;
	onSubmitted?: () => void;
}

export function setupRepoDrafts(ctx: RepoDraftContext) {
	const { pageKey, pageName, getContent, setContent, getPath, getSha, setSha, getOriginalContent, setOriginalContent, onSubmitted } = ctx;

	function saveToDrafts(): DraftChange | null {
		const content = getContent();
		const original = getOriginalContent();
		if (content === original && getDraftsByPage(pageKey).length === 0) {
			showToast("没有需要暂存的更改", "info");
			return null;
		}
		clearDraftsByPage(pageKey);
		const isEdit = !!getSha() || !!original;
		const change = saveDraft({
			pageKey,
			pageName,
			description: isEdit ? `更新 ${pageName}` : `创建 ${pageName}`,
			operation: isEdit ? "update" : "create",
			payload: {
				type: "repo",
				path: getPath(),
				sha: getSha(),
				content,
				isEdit,
			},
		});
		showToast(`已暂存 ${pageName} 到本地`, "success");
		return change;
	}

	function restoreFromDrafts(): boolean {
		const drafts = getDraftsByPage(pageKey);
		if (drafts.length === 0) return false;
		const latest = drafts[drafts.length - 1];
		if (latest.payload?.type === "repo" && latest.payload.content !== undefined) {
			setContent(String(latest.payload.content));
			showToast(`已恢复 ${pageName} 的暂存数据`, "info");
			return true;
		}
		return false;
	}

	async function doSubmit(content: string, sha: string | null, path: string, isEdit: boolean): Promise<boolean> {
		const commitMsg = ctx.getCommitMsg
			? ctx.getCommitMsg(isEdit)
			: isEdit ? `chore: update ${pageName}` : `chore: create ${pageName}`;
		let ok = false;
		if (isEdit && sha) {
			ok = await updateRepoFile(path, content, sha, commitMsg);
		} else {
			ok = await createRepoFile(path, content, commitMsg);
		}
		if (ok) {
			setOriginalContent(content);
			try {
				const fresh = await getRepoFile(path);
				if (fresh) setSha(fresh.sha);
			} catch {}
			showToast(`${pageName} 已提交到 GitHub`, "success");
		} else {
			showToast(`提交 ${pageName} 失败`, "error");
		}
		return ok;
	}

	async function submitDrafts(): Promise<boolean> {
		const drafts = getDraftsByPage(pageKey);
		let contentToSubmit: string;
		let shaToUse: string | null;
		let pathToUse: string;
		let isEdit: boolean;
		if (drafts.length > 0) {
			const latest = drafts[drafts.length - 1];
			if (latest.payload?.type === "repo" && latest.payload.content !== undefined) {
				contentToSubmit = String(latest.payload.content);
				shaToUse = (latest.payload.sha as string) || null;
				pathToUse = String(latest.payload.path || getPath());
				isEdit = !!latest.payload.isEdit;
			} else {
				return false;
			}
		} else {
			contentToSubmit = getContent();
			shaToUse = getSha();
			pathToUse = getPath();
			isEdit = !!shaToUse;
		}
		if (contentToSubmit === getOriginalContent() && shaToUse) {
			showToast("没有需要提交的更改", "info");
			return false;
		}
		const ok = await doSubmit(contentToSubmit, shaToUse, pathToUse, isEdit);
		if (ok) {
			clearDraftsByPage(pageKey);
			onSubmitted?.();
		}
		return ok;
	}

	registerSubmitHandler(pageKey, async (draft) => {
		if (draft.payload?.type === "repo" && draft.payload.content !== undefined) {
			const path = String(draft.payload.path || getPath());
			const isEdit = !!draft.payload.sha || !!draft.payload.isEdit;
			return doSubmit(String(draft.payload.content), (draft.payload.sha as string) || null, path, isEdit);
		}
		return false;
	});

	function hasLocalChanges(): boolean {
		return getDraftsByPage(pageKey).length > 0 || getContent() !== getOriginalContent();
	}

	return { saveToDrafts, restoreFromDrafts, submitDrafts, hasLocalChanges, clearDrafts: () => clearDraftsByPage(pageKey) };
}
