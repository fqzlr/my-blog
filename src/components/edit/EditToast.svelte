<script lang="ts">
import { onMount, onDestroy } from "svelte";

interface ToastItem {
	id: number;
	message: string;
	type: "success" | "error" | "info" | "warning";
	visible: boolean;
}

let toasts: ToastItem[] = [];
let nextId = 0;

function handleToast(e: Event) {
	const detail = (e as CustomEvent).detail as {
		message: string;
		type: "success" | "error" | "info" | "warning";
	};
	const id = nextId++;
	toasts = [...toasts, { id, ...detail, visible: true }];
	setTimeout(() => {
		toasts = toasts.map((t) => (t.id === id ? { ...t, visible: false } : t));
		setTimeout(() => {
			toasts = toasts.filter((t) => t.id !== id);
		}, 300);
	}, 3000);
}

onMount(() => {
	if (typeof window !== "undefined") {
		window.addEventListener("edit-mode:toast", handleToast);
		// 动态加载 Iconify 浏览器脚本（仅加载一次）
		if (!(window as any)._iconifyLoaded) {
			(window as any)._iconifyLoaded = true;
			const script = document.createElement("script");
			script.src =
				"https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js";
			script.async = true;
			document.head.appendChild(script);
		}
	}
});

onDestroy(() => {
	if (typeof window !== "undefined") {
		window.removeEventListener("edit-mode:toast", handleToast);
	}
});

function getIcon(type: string) {
	switch (type) {
		case "success":
			return "material-symbols:check-circle-rounded";
		case "error":
			return "material-symbols:error-circle-rounded";
		case "warning":
			return "material-symbols:warning-rounded";
		default:
			return "material-symbols:info-rounded";
	}
}

function getColorClass(type: string) {
	switch (type) {
		case "success":
			return "bg-emerald-500";
		case "error":
			return "bg-red-500";
		case "warning":
			return "bg-amber-500";
		default:
			return "bg-blue-500";
	}
}
</script>

<div class="toast-container">
	{#each toasts as toast (toast.id)}
		<div
			class="toast-item {getColorClass(toast.type)}"
			class:toast-enter={toast.visible}
			class:toast-leave={!toast.visible}
		>
			<iconify-icon icon={getIcon(toast.type)} class="text-lg"></iconify-icon>
			<span>{toast.message}</span>
		</div>
	{/each}
</div>

<style>
	.toast-container {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 99999;
		display: flex;
		flex-direction: column;
		gap: 8px;
		pointer-events: none;
	}
	.toast-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		border-radius: 12px;
		color: white;
		font-size: 14px;
		font-weight: 500;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		backdrop-filter: blur(10px);
		pointer-events: auto;
	}
	.toast-enter {
		animation: toastIn 0.3s ease forwards;
	}
	.toast-leave {
		animation: toastOut 0.3s ease forwards;
	}
	@keyframes toastIn {
		from {
			opacity: 0;
			transform: translateX(100px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}
	@keyframes toastOut {
		from {
			opacity: 1;
			transform: translateX(0);
		}
		to {
			opacity: 0;
			transform: translateX(100px);
		}
	}
</style>
