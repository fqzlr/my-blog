<script lang="ts">
import { onDestroy, onMount } from "svelte";

interface GuestbookMessage {
	id: string;
	author: string;
	content: string;
	time: string;
}

const WALINE_SERVER = "https://co.tsh520.cn";
const COMMENT_PATH = "/guestbook/";

let allMessages: GuestbookMessage[] = [];
let hasMore = true;
let currentPage = 1;
const PER_PAGE = 50;

function broadcast() {
	window.dispatchEvent(
		new CustomEvent("guestbook:data-update", {
			detail: { messages: allMessages, hasMore },
		}),
	);
}

let isLoading = false;

async function fetchComments() {
	if (isLoading || !hasMore) return;
	isLoading = true;
	try {
		const url = `${WALINE_SERVER}/api/comment?path=${encodeURIComponent(COMMENT_PATH)}&pageSize=${PER_PAGE}&page=${currentPage}`;
		const res = await fetch(url);
		const json = await res.json();
		const result = json.data;
		const comments = result?.data || result || [];
		if (comments.length > 0) {
			const mapped: GuestbookMessage[] = comments.map((c: any) => ({
				id: String(c.objectId),
				author: c.nick || "匿名",
				content: c.comment?.replace(/<[^>]*>/g, "") || "",
				time: c.time ? new Date(c.time).toLocaleDateString("zh-CN") : "",
			}));
			allMessages = [...allMessages, ...mapped];
			currentPage++;
			hasMore = currentPage <= (result?.totalPages || 1);
		} else {
			hasMore = false;
		}
		broadcast();
	} catch (err) {
		console.error("Failed to fetch guestbook comments:", err);
	} finally {
		isLoading = false;
	}
}

function handleRequestData() {
	if (allMessages.length === 0) {
		fetchComments();
	} else {
		broadcast();
	}
}

function handleLoadMore() {
	fetchComments();
}

onMount(() => {
	window.addEventListener("guestbook:request-data", handleRequestData);
	window.addEventListener("guestbook:load-more", handleLoadMore);
	setTimeout(
		() => window.dispatchEvent(new CustomEvent("guestbook:request-data")),
		500,
	);
});

onDestroy(() => {
	window.removeEventListener("guestbook:request-data", handleRequestData);
	window.removeEventListener("guestbook:load-more", handleLoadMore);
});
</script>
<!-- 无可见 UI -->
