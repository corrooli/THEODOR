<script lang="ts">
  import { tick } from 'svelte';
  import Icon from './Icon.svelte';
  import Sym from './Sym.svelte';
  import { app, go } from '../lib/state.svelte';
  import { interpret, suggest, type Interpretation, type Suggestion } from '../core/lookup';
  import { chordInfo, identifyMidi, infoOf, type ChordRef } from '../core/chords';
  import { scaleInfoOf, identifyScales, scaleInfo, SCALES } from '../core/scales';
  import { detectKey, keyName } from '../core/analysis';
  import { pretty, mod12 } from '../core/notes';
  import { addToSong, fretsToMidis, playChord, playScaleInfo } from '../lib/helpers';
  import { strum } from '../lib/audio';
  import { chordItem } from '../lib/song';

  let query = $state('');
  let active = $state(0);
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (app.lookupOpen) {
      active = 0;
      tick().then(() => { input?.focus(); input?.select(); });
    }
  });

  type Row = { id: string; title: string; sub: string; tag: string; tagColor?: string; run: () => void; symbol?: string; secondary?: { label: string; run: () => void } };

  function close() { app.lookupOpen = false; }

  function rowsFor(i: Interpretation): Row[] {
    switch (i.kind) {
      case 'chord': {
        const ci = infoOf(i.ref);
        return [{ id: 'c', title: ci.symbol, symbol: ci.symbol, sub: `${ci.fullName} · ${ci.tones.map(t => pretty(t.note)).join(' ')}`, tag: 'Chord', tagColor: 'var(--fn-root)',
          run: () => { app.detail = { kind: 'chord', ref: i.ref }; playChord(i.ref); close(); },
          secondary: { label: 'Add to song', run: () => { addToSong([i.ref]); close(); } } }];
      }
      case 'scale': {
        const si = scaleInfoOf(i.ref);
        return [{ id: 's', title: si.name, sub: `${si.notes.map(n => pretty(n.note)).join(' ')} · ${si.scale.vibe}`, tag: 'Scale', tagColor: 'var(--fn-fifth)',
          run: () => { app.detail = { kind: 'scale', ref: i.ref }; playScaleInfo(si); close(); } }];
      }
      case 'notes': {
        const best = identifyMidi(i.midis)[0];
        const sc = identifyScales(new Set(i.midis.map(m => mod12(m))), mod12(Math.min(...i.midis)), app.settings.level)[0];
        const rows: Row[] = [];
        if (best) {
          const ci = chordInfo(best.root, best.qi, best.bass);
          rows.push({ id: 'n', title: `These notes = ${ci.symbol}`, symbol: ci.symbol, sub: `${best.type === 'exact' ? 'Exact match' : best.type === 'slash' ? 'Slash chord' : 'Incomplete: missing ' + best.missReq.join(', ')} · open in Identify for all matches`, tag: 'Reverse chord', tagColor: 'var(--fn-third)',
            run: () => { app.capture = { frets: [], keys: i.midis }; app.overlayChord = null; app.overlayScale = null; go('capture'); strum(i.midis, 'keys'); close(); } });
        }
        if (sc) {
          const info = scaleInfo(sc.root, sc.si);
          rows.push({ id: 'ns', title: `Fits ${info.name}`, sub: `…and ${identifyScales(new Set(i.midis.map(m => mod12(m))), undefined, app.settings.level).length - 1} more scales contain these notes`, tag: 'Reverse scale', tagColor: 'var(--fn-fifth)',
            run: () => { app.detail = { kind: 'scale', ref: info.ref }; close(); } });
        }
        return rows;
      }
      case 'tab': {
        const midis = fretsToMidis(i.frets);
        const best = midis.length >= 2 ? identifyMidi(midis)[0] : undefined;
        const name = best ? chordInfo(best.root, best.qi, best.bass).symbol : 'shape';
        return [{ id: 't', title: `Guitar shape → ${name}`, symbol: best ? name : undefined, sub: 'Put it on the fretboard in Identify', tag: 'Tab', tagColor: 'var(--fn-ext)',
          run: () => { app.capture = { frets: i.frets, keys: [] }; app.overlayChord = null; app.overlayScale = null; go('capture'); strum(midis, 'guitar'); close(); } }];
      }
      case 'progression': {
        const k = detectKey(i.chords.map(ref => ({ ref, beats: 4 })))[0];
        const names = i.chords.map(c => infoOf(c).symbol).join(' ');
        return [{ id: 'p', title: `Progression: ${names}`, sub: `Sounds like ${keyName(k.key)} · add to your song to analyse it`, tag: 'Progression', tagColor: 'var(--fn-seventh)',
          run: () => { addToSong(i.chords); go('song'); close(); },
          secondary: { label: 'New song', run: () => { newSongFrom(i.chords, names); close(); } } }];
      }
    }
  }

  function newSongFrom(chords: ChordRef[], title: string) {
    const s = { v: 1, id: Math.random().toString(36).slice(2, 10), title: title.slice(0, 40), tempo: 96, key: null, updated: Date.now(),
      sections: [{ id: Math.random().toString(36).slice(2, 10), name: 'Verse', chords: chords.map(c => chordItem(c)) }] };
    app.songs.unshift(s);
    app.currentId = s.id;
    go('song');
  }

  function sugRow(s: Suggestion, idx: number): Row {
    if (s.kind === 'chord') return { id: 'sc' + idx, title: s.label, symbol: s.label, sub: s.sub, tag: 'Chord', tagColor: 'var(--fn-root)',
      run: () => { app.detail = { kind: 'chord', ref: s.ref }; playChord(s.ref); close(); },
      secondary: { label: 'Add', run: () => { addToSong([s.ref]); } } };
    return { id: 'ss' + idx, title: s.label, sub: s.sub, tag: 'Scale', tagColor: 'var(--fn-fifth)',
      run: () => { app.detail = { kind: 'scale', ref: s.ref }; playScaleInfo(scaleInfoOf(s.ref)); close(); } };
  }

  const rows = $derived.by(() => {
    const q = query.trim();
    if (!q) return [] as Row[];
    const exact = interpret(q, app.tuning.length).flatMap(rowsFor);
    const seen = new Set(exact.map(r => r.title));
    const sug = suggest(q, app.settings.level).map(sugRow).filter(r => !seen.has(r.title));
    return [...exact, ...sug].slice(0, 30);
  });
  const exactCount = $derived(query.trim() ? interpret(query.trim(), app.tuning.length).length : 0);

  $effect(() => { void query; active = 0; });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(rows.length - 1, active + 1); scrollActive(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); scrollActive(); }
    else if (e.key === 'Enter') { e.preventDefault(); rows[active]?.run(); }
  }
  function scrollActive() {
    tick().then(() => document.querySelector('.lk-row.active')?.scrollIntoView({ block: 'nearest' }));
  }

  const EXAMPLES = ['Cmaj7', 'D dorian', 'E altered', 'C E G Bb', 'x32010', 'Dm7 G7 Cmaj7', 'F#m7b5', 'lydian dominant', 'Bb blues'];
  const scaleCount = SCALES.length;
