<script lang="ts">
  import Icon from '../ui/Icon.svelte';
  import Sym from '../ui/Sym.svelte';
  import { app, go } from '../lib/state.svelte';
  import { infoOf, refKey, type ChordRef } from '../core/chords';
  import { detectKey, diatonicChord, keyName, romanNumeral, type Key, type Mode } from '../core/analysis';
  import { withinLevel, type Level } from '../core/intervals';
  import { mod12, pretty, ROOT_MAJ, ROOT_MIN } from '../core/notes';
  import { addToSong, playChord, playChordSequence } from '../lib/helpers';
  import { chordItem, newSong } from '../lib/song';

  // Start in the current song's key
  const songKey = $derived.by((): Key => {
    const s = app.song;
    if (s.key) return s.key;
    const seq = s.sections.flatMap(x => x.chords.map(c => ({ ref: c.ref, beats: c.beats })));
    return seq.length ? detectKey(seq)[0].key : { tonic: 0, mode: 'major' };
  });
  let override = $state<Key | null>(null);
  const key = $derived(override ?? songKey);
  const flatKey = $derived((key.mode === 'major' ? [5, 10, 3, 8, 1, 6] : [2, 7, 0, 5, 10, 3]).includes(key.tonic));
  const pref = $derived<ChordRef['pref']>(flatKey ? 'flat' : undefined);

  const basic = $derived(app.settings.level === 'basic');
  const triad = (q: string) => (basic ? ({ maj7: '', m7: 'm', m7b5: 'dim', dim7: 'dim' } as Record<string, string>)[q] ?? q : q);
  const mk = (root: number, q: string): ChordRef => ({ root: mod12(root), q, ...(pref ? { pref } : {}) });

  const DEGREES: Record<Mode, number[]> = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
  const ROMAN_COL: Record<Mode, string[]> = { major: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], minor: ['i', 'ii°', '♭III', 'iv', 'V', '♭VI', '♭VII'] };

  interface Cell { ref: ChordRef; role: string; level: Level; to?: number; tip: string }
  interface Row { id: string; name: string; blurb: string; level: Level; cells: (Cell | null)[] }

  const rows = $derived.by((): Row[] => {
    const degs = DEGREES[key.mode];
    const T = key.tonic;
    const dia = degs.map(d => { const r = diatonicChord(key, d); return mk(r.root, triad(r.q)); });
    // targets that can be tonicised: not the diminished / half-diminished chord
    const canTarget = (i: number) => !['m7b5', 'dim', 'dim7'].includes(diatonicChord(key, degs[i]).q);
    const secDom = degs.map((d, i) => (i === 0 || !canTarget(i) ? null : { ref: mk(T + d + 7, '7'), role: 'Secondary dominant', level: 'basic' as Level, to: i,
      tip: `V7 of ${ROMAN_COL[key.mode][i]} — pulls hard to ${infoOf(dia[i]).symbol}` }));
    const related = degs.map((d, i) => (i === 0 || !canTarget(i) ? null : { ref: mk(T + d + 2, basic ? 'm' : 'm7'), role: 'Related ii', level: 'jazz' as Level, to: i,
      tip: `ii of ${ROMAN_COL[key.mode][i]}: play it before the secondary dominant for a mini ii–V` }));
    const tritone = degs.map((d, i) => (!canTarget(i) ? null : { ref: mk(T + d + 1, '7'), role: 'Tritone sub', level: 'jazz' as Level, to: i,
      tip: `Tritone sub of V7/${ROMAN_COL[key.mode][i]}: same tension, bass slides down a half step into ${infoOf(dia[i]).symbol}` }));
    const passing = degs.map((d, i) => {
      const next = degs[i + 1];
      if (next === undefined || next - d !== 2) return null;
      return { ref: mk(T + d + 1, 'dim7'), role: 'Passing diminished', level: 'jazz' as Level, to: i + 1, tip: `Chromatic step between ${infoOf(dia[i]).symbol} and ${infoOf(dia[i + 1]).symbol}` };
    });
    const borrowedMajor: [number, string][] = [[0, basic ? 'm' : 'm7'], [2, basic ? 'dim' : 'm7b5'], [3, basic ? '' : 'maj7'], [5, basic ? 'm' : 'm7'], [7, basic ? 'm' : 'm7'], [8, basic ? '' : 'maj7'], [10, basic ? '' : '7']];
    const borrowedMinor: [number, string][] = [[0, basic ? '' : 'maj7'], [2, basic ? 'm' : 'm7'], [4, basic ? 'm' : 'm7'], [5, basic ? '' : '7'], [7, '7'], [9, basic ? 'm' : 'm7'], [11, basic ? 'dim' : 'm7b5']];
    const parallel = key.mode === 'major' ? 'minor' : 'major';
    const borrowed = (key.mode === 'major' ? borrowedMajor : borrowedMinor).map(([d, q], i) => {
      const r = mk(T + d, q);
      const same = refKey(r) === refKey(dia[i]);
      return same ? null : { ref: r, role: 'Borrowed', level: 'basic' as Level, tip: `Borrowed from ${pretty((parallel === 'major' ? ROOT_MAJ : ROOT_MIN)[T])} ${parallel} — same root, different colour` };
    });
    const modal: [number, string, string][] = key.mode === 'major'
      ? [[0, '', ''], [2, '7', 'Lydian II7 — bright, floating'], [0, '', ''], [5, 'm6', 'iv6 — the classic tear-jerker'], [1, 'maj7', '♭IImaj7 — Phrygian / Neapolitan colour'], [10, 'maj7', '♭VIImaj7 — Mixolydian-ish lift'], [6, 'm7b5', '♯ivø7 — Lydian, leads to V or iii']]
      : [[0, 'm(maj7)', 'i(maj7) — film-noir minor'], [1, 'maj7', '♭IImaj7 — Phrygian darkness'], [0, '', ''], [5, '7', 'IV7 — Dorian / funk minor'], [7, 'm7', 'v7 — Aeolian, softer than V7'], [9, 'm7b5', 'viø7 — Dorian colour'], [11, 'dim7', 'vii°7 — harmonic minor drama']];
    const modalCells = modal.map(([d, q, tip]) => (q ? { ref: mk(T + d, q), role: 'Modal colour', level: 'fusion' as Level, tip } : null));

    const out: Row[] = [
      { id: 'rel', name: 'Related ii', blurb: 'Set up each secondary dominant', level: 'jazz', cells: related },
      { id: 'sec', name: 'Secondary dominants', blurb: 'Point at any chord in the key', level: 'basic', cells: secDom },
      { id: 'tri', name: 'Tritone subs', blurb: 'Slide in by half step', level: 'jazz', cells: tritone },
      { id: 'dia', name: `Diatonic · ${keyName(key)}`, blurb: 'Home base: every chord in the key', level: 'basic', cells: dia.map((r, i) => ({ ref: r, role: 'Diatonic', level: 'basic', tip: `${ROMAN_COL[key.mode][i]} in ${keyName(key)}` })) },
      { id: 'pas', name: 'Passing diminished', blurb: 'Chromatic glue between neighbours', level: 'jazz', cells: passing },
      { id: 'bor', name: `Borrowed from ${parallel}`, blurb: 'Modal interchange: same root, other mode', level: 'basic', cells: borrowed },
      { id: 'mod', name: 'Modal colours', blurb: 'Fusion flavours — think outside the box', level: 'fusion', cells: modalCells },
    ];
    return out.filter(r => withinLevel(r.level, app.settings.level));
  });

  // ---------- sketch ----------
  let sketch = $state<ChordRef[]>([]);
  let last = $state<{ row: string; col: number; cell: Cell } | null>(null);

  function tap(row: Row, col: number, cell: Cell) {
    playChord(cell.ref);
    sketch = [...sketch, cell.ref];
    last = { row: row.id, col, cell };
  }
  // A strong next move: the target of a dominant-function chord, or a diatonic chord a 5th below
  function isTarget(row: Row, col: number, cell: Cell): boolean {
    if (!last) return false;
    const lc = last.cell;
    if (lc.to !== undefined) {
      if (last.row === 'rel') return row.id === 'sec' && col === lc.to || (row.id === 'tri' && col === lc.to);
      return row.id === 'dia' && col === lc.to;
    }
    if (row.id === 'sec' || row.id === 'tri') return false;
    return row.id === 'dia' && mod12(infoOf(lc.ref).root - infoOf(cell.ref).root) === 7;
  }

  function sendToSong() {
    if (!sketch.length) return;
    addToSong(sketch);
    sketch = [];
    last = null;
  }
  function newSongFromSketch() {
    if (!sketch.length) return;
    const s = newSong('Board sketch');
    s.key = key;
    s.sections[0].chords = sketch.map(r => chordItem(r));
    app.songs.unshift(s);
    app.currentId = s.id;
    sketch = [];
    last = null;
    go('song');
  }

  const ALL_KEYS: Key[] = [...Array(12).keys()].flatMap(t => [{ tonic: t, mode: 'major' as const }, { tonic: t, mode: 'minor' as const }]);
