<script lang="ts">
  let { size = 28, wordmark = true }: { size?: number; wordmark?: boolean } = $props();
</script>

<span class="logo" style="--s: {size}px">
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
    <defs>
      <linearGradient id="lg-brand" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffb347" />
        <stop offset="0.5" stop-color="#ff5e7e" />
        <stop offset="1" stop-color="#9b6bff" />
      </linearGradient>
    </defs>
    <!-- the box ... -->
    <path d="M20 4.5H8.5a4 4 0 0 0-4 4v15a4 4 0 0 0 4 4h15a4 4 0 0 0 4-4V12" fill="none" stroke="currentColor" stroke-opacity="0.55" stroke-width="2.4" stroke-linecap="round" />
    <!-- ... and the note breaking out of it -->
    <path d="M15 21.5V9.5l11-3.2" fill="none" stroke="url(#lg-brand)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    <circle cx="12.3" cy="21.6" r="3.6" fill="url(#lg-brand)" />
    <circle cx="27.4" cy="5.6" r="2.2" fill="#9b6bff" />
  </svg>
  {#if wordmark}
    <span class="word"><span class="theo">THEO</span><span class="dot">·</span><span class="dor">DOR</span></span>
  {/if}
</span>

<style>
  .logo { display: inline-flex; align-items: center; gap: 0.55rem; color: var(--text); }
  .word { font-family: var(--font-display); font-weight: 700; font-size: calc(var(--s) * 0.7); letter-spacing: 0.06em; line-height: 1; }
  .dot { color: var(--muted); margin: 0 0.04em; }
  .dor { background: var(--brand-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
</style>