</script>

{#if app.lookupOpen}
  <div class="scrim" onclick={close} role="presentation"></div>
  <div class="palette" role="dialog" aria-label="Lookup" aria-modal="true">
    <div class="bar">
      <Icon name="search" size={20} />
      <input bind:this={input} bind:value={query} onkeydown={onKey} placeholder="Chord, scale, notes, tab or progression…"
        aria-label="Lookup query" autocomplete="off" spellcheck="false" data-testid="lookup-input" />
      <kbd>esc</kbd>
    </div>

    {#if !query.trim()}
      <div class="empty">
        <p class="eyebrow">Forward & reverse search — everything in one box</p>
        <div class="grid">
          <div><strong>Name → notes</strong><span>Cmaj7 · D dorian · E altered</span></div>
          <div><strong>Notes → names</strong><span>C E G Bb · x32010</span></div>
          <div><strong>Progressions</strong><span>Dm7 G7 Cmaj7 → key & analysis</span></div>
          <div><strong>Browse</strong><span>"lydian", "minor", "sus" — {scaleCount} scales, 60+ chords</span></div>
        </div>
        <div class="examples">
          {#each EXAMPLES as ex}<button class="chip" onclick={() => (query = ex)}>{ex}</button>{/each}
        </div>
      </div>
    {:else if !rows.length}
      <div class="empty"><p class="muted">Nothing found for “{query}”. Try a chord (Am7), a scale (A dorian), notes (A C E G) or a tab (x02010).</p></div>
    {:else}
      <ul class="results" role="listbox">
        {#each rows as r, i (r.id)}
          {#if i === exactCount && exactCount > 0}<li class="sep">Suggestions</li>{/if}
          <li class="lk-row" class:active={i === active} class:exact={i < exactCount} role="option" aria-selected={i === active}
            onmouseenter={() => (active = i)}>
            <button class="main" onclick={r.run}>
              <span class="badge" style="--c: {r.tagColor}">{r.tag}</span>
              <span class="txt">
                <span class="title">{#if r.symbol}<Sym symbol={r.title} />{:else}{pretty(r.title)}{/if}</span>
                <span class="sub">{r.sub}</span>
              </span>
            </button>
            {#if r.secondary}
              <button class="btn sm" onclick={(e) => { e.stopPropagation(); r.secondary!.run(); }}>{r.secondary.label}</button>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    <div class="foot"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>/</kbd> or <kbd>⌘K</kbd> anywhere</span></div>
  </div>
{/if}

<style>
  .scrim { position: fixed; inset: 0; z-index: 140; background: rgba(5, 6, 10, 0.5); backdrop-filter: blur(4px); animation: fade 0.2s both; }
  .palette {
    position: fixed; z-index: 150; left: 50%; top: 10vh; transform: translateX(-50%); width: min(680px, calc(100vw - 1.5rem));
    background: var(--surface); border-radius: 20px; box-shadow: var(--shadow-pop); overflow: hidden; animation: pop 0.3s var(--ease) both;
    display: flex; flex-direction: column; max-height: 76vh;
  }
  @keyframes pop { from { opacity: 0; transform: translate(-50%, -10px) scale(0.98); } }
  @keyframes fade { from { opacity: 0; } }
  .bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.9rem 1.1rem; border-bottom: 1px solid var(--border); color: var(--muted); }
  .bar input { flex: 1; border: 0; outline: none; background: transparent; color: var(--text); font: inherit; font-size: 1.15rem; }
  .empty { padding: 1.2rem 1.3rem 1.4rem; display: flex; flex-direction: column; gap: 1rem; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
  .grid div { display: flex; flex-direction: column; padding: 0.7rem 0.9rem; border-radius: 12px; background: var(--surface-2); font-size: 0.85rem; }
  .grid span { color: var(--muted); font-size: 0.8rem; }
  .examples { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .results { list-style: none; margin: 0; padding: 0.4rem; overflow-y: auto; }
  .sep { font-size: 0.68rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); padding: 0.6rem 0.8rem 0.3rem; font-weight: 700; }
  .lk-row { display: flex; align-items: center; gap: 0.5rem; border-radius: 12px; padding-right: 0.5rem; }
  .lk-row.active { background: var(--surface-3); }
  .lk-row.exact .title { font-size: 1.05rem; }
  .main { flex: 1; display: flex; align-items: center; gap: 0.8rem; border: 0; background: transparent; text-align: left; padding: 0.6rem 0.7rem; cursor: pointer; min-width: 0; }
  .main .badge { min-width: 5.5rem; justify-content: center; }
  .txt { display: flex; flex-direction: column; min-width: 0; }
  .title { font-weight: 700; font-family: var(--font-display); }
  .sub { color: var(--muted); font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot { display: flex; gap: 1.2rem; padding: 0.6rem 1.1rem; border-top: 1px solid var(--border); font-size: 0.75rem; color: var(--muted); }
  @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } .foot { display: none; } .main .badge { min-width: 0; } }
</style>
