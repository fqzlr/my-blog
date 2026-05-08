<script lang="ts">
interface Props {
	src: string;
	albumId: string;
	alt?: string;
}

const { src, albumId, alt = "" }: Props = $props();

let container: HTMLDivElement | undefined = $state();
let visible = $state(false);
let status = $state<"loading" | "loaded" | "error">("loading");

$effect(() => {
	if (!container) return;
	const observer = new IntersectionObserver(
		(entries) => {
			if (entries[0].isIntersecting) {
				visible = true;
				observer.disconnect();
			}
		},
		{ rootMargin: "200px" },
	);
	observer.observe(container);
	return () => observer.disconnect();
});

function onLoad() {
	status = "loaded";
}

function onError() {
	status = "error";
}
</script>

<div class="break-inside-avoid mb-3" bind:this={container}>
  {#if !visible}
    <div class="skeleton rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" style="aspect-ratio: 4/3;"></div>
  {:else}
    <div
      data-fancybox={`gallery-${albumId}`}
      data-src={src}
      data-type="image"
      class="block rounded-xl overflow-hidden group cursor-pointer relative"
      style="aspect-ratio: 4/3;"
    >
      {#if status === "loading"}
        <div class="skeleton absolute inset-0 rounded-xl bg-neutral-200 dark:bg-neutral-800 animate-pulse"></div>
      {/if}

      {#if status !== "error"}
        <img
          {src}
          {alt}
          loading="lazy"
          decoding="async"
          onload={onLoad}
          onerror={onError}
          class="w-full h-full object-cover transition-opacity duration-500 {status === 'loaded' ? 'opacity-100' : 'opacity-0'}"
        />
      {:else}
        <div class="flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 rounded-xl w-full h-full">
          <svg class="w-8 h-8 text-neutral-300 dark:text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
          </svg>
        </div>
      {/if}
    </div>
  {/if}
</div>
