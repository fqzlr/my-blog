<script lang="ts">
import { onDestroy, onMount } from "svelte";

interface Msg {
	id: string;
	author: string;
	content: string;
	time: string;
}

const WALINE = "https://co.tsh520.cn";
const PATH = "/guestbook/";
const PER_PAGE = 50;

let allMessages: Msg[] = $state([]);
let currentIndex: number = $state(0);
let isDragging: boolean = $state(false);
let startX = 0,
	startY = 0,
	currentX = $state(0),
	currentY = $state(0);
let flyOutTransform: string | null = $state(null);
let flyDirection: "left" | "right" | "up" | null = $state(null);
let enteringId: string | null = $state(null);
let enterTransform: string | null = $state(null);
let rafId: number | null = null;
let timers: ReturnType<typeof setTimeout>[] = [];
let page = 1;
let hasMore = $state(true);
let fetching = false;
let visibleCards = $derived(
	allMessages
		.slice(currentIndex, currentIndex + 5)
		.map((m, i) => ({ ...m, si: i })),
);
let topCard = $derived(visibleCards[0]);

onDestroy(() => {
	if (rafId) cancelAnimationFrame(rafId);
	timers.forEach((t) => clearTimeout(t));
	timers = [];
});

onMount(() => {
	fetchComments();
});

function st(fn: () => void, ms: number) {
	const id = setTimeout(() => {
		fn();
		timers = timers.filter((t) => t !== id);
	}, ms);
	timers.push(id);
}

function cardStyle(si: number, cx: number, cy: number, cardId?: string) {
	if (si === 0 && flyOutTransform) return flyOutTransform;
	if (si === 0 && isDragging)
		return `transform: translate3d(${cx}px, ${cy}px, 0) rotate(${cx * 0.05}deg) scale(1.02); z-index: 100; opacity: 1;`;
	if (si === 0)
		return "transform: translate3d(0,0,0) scale(1) rotate(0deg); z-index: 100; opacity: 1;";
	if (cardId && enteringId === cardId && enterTransform)
		return `${enterTransform} z-index: ${100 - si}; pointer-events: none;`;
	const o = si * 3;
	return `transform: translate3d(${o}px, ${o * 5}px, 0) scale(${1 - si * 0.03}) rotate(${si * -1.8}deg); z-index: ${100 - si}; opacity: ${Math.max(0.5, 1 - si * 0.12)}; pointer-events: none;`;
}

