<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import Sym from './Sym.svelte';
  import ChordDiagram from './ChordDiagram.svelte';
  import Piano from './Piano.svelte';
  import { app, go } from '../lib/state.svelte';
  import { infoOf, type ChordRef } from '../core/chords';
  import { scaleInfoOf, diatonicChords, SCALES, scaleInfo, identifyScales, type ScaleRef } from '../core/scales';
  import { INTERVAL_NAME, withinLevel } from '../core/intervals';
  import { scalesForChord, guideTones } from '../core/chordScales';
  import { pretty, mod12 } from '../core/notes';
  import { pianoVoicing, tabString } from '../core/voicings';
  import { addToSong, chordKeyMarks, playChord, playScaleInfo, scaleKeyMarks, voicingsFor } from '../lib/helpers';

  const d = $derived(app.detail);
  const chord = $derived(d?.kind === 'chord' ? infoOf(d.ref) : null);
  const scale = $derived(d?.kind === 'scale' ? scaleInfoOf(d.ref) : null);

  const voicings = $derived(chord && app.settings.instrument === 'guitar' ? voicingsFor(chord.ref).slice(0, 8) : []);
  const fitting = $derived(chord ? scalesForChord(chord.ref, undefined, undefined, app.settings.level).slice(0, 6) : []);
  const guides = $derived(chord ? new Set(guideTones(chord.ref)) : new Set<number>());
  const chordKeys = $derived(chord ? chordKeyMarks(chord, pianoVoicing(chord.root, chord.qi, chord.bass), chord.pcs, false, 48, 84) : new Map());

  const harmonised = $derived(scale ? diatonicChords(scale.root, scale.scale.i, 4) : []);
  const scaleKeys = $derived(scale ? scaleKeyMarks(scale, null, 48, 84) : new Map());
  // Modes: other scales in the same family that share these exact notes
  const relatives = $derived.by(() => {
    if (!scale) return [];
    return identifyScales(scale.pcs, undefined, app.settings.level)
      .filter(m => m.extra === 0 && !(m.root === scale.root && m.si === scale.scale.i))
      .slice(0, 8)
      .map(m => scaleInfo(m.root, m.si));
  });

  function openChord(ref: ChordRef) { app.detail = { kind: 'chord', ref }; playChord(ref); }
  function openScale(ref: ScaleRef) { app.detail = { kind: 'scale', ref }; }
  function close() { app.detail = null; }

  function showOnNeck() {
    if (scale) { app.overlayScale = scale.ref; app.overlayChord = null; }
    else if (chord) { app.overlayChord = chord.ref; app.overlayScale = null; app.capture = { frets: [], keys: [] }; }
    go('capture');
    close();
  }
  function soloOver() {
    if (!chord) return;
    go('solo');
    close();
  }
</script>

