<script lang="ts">
	import { onMount } from "svelte";
	import {
		showToast,
		getRepoFile,
		updateRepoFile,
		hasValidCredentials,
	} from "@/utils/editMode";
	import { buildFriendsConfigTS } from "@/config/friendsConfig";

	interface PendingFriend {
		id: string;
		title: string;
		siteurl: string;
		imgurl: string;
		desc: string;
		tags?: string[];
		appliedAt: string;
	}

	let pendingFriends = $state<PendingFriend[]>([]);
	let loading = $state(true);
	let selectedIds = $state<Set<string>>(new Set());
	let authed = $state(hasValidCredentials());

	onMount(async () => {
		await loadPendingFriends();
	});

	async function loadPendingFriends() {
		loading = true;
		try {
			const response = await fetch("/api/pending-friends");
			if (!response.ok) {
				throw new Error("加载失败");
			}
			const data = await response.json();
			pendingFriends = data.pendingFriends || [];
		} catch (error) {
			console.error("加载待审核友链失败:", error);
			showToast("加载待审核友链失败", "error");
		} finally {
			loading = false;
		}
	}

	function toggleSelect(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
		selectedIds = new Set(selectedIds);
	}

	function selectAll() {
		selectedIds = new Set(pendingFriends.map((f) => f.id));
	}

	function clearSelection() {
		selectedIds.clear();
		selectedIds = new Set(selectedIds);
	}

	async function approveFriend(friend: PendingFriend) {
		if (!authed) {
			showToast("请先导入 GitHub App 私钥", "warning");
			return;
		}

		try {
			// 1. 读取当前的 friendsConfig.ts
			const configResponse = await fetch("/api/config/friends");
			if (!configResponse.ok) {
				throw new Error("读取配置失败");
			}
			const configData = await configResponse.json();
			const currentFriends = configData.friends || [];

			// 2. 添加新友链
			const newFriend = {
				id: friend.id,
				title: friend.title,
				siteurl: friend.siteurl,
				imgurl: friend.imgurl,
				desc: friend.desc,
				tags: friend.tags || ["Blog"],
				enabled: true,
				weight: currentFriends.length + 1,
			};
			currentFriends.push(newFriend);

			// 3. 更新 friendsConfig.ts
			const configContent = buildFriendsConfigTS(currentFriends);
			const updateResponse = await fetch("/api/config/friends", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: configContent }),
			});

			if (!updateResponse.ok) {
				throw new Error("更新配置失败");
			}

			// 4. 从 pending 中移除
			await removeFromPending(friend.id);

			// 5. 刷新列表
			await loadPendingFriends();
			clearSelection();

			showToast(`已批准友链: ${friend.title}`, "success");
		} catch (error) {
			console.error("批准友链失败:", error);
			showToast("批准友链失败: " + (error as Error).message, "error");
		}
	}

	async function rejectFriend(friend: PendingFriend) {
		if (!authed) {
			showToast("请先导入 GitHub App 私钥", "warning");
			return;
		}

		try {
			await removeFromPending(friend.id);
			await loadPendingFriends();
			clearSelection();
			showToast(`已拒绝友链: ${friend.title}`, "success");
		} catch (error) {
			console.error("拒绝友链失败:", error);
			showToast("拒绝友链失败: " + (error as Error).message, "error");
		}
	}

	async function batchApprove() {
		if (selectedIds.size === 0) {
			showToast("请先选择要批准的友链", "warning");
			return;
		}

		if (!authed) {
			showToast("请先导入 GitHub App 私钥", "warning");
			return;
		}

		try {
			const selectedFriends = pendingFriends.filter((f) =>
				selectedIds.has(f.id),
			);

			// 1. 读取当前的 friendsConfig.ts
			const configResponse = await fetch("/api/config/friends");
			if (!configResponse.ok) {
				throw new Error("读取配置失败");
			}
			const configData = await configResponse.json();
			const currentFriends = configData.friends || [];

			// 2. 批量添加友链
			for (const friend of selectedFriends) {
				const newFriend = {
					id: friend.id,
					title: friend.title,
					siteurl: friend.siteurl,
					imgurl: friend.imgurl,
					desc: friend.desc,
					tags: friend.tags || ["Blog"],
					enabled: true,
					weight: currentFriends.length + 1,
				};
				currentFriends.push(newFriend);
			}

			// 3. 更新 friendsConfig.ts
			const configContent = buildFriendsConfigTS(currentFriends);
			const updateResponse = await fetch("/api/config/friends", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ content: configContent }),
			});

			if (!updateResponse.ok) {
				throw new Error("更新配置失败");
			}

			// 4. 批量从 pending 中移除
			for (const friend of selectedFriends) {
				await removeFromPending(friend.id);
			}

			// 5. 刷新列表
			await loadPendingFriends();
			clearSelection();

			showToast(`已批准 ${selectedFriends.length} 个友链`, "success");
		} catch (error) {
			console.error("批量批准失败:", error);
			showToast("批量批准失败: " + (error as Error).message, "error");
		}
	}

	async function batchReject() {
		if (selectedIds.size === 0) {
			showToast("请先选择要拒绝的友链", "warning");
			return;
		}

		if (!authed) {
			showToast("请先导入 GitHub App 私钥", "warning");
			return;
		}

		try {
			const selectedFriends = pendingFriends.filter((f) =>
				selectedIds.has(f.id),
			);

			// 批量从 pending 中移除
			for (const friend of selectedFriends) {
				await removeFromPending(friend.id);
			}

			// 刷新列表
			await loadPendingFriends();
			clearSelection();

			showToast(`已拒绝 ${selectedFriends.length} 个友链`, "success");
		} catch (error) {
			console.error("批量拒绝失败:", error);
			showToast("批量拒绝失败: " + (error as Error).message, "error");
		}
	}

	async function removeFromPending(id: string) {
		const index = pendingFriends.findIndex((f) => f.id === id);
		if (index === -1) return;

		const updated = [...pendingFriends];
		updated.splice(index, 1);

		const content = JSON.stringify(updated, null, 2);
		const encoded = btoa(unescape(encodeURIComponent(content)));

		const response = await fetch("/api/pending-friends", {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				content: encoded,
				message: `chore: remove friend apply ${id}`,
			}),
		});

		if (!response.ok) {
			throw new Error("更新待审核列表失败");
		}
	}

	function formatDate(dateString: string) {
		const date = new Date(dateString);
		return date.toLocaleDateString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		});
	}