function onDown(e: PointerEvent) {
	if ((e.target as HTMLElement).closest("button")) return;
	isDragging = true;
	startX = e.clientX;
	startY = e.clientY;
	currentX = 0;
	currentY = 0;
	flyDirection = null;
	(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
	if (!isDragging) return;
	if (rafId) cancelAnimationFrame(rafId);
	rafId = requestAnimationFrame(() => {
		currentX = e.clientX - startX;
		currentY = e.clientY - startY;
		rafId = null;
	});
}
function onUp() {
	if (!isDragging) return;
	isDragging = false;
	if (rafId) {
		cancelAnimationFrame(rafId);
		rafId = null;
	}
	if (!topCard) return;
	const ax = Math.abs(currentX),
		ay = Math.abs(currentY);
	if (ax > 60 || ay > 60) {
		const d = currentX > 0 ? "right" : currentX < 0 ? "left" : "up";
		flyDirection = d;
		const fx = d === "right" ? 700 : d === "left" ? -700 : currentX * 0.3;
		const fy = d === "up" ? -600 : currentY * 0.3;
		flyOutTransform = `transform: translate3d(${fx}px, ${fy}px, 0) rotate(${currentX * 0.06}deg) scale(0.85); transition: transform 0.45s cubic-bezier(0.22,0.68,0.25,1), opacity 0.45s; opacity: 0;`;
		st(() => {
			currentIndex++;
			currentX = 0;
			currentY = 0;
			flyOutTransform = null;
			flyDirection = null;
			checkLoadMore();
		}, 450);
	} else {
		currentX = 0;
		currentY = 0;
		flyDirection = null;
	}
}

function playDeal(batch: Msg[]) {
	enteringId = null;
	enterTransform = null;
	const traj = [
		{ x: -600, y: 50, rot: -25 },
		{ x: 600, y: -30, rot: 20 },
		{ x: 0, y: -500, rot: -10 },
		{ x: -450, y: -350, rot: 30 },
		{ x: 500, y: 300, rot: -18 },
	];
	for (let i = 0; i < batch.length; i++) {
		st(() => {
			const t = traj[i % traj.length];
			enteringId = batch[i].id;
			enterTransform = `transform: translate3d(${t.x}px, ${t.y}px, 0) rotate(${t.rot}deg) scale(0.6); opacity: 0;`;
			requestAnimationFrame(() => {
				enteringId = null;
				enterTransform = null;
			});
		}, i * 220);
	}
}

function openDetail(card: Msg, e: Event) {
	e.stopPropagation();
	window.dispatchEvent(
		new CustomEvent("guestbook:open-detail", { detail: card }),
	);
}

function checkLoadMore() {
	if (!fetching && hasMore && currentIndex + 5 >= allMessages.length) {
		fetchComments();
	}
}

async function fetchComments() {
	if (fetching || !hasMore) return;
	fetching = true;
	try {
		const url = `${WALINE}/api/comment?path=${encodeURIComponent(PATH)}&pageSize=${PER_PAGE}&page=${page}`;
		const res = await fetch(url);
		const json = await res.json();
		const result = json.data;
		const comments = result?.data || result || [];
		if (comments.length > 0) {
			const mapped: Msg[] = comments.map((c: any) => ({
				id: String(c.objectId),
				author: c.nick || "匿名",
				content: c.comment?.replace(/<[^>]*>/g, "") || "",
				time: c.time ? new Date(c.time).toLocaleDateString("zh-CN") : "",
			}));
			const isFirst = allMessages.length === 0;
			allMessages = [...allMessages, ...mapped];
			page++;
			hasMore = page <= (result?.totalPages || 1);
			if (isFirst) playDeal(allMessages.slice(0, 5));
		} else {
			hasMore = false;
		}
	} catch (err) {
		console.error("Guestbook fetch error:", err);
	} finally {
		fetching = false;
	}
}

onMount(() => {
	// 防止 Swup 导航留下旧组件残留 DOM
	const container = document.querySelector(".guestbook-card-stack");
	if (container) {
		const selfEl = container.closest(".svelte-scope") || container;
		document.querySelectorAll(".guestbook-card-stack").forEach((el) => {
			if (el !== container && el.closest(".svelte-scope") !== selfEl) {
				el.classList.add("stale-gb");
				(el as HTMLElement).style.display = "none";
			}
		});
	}
	fetchComments();
});
</script>

<div class="guestbook-card-stack">
  <div class="stack-bg-decoration"></div>
  <div class="cards-container">
    {#each visibleCards as card (card.id)}
      <div class="message-card" class:top-card={card.si === 0} class:is-dragging={card.si === 0 && isDragging}
           style="{cardStyle(card.si, currentX, currentY, card.id)}"
           onpointerdown={card.si === 0 ? onDown : undefined}
           onpointermove={card.si === 0 ? onMove : undefined}
           onpointerup={card.si === 0 ? onUp : undefined}
           onpointercancel={card.si === 0 ? onUp : undefined}
           role="button" tabindex={card.si === 0 ? 0 : -1}>
        <div class="card-inner">
          <div class="corner top-left"></div><div class="corner top-right"></div><div class="corner bottom-left"></div><div class="corner bottom-right"></div>
          <div class="card-hdr"><div class="hdr-bg"></div><div class="hdr-inner"><div class="auth"><div class="dot"></div><span class="name">{card.author}</span></div><span class="time">{card.time}</span></div></div>
          <div class="card-bd"><div class="bd-line"></div><div class="bd-text"><p class="msg">{card.content}</p></div></div>
          <button class="card-ft" onclick={(e) => openDetail(card, e)}><span class="ft-text">查看详情 &gt;&gt;</span></button>
          {#if card.si === 0 && isDragging && flyDirection}<div class="dir-label">{flyDirection === "right" ? "已读 →" : flyDirection === "left" ? "← 跳过" : "↑ 收起"}</div>{/if}
          {#if card.si > 0}<div class="overlay" style="opacity: {Math.min(0.6, card.si * 0.15)}"></div>{/if}
        </div>
      </div>
    {/each}
    {#if visibleCards.length === 0}
      <div class="empty"><div class="empty-text">暂无留言</div><div class="empty-sub">成为第一个留言的人吧</div></div>
    {/if}
  </div>
  <div class="hint"><span>← 左滑跳过 · 右滑已读 → · 上滑收起 ↑</span></div>
</div>

<style>
  .guestbook-card-stack {
    --cbg: #fff; --cbd: #18181b; --ct: #18181b; --cts: #52525b; --cln: #d4d4d8; --ccr: #f4f4f5; --cftbg: #18181b; --cftt: #fff;
    position: relative; width: 100%; min-height: 560px; overflow: hidden;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: transparent; border: 2px solid var(--cbd); border-radius: 16px; padding: 20px;
  }
  :root.dark .guestbook-card-stack {
    --cbg: #1c1c1e; --cbd: #3f3f46; --ct: #fafafa; --cts: #a1a1aa; --cln: #3f3f46; --ccr: #27272a; --cftbg: #fafafa; --cftt: #18181b;
    box-shadow: 0 0 40px rgba(255,255,255,0.03), 0 0 80px rgba(255,255,255,0.01);
  }
  .stack-bg-decoration { position: absolute; inset: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, rgba(128,128,128,0.05) 0%, transparent 70%); }
  :root.dark .stack-bg-decoration { background: radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0.04) 0%, transparent 70%); }
  .cards-container { position: relative; width: 80%; max-width: 320px; height: 400px; display: flex; justify-content: center; align-items: center; }
  .message-card { position: absolute; width: 100%; height: 100%; touch-action: none; user-select: none; will-change: transform, opacity; transition: transform 0.5s cubic-bezier(0.22,0.68,0.25,1), opacity 0.5s cubic-bezier(0.22,0.68,0.25,1); }
  .message-card.top-card { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%2322c55e' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M7 11.5a.5.5 0 0 1 .5-.5h1a1.5 1.5 0 0 1 1.5 1.5v3.5l-3-4.5Z'/%3E%3Cpath d='M12 7a1 1 0 0 1 1-1h.5a.5.5 0 0 1 .5.5V12'/%3E%3Cpath d='M17 9a1 1 0 0 1 1-1h.5a.5.5 0 0 1 .5.5V18a3 3 0 0 1-3 3h-3a3 3 0 0 1-2.6-1.5L7.4 14.6a1 1 0 0 1 .2-1.4L8 13'/%3E%3C/g%3E%3C/svg%3E") 12 12, grab; } .message-card.top-card:active { cursor: grabbing; }
  .card-inner { position: relative; width: 100%; height: 100%; background: var(--cbg); border: 4px solid var(--cbd); border-radius: 0.5rem; overflow: hidden; display: flex; flex-direction: column; }
  .overlay { position: absolute; inset: 0; background: #000; pointer-events: none; z-index: 25; }
  :root.dark .overlay { background: #000; mix-blend-mode: multiply; }
  .corner { position: absolute; width: 0.5rem; height: 0.5rem; border-radius: 50%; border: 1px solid var(--cbd); background: var(--ccr); z-index: 20; }
  .corner::after { content: ""; position: absolute; inset: 0; margin: auto; width: 60%; height: 1px; background: var(--cbd); transform: rotate(45deg); }
  .corner.top-left { top: 0.5rem; left: 0.5rem; } .corner.top-right { top: 0.5rem; right: 0.5rem; }
  .corner.bottom-left { bottom: 0.5rem; left: 0.5rem; } .corner.bottom-right { bottom: 0.5rem; right: 0.5rem; }
  .card-hdr { position: relative; height: 3.5rem; border-bottom: 2px solid var(--cbd); padding: 0 1rem; display: flex; align-items: center; justify-content: space-between; overflow: hidden; }
  .hdr-bg { position: absolute; inset: 0; opacity: 0.06; pointer-events: none; background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, var(--ct) 5px, var(--ct) 10px); }
  .hdr-inner { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; width: 100%; }
  .auth { display: flex; align-items: center; gap: 0.5rem; } .dot { width: 0.75rem; height: 0.75rem; background: var(--ct); border-radius: 0.125rem; animation: pulse 2s cubic-bezier(0.4,0,0.6,1) infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
  .name { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--ct); }
  .time { font-size: 0.65rem; font-family: ui-monospace, monospace; opacity: 0.6; color: var(--cts); }
  .card-bd { position: relative; flex: 1; padding: 1.5rem; display: flex; overflow: hidden; }
  .bd-line { position: absolute; left: 1rem; top: 1.5rem; bottom: 1.5rem; width: 1px; background: var(--cln); }
  .bd-text { padding-left: 1rem; flex: 1; display: flex; flex-direction: column; overflow: hidden; justify-content: center; }
  .msg { font-size: 0.85rem; line-height: 1.7; font-family: ui-monospace, monospace; color: var(--cts); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; }
  .card-ft { all: unset; height: 2.5rem; border-top: 2px solid var(--cbd); display: flex; align-items: center; justify-content: flex-end; padding: 0 1rem; background: var(--cftbg); cursor: pointer; transition: filter 0.2s, opacity 0.2s; width: 100%; box-sizing: border-box; }
  .card-ft:hover { filter: brightness(1.1); } .card-ft:active { filter: brightness(0.95); }
  :root.dark .card-ft:hover { filter: brightness(0.9); opacity: 0.9; }
  .ft-text { font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--cftt); }
  .dir-label { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 30; font-weight: 900; font-size: 1rem; text-transform: uppercase; letter-spacing: 0.1em; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); color: #fff; padding: 0.5rem 1.5rem; border-radius: 0.25rem; animation: fadeIn 0.2s ease; }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; color: #71717a; }
  :root.dark .empty { color: #a1a1aa; }
  .empty-text { font-size: 1.125rem; font-weight: 600; } .empty-sub { font-size: 0.875rem; opacity: 0.7; }
  .hint { position: absolute; bottom: 1.5rem; left: 50%; transform: translateX(-50%); z-index: 10; opacity: 0.5; transition: opacity 0.3s; font-size: 0.75rem; color: #71717a; }
  :root.dark .hint { color: #a1a1aa; }
  .guestbook-card-stack:hover .hint { opacity: 0.9; }

  @media (max-width: 768px) {
    .guestbook-card-stack { min-height: 480px; padding: 12px; }
    .cards-container { width: 85%; max-width: 300px; height: 380px; }
    .card-bd { padding: 1rem; }
    .msg { font-size: 0.78rem; -webkit-line-clamp: 5; }
    .message-card .card-inner { border-width: 3px; }
    .corner { width: 0.35rem; height: 0.35rem; }
    .corner.top-left { top: 0.35rem; left: 0.35rem; } .corner.top-right { top: 0.35rem; right: 0.35rem; }
    .corner.bottom-left { bottom: 0.35rem; left: 0.35rem; } .corner.bottom-right { bottom: 0.35rem; right: 0.35rem; }
    .hint { bottom: 0.75rem; font-size: 0.65rem; }
  }
</style>