<Sheet open={!!d} onClose={close} label={chord ? chord.symbol : scale ? scale.name : 'Detail'} width={520}>
  <div class="wrap" data-testid="detail">
    <div class="head">
      <div>
        <div class="eyebrow">{chord ? chord.q.fam + ' · chord' : scale ? scale.scale.family : ''}</div>
        {#if chord}
          <h2 class="big"><Sym symbol={chord.symbol} /></h2>
          <p class="muted">{pretty(chord.fullName)}{chord.inv ? ' · ' + chord.inv : ''}</p>
        {:else if scale}
          <h2 class="big">{pretty(scale.name)}</h2>
          <p class="vibe">{scale.scale.vibe}</p>
        {/if}
      </div>
      <button class="btn icon ghost" onclick={close} aria-label="Close"><Icon name="x" /></button>
    </div>

    {#if chord}
      <div class="actions">
        <button class="btn primary sm" onclick={() => playChord(chord.ref)}><Icon name="play" size={14} /> Strum</button>
        <button class="btn sm" onclick={() => playChord(chord.ref, { arp: true })}>Arpeggio</button>
        <button class="btn sm" onclick={() => playChord(chord.ref, { keys: true })}>Keys</button>
        <button class="btn sm" onclick={() => addToSong([chord.ref])}><Icon name="plus" size={14} /> Add to song</button>
        <button class="btn sm ghost" onclick={showOnNeck}><Icon name="eye" size={14} /> On the neck</button>
      </div>

      <section>
        <div class="eyebrow">Formula</div>
        <div class="tones">
          {#each chord.tones as t}
            <div class="tone fn-{t.fn}" title={INTERVAL_NAME[t.label]}>
              <span class="note">{pretty(t.note)}</span>
              <span class="lab">{t.label === '1' ? 'R' : pretty(t.label)}</span>
              {#if guides.has(t.pc)}<span class="guide" title="Guide tone — defines the chord's sound">guide</span>{/if}
            </div>
          {/each}
          {#if chord.foreignBass}<div class="tone fn-bass"><span class="note">{pretty(chord.bassName)}</span><span class="lab">bass</span></div>{/if}
        </div>
        <p class="note-line muted">{chord.tones.map(t => INTERVAL_NAME[t.label]).filter(Boolean).join(' · ')}</p>
      </section>

      {#if voicings.length}
        <section>
          <div class="eyebrow">Voicings on {app.tuningName}</div>
          <div class="voicings">
            {#each voicings as v}
              <button class="voicing" onclick={() => playChord(chord.ref, { voicing: v })} title="Play this voicing">
                <ChordDiagram frets={v.frets} tuning={app.tuning} info={chord} w={70} h={88} />
                <span class="mono">{tabString(v.frets)}</span>
              </button>
            {/each}
          </div>
        </section>
      {/if}

      <section>
        <div class="eyebrow">On keys</div>
        <div class="scroll-x"><Piano lo={48} hi={84} marks={chordKeys} /></div>
      </section>

      {#if fitting.length}
        <section>
          <div class="eyebrow">Scales that fit</div>
          <ul class="list">
            {#each fitting as s}
              <li>
                <button class="row" onclick={() => openScale(s.ref)}>
                  <span class="title">{pretty(s.name)} {#if s.outsideTheBox}<span class="badge" style="--c: var(--brand-2)">outside the box</span>{/if}</span>
                  <span class="sub">{s.why}</span>
                </button>
              </li>
            {/each}
          </ul>
          <button class="btn sm ghost" onclick={soloOver}><Icon name="wave" size={14} /> Practise soloing in Solo view</button>
        </section>
      {/if}
    {:else if scale}
      <div class="actions">
        <button class="btn primary sm" onclick={() => playScaleInfo(scale)}><Icon name="play" size={14} /> Play</button>
        <button class="btn sm ghost" onclick={showOnNeck}><Icon name="eye" size={14} /> Show on the neck</button>
      </div>

      <section>
        <div class="eyebrow">Notes</div>
        <div class="tones">
          {#each scale.notes as n}
            <div class="tone" class:fn-root={n.label === '1'} class:fn-none={n.label !== '1'} title={INTERVAL_NAME[n.label] ?? n.label}>
              <span class="note">{pretty(n.note)}</span>
              <span class="lab">{n.label === '1' ? 'R' : pretty(n.label)}</span>
            </div>
          {/each}
        </div>
        <p class="note-line muted mono">{scale.scale.formula}</p>
      </section>

      <section>
        <div class="eyebrow">On keys</div>
        <div class="scroll-x"><Piano lo={48} hi={84} marks={scaleKeys} /></div>
      </section>

      {#if harmonised.length}
        <section>
          <div class="eyebrow">Chords in this scale</div>
          <div class="harm">
            {#each harmonised as h}
              <button class="hchip" onclick={() => openChord(h.ref)}>
                <span class="roman">{pretty(h.roman)}</span>
                <Sym symbol={h.symbol} />
              </button>
            {/each}
          </div>
          <button class="btn sm ghost" onclick={() => addToSong(harmonised.slice(0, 4).map(h => h.ref))}><Icon name="plus" size={14} /> Add first four to song</button>
        </section>
      {/if}

      {#if relatives.length}
        <section>
          <div class="eyebrow">Same notes, different home</div>
          <div class="harm">
            {#each relatives as r}
              <button class="chip" onclick={() => openScale(r.ref)}>{pretty(r.name)}</button>
            {/each}
          </div>
          <p class="note-line muted">Same notes, different tonic. The note you treat as home changes the mood.</p>
        </section>
      {/if}
    {/if}
  </div>
</Sheet>

<style>
  .wrap { padding: 1.25rem 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.4rem; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
  .big { font-size: 2.3rem; margin: 0.15rem 0 0.25rem; }
  .vibe { color: var(--text-2); font-size: 0.95rem; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  section { display: flex; flex-direction: column; gap: 0.6rem; }
  .tones { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .tone {
    position: relative; display: flex; flex-direction: column; align-items: center; min-width: 3.1rem; padding: 0.45rem 0.6rem 0.35rem;
    border-radius: 12px; background: color-mix(in srgb, var(--c) 14%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent);
  }
  .tone .note { font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; }
  .tone .lab { font-size: 0.72rem; color: var(--c); font-weight: 700; }
  .tone .guide { position: absolute; top: -0.55rem; right: -0.3rem; font-size: 0.55rem; font-weight: 800; text-transform: uppercase; background: var(--text); color: var(--bg); border-radius: 999px; padding: 0 0.35rem; }
  .note-line { font-size: 0.8rem; }
  .voicings { display: grid; grid-template-columns: repeat(auto-fill, minmax(84px, 1fr)); gap: 0.5rem; }
  .voicing { display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.5rem 0.2rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; transition: border-color 0.15s, transform 0.15s var(--ease); }
  .voicing:hover { border-color: var(--accent); transform: translateY(-2px); }
  .voicing .mono { font-size: 0.7rem; color: var(--muted); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .row { width: 100%; text-align: left; border: 1px solid var(--border); background: var(--surface-2); border-radius: 12px; padding: 0.6rem 0.8rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.1rem; }
  .row:hover { border-color: var(--accent); }
  .row .title { font-weight: 700; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .row .sub { font-size: 0.8rem; color: var(--muted); }
  .harm { display: flex; flex-wrap: wrap; gap: 0.4rem; }
  .hchip { display: flex; flex-direction: column; align-items: center; min-width: 4rem; padding: 0.4rem 0.6rem; border-radius: 12px; border: 1px solid var(--border-strong); background: var(--surface-2); cursor: pointer; font-weight: 700; }
  .hchip:hover { border-color: var(--accent); }
  .roman { font-size: 0.7rem; color: var(--muted); font-family: var(--font-display); }
</style>
