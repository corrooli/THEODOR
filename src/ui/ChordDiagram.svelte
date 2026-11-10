<script lang="ts">
  import type { ChordInfo } from '../core/chords';

  let { frets, tuning, info, w = 64, h = 82 }: { frets: number[]; tuning: number[]; info: ChordInfo; w?: number; h?: number } = $props();

  const n = $derived(tuning.length);
  const fretted = $derived(frets.filter(f => f > 0));
  const maxF = $derived(fretted.length ? Math.max(...fretted) : 1);
  const minF = $derived(fretted.length ? Math.min(...fretted) : 1);
  const base = $derived(maxF <= 4 ? 1 : minF);
  const rows = $derived(Math.max(4, maxF - base + 1));
  const L = 13, R = 5, T = 13, B = 4;
  const sx = $derived((w - L - R) / Math.max(1, n - 1));
  const sy = $derived((h - T - B) / rows);
  const xs = (s: number) => L + (n - 1 - s) * sx;
  const fnOfPc = (pc: number) => info.tones.find(t => t.pc === pc)?.fn ?? (pc === info.bass ? 'bass' : 'none');
</script>

<svg width={w} height={h} viewBox="0 0 {w} {h}" aria-hidden="true">
  {#each Array.from({ length: rows + 1 }) as _, r}
    <line x1={L} x2={w - R} y1={T + r * sy} y2={T + r * sy} stroke="currentColor"
      stroke-opacity={r === 0 && base === 1 ? 0.9 : 0.3} stroke-width={r === 0 && base === 1 ? 3 : 1} />
  {/each}
  {#each tuning as _, s}
    <line x1={xs(s)} x2={xs(s)} y1={T} y2={T + rows * sy} stroke="currentColor" stroke-opacity="0.4" />
  {/each}
  {#if base > 1}
    <text x={L - 3} y={T + sy * 0.72} font-size="8" text-anchor="end" fill="currentColor" fill-opacity="0.7">{base}</text>
  {/if}
  {#each frets as f, s}
    {#if f < 0}
      <text x={xs(s)} y={T - 4} font-size="8" text-anchor="middle" fill="currentColor" fill-opacity="0.55">×</text>
    {:else if f === 0}
      <circle cx={xs(s)} cy={T - 6} r="2.8" fill="none" stroke="var(--fn-{fnOfPc((tuning[s] + f) % 12)})" stroke-width="1.6" />
    {:else}
      <circle cx={xs(s)} cy={T + (f - base + 0.5) * sy} r={Math.min(sx, sy) * 0.4} fill="var(--fn-{fnOfPc((tuning[s] + f) % 12)})" />
    {/if}
  {/each}
</svg>
