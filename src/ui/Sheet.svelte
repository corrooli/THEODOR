<script lang="ts">
  import type { Snippet } from 'svelte';
  // Slide-over panel (right side on desktop, bottom sheet on mobile)
  let { open, onClose, children, width = 520, label = 'Panel' }: { open: boolean; onClose: () => void; children: Snippet; width?: number; label?: string } = $props();
</script>

{#if open}
  <div class="scrim" onclick={onClose} role="presentation"></div>
  <div class="sheet" style="--w: {width}px" role="dialog" aria-label={label} aria-modal="true">
    {@render children()}
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 90; background: rgba(5, 6, 10, 0.45); backdrop-filter: blur(3px); animation: fade 0.25s ease both; }
  .sheet {
    position: fixed; top: 0; right: 0; bottom: 0; z-index: 100; width: min(var(--w), 100vw); overflow-y: auto;
    background: var(--surface); border-left: 1px solid var(--border); box-shadow: var(--shadow-pop);
    animation: slide 0.4s var(--ease) both; overscroll-behavior: contain;
  }
  @keyframes fade { from { opacity: 0; } }
  @keyframes slide { from { transform: translateX(40px); opacity: 0; } }
  @media (max-width: 820px) {
    .sheet { top: auto; left: 0; width: 100vw; max-height: 88vh; border-left: 0; border-top: 1px solid var(--border); border-radius: 22px 22px 0 0; animation-name: up; }
    @keyframes up { from { transform: translateY(40px); opacity: 0; } }
  }
</style>
