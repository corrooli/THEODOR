<script lang="ts">
  import { app } from '../lib/state.svelte';
  let visible = $state(false);
  let msg = $state('');
  let timer: number | undefined;
  $effect(() => {
    const t = app.toast;
    if (!t) return;
    msg = t.msg;
    visible = true;
    clearTimeout(timer);
    timer = window.setTimeout(() => (visible = false), 2400);
  });
</script>

<div class="toast" class:show={visible} role="status" aria-live="polite">{msg}</div>

<style>
  .toast {
    position: fixed; left: 50%; bottom: 1.5rem; z-index: 200; transform: translate(-50%, 160%);
    padding: 0.7rem 1.2rem; border-radius: 999px; background: var(--text); color: var(--bg); font-weight: 600; font-size: 0.9rem;
    box-shadow: var(--shadow-pop); transition: transform 0.35s var(--ease); pointer-events: none; max-width: calc(100vw - 2rem); text-align: center;
  }
  .toast:not(.show) { opacity: 0; transition: transform 0.35s var(--ease), opacity 0s 0.35s; }
  .toast.show { transform: translate(-50%, 0); }
  @media (max-width: 820px) { .toast { bottom: 5.5rem; } }
</style>