</script>

<div class="explore">
  <section class="card head">
    <div>
      <div class="eyebrow">Explore · harmony board</div>
      <h1>Every chord that makes sense in <span class="grad">{keyName(key)}</span></h1>
      <p class="muted">Tap chords to hear them and sketch a progression. After a dominant, its target lights up — follow the glow or break the rules.</p>
    </div>
    <div class="key-pick">
      <select class="field" value={`${key.tonic}:${key.mode}`} aria-label="Key"
        onchange={(e) => { const [t, m] = (e.target as HTMLSelectElement).value.split(':'); override = { tonic: +t, mode: m as Mode }; sketch = []; last = null; }}>
        {#each ALL_KEYS as k}<option value={`${k.tonic}:${k.mode}`}>{keyName(k)}</option>{/each}
      </select>
      {#if override}<button class="btn sm ghost" onclick={() => (override = null)}>Use song key</button>{/if}
    </div>
  </section>

  <section class="card board-wrap">
    <div class="board scroll-x">
      <div class="grid" style="--cols: 7">
        <div class="corner"></div>
        {#each ROMAN_COL[key.mode] as r}<div class="colhead">{r}</div>{/each}
        {#each rows as row (row.id)}
          <div class="rowhead" class:dia={row.id === 'dia'}>
            <strong>{row.name}</strong>
            <span>{row.blurb}</span>
          </div>
          {#each row.cells as cell, col}
            {#if cell}
              {@const ci = infoOf(cell.ref)}
              <button class="cell row-{row.id}" class:target={isTarget(row, col, cell)} class:last={last?.row === row.id && last?.col === col}
                onclick={() => tap(row, col, cell)} title={cell.tip} data-testid="board-cell">
                <span class="sym"><Sym symbol={ci.symbol} /></span>
                <span class="rn">{pretty(romanNumeral(cell.ref, key.tonic))}</span>
              </button>
            {:else}
              <div class="cell empty"></div>
            {/if}
          {/each}
        {/each}
      </div>
    </div>
  </section>

  <section class="card sketch">
    <div class="sk-head">
      <div class="eyebrow">Your sketch</div>
      <span class="sp"></span>
      <button class="btn sm" onclick={() => playChordSequence(sketch, 0.9)} disabled={!sketch.length}><Icon name="play" size={13} /> Play</button>
      <button class="btn sm ghost" onclick={() => { sketch = sketch.slice(0, -1); last = null; }} disabled={!sketch.length}>Undo</button>
      <button class="btn sm ghost" onclick={() => { sketch = []; last = null; }} disabled={!sketch.length}>Clear</button>
      <button class="btn sm" onclick={sendToSong} disabled={!sketch.length}><Icon name="plus" size={13} /> Add to “{app.song.title}”</button>
      <button class="btn sm primary" onclick={newSongFromSketch} disabled={!sketch.length}>New song</button>
    </div>
    <div class="sk-chords">
      {#each sketch as r, i}
        <button class="sk" onclick={() => playChord(r)}>
          <Sym symbol={infoOf(r).symbol} /><small>{pretty(romanNumeral(r, key.tonic))}</small>
        </button>
        {#if i < sketch.length - 1}<span class="arrow">→</span>{/if}
      {:else}
        <span class="muted">Tap chords on the board. Try: V7/ii → ii → V → I.</span>
      {/each}
    </div>
  </section>
</div>

<style>
  .explore { display: flex; flex-direction: column; gap: 1.2rem; }
  .head { padding: 1.3rem 1.5rem; display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
  h1 { font-size: clamp(1.4rem, 3vw, 2rem); margin: 0.2rem 0 0.3rem; }
  .grad { background: var(--brand-grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .key-pick { display: flex; gap: 0.4rem; align-items: center; }
  .key-pick select { width: 11rem; }
  .board-wrap { padding: 1rem; }
  .grid { display: grid; grid-template-columns: 11rem repeat(var(--cols), minmax(5.6rem, 1fr)); gap: 0.4rem; min-width: 760px; }
  .colhead { text-align: center; font-family: var(--font-display); font-weight: 700; color: var(--muted); font-size: 0.85rem; padding-bottom: 0.2rem; }
  .rowhead { display: flex; flex-direction: column; justify-content: center; padding-right: 0.5rem; }
  .rowhead strong { font-size: 0.82rem; }
  .rowhead span { font-size: 0.7rem; color: var(--muted); line-height: 1.25; }
  .rowhead.dia strong { color: var(--accent); }
  .cell {
    min-height: 3.6rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.05rem; transition: transform 0.15s var(--ease), border-color 0.15s, box-shadow 0.25s, background 0.2s;
  }
  .cell.empty { background: transparent; border: 1px dashed var(--border); cursor: default; }
  .cell:not(.empty):hover { transform: translateY(-2px); border-color: var(--border-strong); }
  .cell .sym { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }
  .cell .rn { font-size: 0.68rem; color: var(--muted); font-family: var(--font-display); }
  .row-dia { background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); border-color: color-mix(in srgb, var(--accent) 30%, transparent); }
  .row-sec { --c: var(--hf-D); }
  .row-tri { --c: var(--brand-2); }
  .row-rel { --c: var(--hf-S); }
  .row-pas { --c: var(--fn-seventh); }
  .row-bor { --c: var(--brand-3); }
  .row-mod { --c: var(--brand-1); }
  .cell[class*='row-']:not(.row-dia) { border-top: 3px solid color-mix(in srgb, var(--c) 70%, transparent); }
  .cell.target { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 35%, transparent), 0 10px 28px -10px var(--accent); animation: glow 1.4s ease-in-out infinite; }
  .cell.last { outline: 2px solid var(--text); outline-offset: 1px; }
  @keyframes glow { 50% { box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 15%, transparent), 0 10px 28px -10px var(--accent); } }
  .sketch { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; }
  .sk-head { display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap; }
  .sp { flex: 1; }
  .sk-chords { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; min-height: 2.6rem; }
  .sk { display: inline-flex; flex-direction: column; align-items: center; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 12px; padding: 0.3rem 0.7rem; cursor: pointer; font-family: var(--font-display); font-weight: 700; }
  .sk small { font-size: 0.65rem; color: var(--muted); }
  .arrow { color: var(--muted); }
</style>