</script>

<div class="pending-review-container">
	{#if loading}
		<div class="loading-state">
			<span class="icon-spinner">⏳</span>
			<p>加载中...</p>
		</div>
	{:else if pendingFriends.length === 0}
		<div class="empty-state">
			<span class="icon-check">✓</span>
			<h3>暂无待审核申请</h3>
			<p>当前没有待审核的友链申请</p>
		</div>
	{:else}
		<!-- 批量操作栏 -->
		{#if pendingFriends.length > 0}
			<div class="batch-actions-bar">
				<button
					class="batch-btn select-all-btn"
					onclick={selectAll}
					disabled={selectedIds.size === pendingFriends.length}
				>
					<span class="btn-icon"></span>
					全选 ({selectedIds.size}/{pendingFriends.length})
				</button>
				{#if selectedIds.size > 0}
					<button
						class="batch-btn approve-btn"
						onclick={batchApprove}
					>
						<span class="btn-icon">✓</span>
						批量通过 ({selectedIds.size})
					</button>
					<button
						class="batch-btn reject-btn"
						onclick={batchReject}
					>
						<span class="btn-icon">✗</span>
						批量拒绝 ({selectedIds.size})
					</button>
					<button
						class="batch-btn clear-btn"
						onclick={clearSelection}
					>
						<span class="btn-icon"></span>
						清空选择
					</button>
				{/if}
			</div>
		{/if}

		<!-- 待审核列表 -->
		<div class="pending-list">
			{#each pendingFriends as friend (friend.id)}
				<div class="pending-card {selectedIds.has(friend.id) ? 'selected' : ''}">
					<div class="pending-card-header">
						<input
							type="checkbox"
							class="pending-checkbox"
							checked={selectedIds.has(friend.id)}
							onchange={() => toggleSelect(friend.id)}
						/>
						<h3 class="pending-title">{friend.title}</h3>
						<span class="pending-date">{formatDate(friend.appliedAt)}</span>
					</div>
					<div class="pending-card-body">
						<div class="pending-info">
							<div class="info-row">
								<strong>站点链接:</strong>
								<a href={friend.siteurl} target="_blank" rel="noopener noreferrer" class="link">
									{friend.siteurl}
								</a>
							</div>
							<div class="info-row">
								<strong>头像链接:</strong>
								<a href={friend.imgurl} target="_blank" rel="noopener noreferrer" class="link">
									{friend.imgurl}
								</a>
							</div>
							<div class="info-row">
								<strong>描述:</strong>
								<span>{friend.desc}</span>
							</div>
							{#if friend.tags && friend.tags.length > 0}
								<div class="info-row">
									<strong>标签:</strong>
									<div class="tags">
										{#each friend.tags as tag}
											<span class="tag">{tag}</span>
										{/each}
									</div>
								</div>
							{/if}
						</div>
					</div>
					<div class="pending-card-footer">
						<button
							class="action-btn reject"
							onclick={() => rejectFriend(friend)}
						>
							<span class="btn-icon">✗</span>
							拒绝
						</button>
						<button
							class="action-btn approve"
							onclick={() => approveFriend(friend)}
						>
							<span class="btn-icon">✓</span>
							通过
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.pending-review-container {
		margin-top: 1rem;
	}

	.loading-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 3rem 1rem;
		color: oklch(0.5 0 0);
		text-align: center;
	}

	.icon-spinner,
	.icon-check {
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.empty-state h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 1rem 0 0.5rem;
		color: oklch(0.3 0 0);
	}

	.empty-state p {
		font-size: 0.875rem;
		color: oklch(0.5 0 0);
	}

	.batch-actions-bar {
		display: flex;
		gap: 0.5rem;
		margin-bottom: 1rem;
		padding: 0.75rem;
		background: oklch(0.98 0 0);
		border-radius: var(--radius-medium);
		flex-wrap: wrap;
	}

	:root:global(.dark .batch-actions-bar) {
		background: oklch(0.2 0 0);
	}

	.batch-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-small);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1em;
		height: 1em;
	}

	.select-all-btn {
		background: oklch(0.9 0 0);
		color: oklch(0.3 0 0);
	}

	.select-all-btn:hover:not(:disabled) {
		background: oklch(0.85 0 0);
	}

	.approve-btn {
		background: oklch(0.9 0.05 145);
		color: oklch(0.3 0.1 145);
	}

	.approve-btn:hover {
		background: oklch(0.85 0.06 145);
	}

	.reject-btn {
		background: oklch(0.9 0.05 25);
		color: oklch(0.3 0.1 25);
	}

	.reject-btn:hover {
		background: oklch(0.85 0.06 25);
	}

	.clear-btn {
		background: oklch(0.9 0 0);
		color: oklch(0.3 0 0);
	}

	.clear-btn:hover {
		background: oklch(0.85 0 0);
	}

	.batch-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.pending-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.pending-card {
		background: oklch(1 0 0);
		border: 2px solid oklch(0.9 0 0);
		border-radius: var(--radius-large);
		padding: 1rem;
		transition: all 0.2s ease;
	}

	.pending-card:hover {
		border-color: oklch(0.8 0 0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.pending-card.selected {
		border-color: oklch(0.7 0.1 80);
		background: oklch(0.99 0.01 80);
	}

	:root:global(.dark .pending-card) {
		background: oklch(0.15 0 0);
		border-color: oklch(0.25 0 0);
	}

	:root:global(.dark .pending-card:hover) {
		border-color: oklch(0.35 0 0);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	:root:global(.dark .pending-card.selected) {
		border-color: oklch(0.6 0.1 80);
		background: oklch(0.2 0.02 80);
	}

	.pending-card-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.pending-checkbox {
		width: 1.25rem;
		height: 1.25rem;
		cursor: pointer;
		accent-color: oklch(0.6 0.15 145);
	}

	.pending-title {
		flex: 1;
		font-size: 1.125rem;
		font-weight: 600;
		color: oklch(0.2 0 0);
		margin: 0;
	}

	:root:global(.dark .pending-title) {
		color: oklch(0.9 0 0);
	}

	.pending-date {
		font-size: 0.75rem;
		color: oklch(0.5 0 0);
	}

	.pending-card-body {
		margin-bottom: 1rem;
	}

	.pending-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.info-row {
		display: flex;
		gap: 0.5rem;
		font-size: 0.875rem;
	}

	.info-row strong {
		min-width: 80px;
		color: oklch(0.4 0 0);
		font-weight: 500;
	}

	:root:global(.dark .info-row strong) {
		color: oklch(0.7 0 0);
	}

	.link {
		color: oklch(0.5 0.15 240);
		text-decoration: none;
		word-break: break-all;
	}

	.link:hover {
		text-decoration: underline;
	}

	.tags {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}

	.tag {
		display: inline-block;
		padding: 0.25rem 0.625rem;
		background: oklch(0.95 0 0);
		border-radius: var(--radius-small);
		font-size: 0.75rem;
		color: oklch(0.4 0 0);
	}

	:root:global(.dark .tag) {
		background: oklch(0.25 0 0);
		color: oklch(0.8 0 0);
	}

	.pending-card-footer {
		display: flex;
		gap: 0.5rem;
		justify-content: flex-end;
	}

	.action-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: var(--radius-small);
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.action-btn .btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1em;
		height: 1em;
	}

	.action-btn.reject {
		background: oklch(0.95 0.05 25);
		color: oklch(0.3 0.1 25);
	}

	.action-btn.reject:hover {
		background: oklch(0.9 0.06 25);
	}

	.action-btn.approve {
		background: oklch(0.95 0.05 145);
		color: oklch(0.3 0.1 145);
	}

	.action-btn.approve:hover {
		background: oklch(0.9 0.06 145);
	}

	@media (max-width: 768px) {
		.batch-actions-bar {
			flex-direction: column;
		}

		.batch-btn {
			width: 100%;
			justify-content: center;
		}

		.pending-card-header {
			flex-wrap: wrap;
		}

		.pending-title {
			flex: 1 1 calc(100% - 2.5rem);
		}

		.info-row {
			flex-direction: column;
			gap: 0.25rem;
		}

		.info-row strong {
			min-width: auto;
		}

		.pending-card-footer {
			flex-direction: column;
		}

		.action-btn {
			width: 100%;
			justify-content: center;
		}
	}
</style>
