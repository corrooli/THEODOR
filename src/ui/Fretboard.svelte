<script lang="ts">
  import { pretty, SHARP } from '../core/notes';
  import { fk, type FretMarks } from './marks';

  let {
    tuning,
    frets = 15,
    marks,
    muted = null,
    leftHanded = false,
    onToggle,
    onMute,
    pings = new Set<string>(),
    window: fretWindow = null,
    minWidth = 0,
  }: {
    tuning: number[];
    frets?: number;
    marks: FretMarks;
    muted?: Set<number> | null;
    leftHanded?: boolean;
    onToggle?: (s: number, f: number) => void;
    onMute?: (s: number) => void;
    pings?: Set<string>;
    /** highlight a fret range [from, to] (position lock) */
    window?: [number, number] | null;
    /** below this width (px) the board stops shrinking and the parent scrolls instead */
    minWidth?: number;
  } = $props();

  const ROW = 34;
  const TOP = 18;
  const OPEN_W = 50;
  const LEFT = 40;
  const RIGHT = 14;
  const n = $derived(tuning.length);
  const W = $derived(Math.max(760, 70 * frets + OPEN_W + LEFT + RIGHT));
  const boardW = $derived(W - OPEN_W - LEFT - RIGHT);
  const H = $derived(TOP * 2 + ROW * (n - 1) + 22);
  const nutX = $derived(LEFT + OPEN_W);

  // Blend of real (logarithmic) fret spacing and even spacing: looks like a guitar, stays clickable up high
  function rawX(f: number) {
    if (f <= 0) return nutX;
    const real = (1 - Math.pow(2, -f / 12)) / (1 - Math.pow(2, -frets / 12));
    return nutX + boardW * (0.55 * real + 0.45 * (f / frets));
  }
  const mirror = (x: number) => (leftHanded ? W - x : x);
  const fretX = (f: number) => mirror(rawX(f));
  const cellX = (f: number) => (f === 0 ? mirror(LEFT + OPEN_W / 2) : mirror((rawX(f - 1) + rawX(f)) / 2));
  const yOf = (s: number) => TOP + s * ROW;
  const cellW = (f: number) => (f === 0 ? OPEN_W : rawX(f) - rawX(f - 1));

  const singles = [3, 5, 7, 9, 15, 17, 19, 21];
  const doubles = [12, 24];
  const fretList = $derived(Array.from({ length: frets + 1 }, (_, f) => f));
</script>

