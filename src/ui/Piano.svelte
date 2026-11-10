<script lang="ts">
  import { BLACK_KEYS, pretty, SHARP } from '../core/notes';
  import type { KeyMarks } from './marks';

  let {
    lo = 36,
    hi = 84,
    marks,
    onToggle,
    pings = new Set<number>(),
  }: { lo?: number; hi?: number; marks: KeyMarks; onToggle?: (midi: number) => void; pings?: Set<number> } = $props();

  const WW = 26, WH = 120, BW = 16, BH = 74;
  const keys = $derived.by(() => {
    const out: { midi: number; black: boolean; x: number }[] = [];
    let white = 0;
    for (let m = lo; m <= hi; m++) {
      const black = BLACK_KEYS.includes(m % 12);
      if (black) out.push({ midi: m, black, x: white * WW - BW / 2 });
      else { out.push({ midi: m, black, x: white * WW }); white++; }
    }
    return out;
  });
  const width = $derived(keys.filter(k => !k.black).length * WW);
</script>

<div class="piano-wrap scroll-x">
  <svg viewBox="0 0 {width} {WH + 2}" width={width} height={WH + 2} role="group" aria-label="Piano">
    {#each keys.filter(k => !k.black) as k (k.midi)}
      {@const m = marks.get(k.midi)}
      <g class="key white {m ? `${m.kind} fn-${m.fn}` : ''}" class:ping={pings.has(k.midi)} role="button" tabindex="-1"
        aria-label={SHARP[k.midi % 12] + (Math.floor(k.midi / 12) - 1)} onclick={() => onToggle?.(k.midi)} onkeydown={() => {}} data-midi={k.midi}>
        <rect x={k.x + 0.5} y="0.5" width={WW - 1} height={WH} rx="4" />
        {#if m && m.kind !== 'scale'}
          <circle cx={k.x + WW / 2} cy={WH - 20} r="9" class="dot" />
          <text x={k.x + WW / 2} y={WH - 16.5} text-anchor="middle" class="lbl">{pretty(m.text)}</text>
        {:else if m}
          <circle cx={k.x + WW / 2} cy={WH - 20} r="4" class="dot" />
        {:else if k.midi % 12 === 0}
          <text x={k.x + WW / 2} y={WH - 8} text-anchor="middle" class="oct">C{Math.floor(k.midi / 12) - 1}</text>
        {/if}
        {#if m?.title}<title>{m.title}</title>{/if}
      </g>
    {/each}
    {#each keys.filter(k => k.black) as k (k.midi)}
      {@const m = marks.get(k.midi)}
      <g class="key black {m ? `${m.kind} fn-${m.fn}` : ''}" class:ping={pings.has(k.midi)} role="button" tabindex="-1"
        aria-label={SHARP[k.midi % 12] + (Math.floor(k.midi / 12) - 1)} onclick={() => onToggle?.(k.midi)} onkeydown={() => {}} data-midi={k.midi}>
        <rect x={k.x} y="0" width={BW} height={BH} rx="3" />
        {#if m && m.kind !== 'scale'}
          <circle cx={k.x + BW / 2} cy={BH - 14} r="7" class="dot" />
        {:else if m}
          <circle cx={k.x + BW / 2} cy={BH - 14} r="3.5" class="dot" />
        {/if}
        {#if m?.title}<title>{m.title}</title>{/if}
      </g>
    {/each}
  </svg>
</div>

<style>
  .piano-wrap { width: 100%; display: flex; justify-content: safe center; padding: 2px; }
  svg { display: block; flex: 0 0 auto; user-select: none; }
  .key { cursor: pointer; }
  .key:focus { outline: none; }
  .white rect { fill: var(--key-white); stroke: var(--key-white-2); transition: fill 0.12s; }
  .white:hover rect { fill: var(--key-white-2); }
  .black rect { fill: var(--key-black); stroke: #000; transition: fill 0.12s; }
  .black:hover rect { fill: #2b2d38; }
  .key.on.white rect { fill: color-mix(in srgb, var(--c) 30%, var(--key-white)); }
  .key.on.black rect { fill: color-mix(in srgb, var(--c) 55%, var(--key-black)); }
  .dot { fill: var(--c); }
  .key.ghost .dot, .key.scale .dot { opacity: 0.45; }
  .lbl { font-size: 8.5px; font-weight: 800; fill: #fff; font-family: var(--font-ui); pointer-events: none; }
  .key.ghost .lbl { fill: var(--text); }
  .oct { font-size: 8.5px; fill: #8a8d99; font-weight: 700; font-family: var(--font-ui); pointer-events: none; }
  .key.ping { animation: keyping 0.4s ease-out; }
  @keyframes keyping { 30% { filter: brightness(1.35); } }
</style>
