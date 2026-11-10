<script lang="ts">
  import { pretty } from '../core/notes';
  // Pretty chord symbol with the slash bass dimmed: "C♯m7♭5/G"
  let { symbol }: { symbol: string } = $props();
  const parts = $derived.by(() => {
    const i = symbol.lastIndexOf('/');
    if (i > 0 && /^[A-G]/.test(symbol.slice(i + 1))) return [pretty(symbol.slice(0, i)), pretty(symbol.slice(i))];
    return [pretty(symbol), ''];
  });
</script>

<span class="sym">{parts[0]}{#if parts[1]}<span class="slash">{parts[1]}</span>{/if}</span>

<style>
  .sym { white-space: nowrap; }
  .slash { opacity: 0.55; font-weight: 600; }
</style>