<div class="board-wrap scroll-x">
  <svg class="board" viewBox="0 0 {W} {H}" style="min-width: {minWidth}px" role="group" aria-label="Fretboard">
    <defs>
      <linearGradient id="fb-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--wood-1)" />
        <stop offset="1" stop-color="var(--wood-2)" />
      </linearGradient>
      <linearGradient id="fb-fret" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="var(--fret)" stop-opacity="0.5" />
        <stop offset="0.5" stop-color="var(--fret)" />
        <stop offset="1" stop-color="var(--fret)" stop-opacity="0.5" />
      </linearGradient>
      <filter id="fb-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <!-- neck -->
    <rect x={Math.min(fretX(0), fretX(frets))} y={TOP - 12} width={Math.abs(fretX(frets) - fretX(0))} height={ROW * (n - 1) + 24} rx="6" fill="url(#fb-wood)" />
    {#if fretWindow}
      {@const x1 = Math.min(fretX(Math.max(0, fretWindow[0] - 1)), fretX(fretWindow[1]))}
      {@const x2 = Math.max(fretX(Math.max(0, fretWindow[0] - 1)), fretX(fretWindow[1]))}
      <rect x={x1} y={TOP - 12} width={x2 - x1} height={ROW * (n - 1) + 24} fill="var(--accent)" opacity="0.1" rx="4" />
    {/if}

    <!-- inlays -->
    {#each singles.filter(f => f <= frets) as f}
      <circle cx={cellX(f)} cy={TOP + (ROW * (n - 1)) / 2} r="6" fill="var(--inlay)" />
    {/each}
    {#each doubles.filter(f => f <= frets) as f}
      <circle cx={cellX(f)} cy={TOP + ROW * (n - 1) * 0.25} r="6" fill="var(--inlay)" />
      <circle cx={cellX(f)} cy={TOP + ROW * (n - 1) * 0.75} r="6" fill="var(--inlay)" />
    {/each}

    <!-- frets + nut -->
    {#each fretList.slice(1) as f}
      <rect x={fretX(f) - 1.5} y={TOP - 12} width="3" height={ROW * (n - 1) + 24} fill="url(#fb-fret)" rx="1" />
    {/each}
    <rect x={fretX(0) - 3} y={TOP - 13} width="6" height={ROW * (n - 1) + 26} fill="var(--string)" opacity="0.85" rx="2" />

    <!-- strings -->
    {#each tuning as _, s}
      <line x1={Math.min(mirror(LEFT), fretX(frets))} x2={Math.max(mirror(LEFT), fretX(frets))} y1={yOf(s)} y2={yOf(s)}
        stroke="var(--string)" stroke-width={0.9 + (s / Math.max(1, n - 1)) * 2.2} stroke-opacity="0.85" />
    {/each}

    <!-- fret numbers -->
    {#each fretList as f}
      {#if f === 0 || [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(f)}
        <text x={cellX(f)} y={H - 4} class="fretnum" text-anchor="middle">{f === 0 ? 'open' : f}</text>
      {/if}
    {/each}

    <!-- string names / mute toggles -->
    {#each tuning as midi, s}
      {@const isMuted = muted?.has(s)}
      <g class="mute" class:on={isMuted} role="button" tabindex="-1" aria-label="Mute or open string {s + 1}"
        onclick={() => onMute?.(s)} onkeydown={() => {}}>
        <circle cx={mirror(LEFT / 2 - 2)} cy={yOf(s)} r="11" />
        <text x={mirror(LEFT / 2 - 2)} y={yOf(s) + 4} text-anchor="middle">{isMuted ? '×' : pretty(SHARP[midi % 12])}</text>
      </g>
    {/each}

    <!-- cells: hit areas + marks -->
    {#each tuning as midi, s}
      {#each fretList as f}
        {@const m = marks.get(fk(s, f))}
        {@const cx = cellX(f)}
        {@const cy = yOf(s)}
        <g class="cell" role="button" tabindex="-1" aria-label="{SHARP[(midi + f) % 12]} string {s + 1} fret {f}"
          onclick={() => onToggle?.(s, f)} onkeydown={() => {}} data-sf="{s}:{f}">
          <rect x={cx - cellW(f) / 2} y={cy - ROW / 2} width={cellW(f)} height={ROW} fill="transparent" />
          {#if m}
            <g class="mark {m.kind} fn-{m.fn}" class:ping={pings.has(fk(s, f))}>
              {#if m.kind === 'on'}
                <circle {cx} {cy} r="14" class="glow" filter="url(#fb-glow)" />
              {/if}
              {#if m.kind === 'scale'}
                <circle {cx} {cy} r="9.5" class="dot" />
              {:else}
                <circle {cx} {cy} r="13.5" class="dot" />
              {/if}
              {#if m.ring}<circle {cx} {cy} r="17" class="ring" />{/if}
              <text x={cx} y={cy + 4} text-anchor="middle" class:small={m.text.length > 2}>{pretty(m.text)}</text>
              {#if m.title}<title>{m.title}</title>{/if}
            </g>
          {:else}
            <text x={cx} y={cy + 4} text-anchor="middle" class="hover-name">{pretty(SHARP[(midi + f) % 12])}</text>
          {/if}
        </g>
      {/each}
    {/each}
  </svg>
</div>

<style>
  .board-wrap { width: 100%; padding: 4px 2px 6px; }
  .board { display: block; width: 100%; height: auto; margin: 0 auto; user-select: none; -webkit-user-select: none; }
  .fretnum { font-size: 10px; fill: var(--muted); font-family: var(--font-ui); font-weight: 600; letter-spacing: 0.04em; }
  .cell { cursor: pointer; }
  .cell:focus { outline: none; }
  .hover-name { font-size: 11px; font-weight: 700; fill: var(--text); opacity: 0; transition: opacity 0.12s; pointer-events: none; }
  .cell:hover .hover-name { opacity: 0.55; }
  .mark { transition: transform 0.2s var(--ease); transform-box: fill-box; transform-origin: center; pointer-events: none; }
  .mark text { font-size: 11.5px; font-weight: 800; font-family: var(--font-ui); pointer-events: none; }
  .mark text.small { font-size: 9.5px; }
  .mark.on .dot { fill: var(--c); stroke: color-mix(in srgb, white 35%, var(--c)); stroke-width: 1.2; }
  .mark.on .glow { fill: var(--c); opacity: 0.55; }
  .mark.on text { fill: #fff; text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35); }
  .mark.ghost .dot { fill: color-mix(in srgb, var(--c) 22%, var(--wood-2)); stroke: color-mix(in srgb, var(--c) 70%, transparent); stroke-width: 1.4; }
  .mark.ghost text { fill: var(--c); }
  .mark.scale .dot { fill: color-mix(in srgb, var(--text) 14%, var(--wood-2)); stroke: color-mix(in srgb, var(--text) 30%, transparent); stroke-width: 1; }
  .mark.scale text { fill: var(--text-2); font-size: 9.5px; }
  .mark.guide .dot { fill: color-mix(in srgb, var(--c) 30%, var(--wood-2)); stroke: var(--c); stroke-width: 2; }
  .mark.guide text { fill: #fff; }
  .ring { fill: none; stroke: var(--c); stroke-width: 2; stroke-dasharray: 3 3; opacity: 0.9; }
  .mark.ping { animation: ping 0.45s var(--ease); }
  .mute { cursor: pointer; }
  .mute circle { fill: var(--surface-2); stroke: var(--border-strong); }
  .mute text { font-size: 10px; font-weight: 700; fill: var(--text-2); font-family: var(--font-ui); }
  .mute.on circle { fill: #ef4444; stroke: #ef4444; }
  .mute.on text { fill: #fff; font-size: 13px; }
  .mute:hover circle { stroke: var(--accent); }
</style>
