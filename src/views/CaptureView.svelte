<script lang="ts">
  import { onMount } from 'svelte';
  import Fretboard from '../ui/Fretboard.svelte';
  import Piano from '../ui/Piano.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sym from '../ui/Sym.svelte';
  import { app } from '../lib/state.svelte';
  import { chordInfo, identifyMidi, infoOf } from '../core/chords';
  import { identifyScales, scaleInfo, scaleInfoOf } from '../core/scales';
  import { INTERVAL_NAME } from '../core/intervals';
  import { pretty, mod12, midiName } from '../core/notes';
  import { parseTab } from '../core/voicings';
  import { parseNoteList } from '../core/lookup';
  import { guideTones } from '../core/chordScales';
  import { addToSong, chordFretMarks, chordKeyMarks, fretsToMidis, instrumentTimbre, scaleFretMarks, scaleKeyMarks, voicingsFor } from '../lib/helpers';
  import { playNote, strum } from '../lib/audio';
  import { fk } from '../ui/marks';

  const n = $derived(app.tuning.length);
  const frets = $derived(app.capture.frets.length === n ? app.capture.frets : Array(n).fill(-1));
  const midis = $derived([...new Set([...fretsToMidis(frets), ...app.capture.keys])].sort((a, b) => a - b));
  const pcs = $derived(new Set(midis.map(mod12)));
  const matches = $derived(midis.length >= 2 ? identifyMidi(midis).slice(0, 12) : []);
  const best = $derived(matches[0] ? chordInfo(matches[0].root, matches[0].qi, matches[0].bass) : null);
  const scales = $derived(pcs.size >= 2 ? identifyScales(pcs, best?.root ?? (midis.length ? mod12(midis[0]) : undefined), app.settings.level).slice(0, 10) : []);

  const overlayScale = $derived(app.overlayScale ? scaleInfoOf(app.overlayScale) : null);
  const overlayChord = $derived(app.overlayChord ? infoOf(app.overlayChord) : null);
  let overlayVoicing = $state(0);
  const overlayVoicings = $derived(overlayChord && app.settings.instrument === 'guitar' ? voicingsFor(overlayChord.ref).slice(0, 12) : []);
  $effect(() => { void app.overlayChord; overlayVoicing = 0; });

  const fretMarks = $derived.by(() => {
    if (overlayScale) {
      const m = scaleFretMarks(overlayScale, best);
      // keep played notes visible as solid dots on top of the scale
      frets.forEach((f, s) => { if (f >= 0) { const prev = m.get(fk(s, f)); m.set(fk(s, f), { ...(prev ?? { fn: 'none', text: '' }), kind: 'on', text: prev?.text ?? '' }); } });
      return m;
    }
    if (overlayChord && !midis.length) {
      const v = overlayVoicings[overlayVoicing];
      return chordFretMarks(overlayChord, v?.frets ?? null, overlayChord.pcs, true);
    }
    return chordFretMarks(best, frets, pcs, true);
  });
  const keyMarks = $derived.by(() => {
    if (overlayScale) return scaleKeyMarks(overlayScale, best, 36, 84);
    if (overlayChord && !midis.length) return chordKeyMarks(overlayChord, [], overlayChord.pcs, true, 36, 84);
    return chordKeyMarks(best, app.capture.keys, pcs, true, 36, 84);
  });

  function toggleFret(s: number, f: number) {
    const next = [...frets];
    next[s] = next[s] === f ? -1 : f;
    app.capture.frets = next;
    if (next[s] >= 0) playNote(app.tuning[s] + f, instrumentTimbre());
  }
  function muteString(s: number) {
    const next = [...frets];
    next[s] = -1;
    app.capture.frets = next;
  }
  function toggleKey(m: number) {
    const k = app.capture.keys;
    app.capture.keys = k.includes(m) ? k.filter(x => x !== m) : [...k, m];
    if (!k.includes(m)) playNote(m, 'keys');
  }
  function clear() {
    app.capture = { frets: [], keys: [] };
    app.overlayScale = null;
    app.overlayChord = null;
  }
  function strumAll() {
    if (midis.length) strum(midis, app.capture.keys.length && !fretsToMidis(frets).length ? 'keys' : instrumentTimbre());
    else if (overlayChord) {
      const v = overlayVoicings[overlayVoicing];
      strum(v ? fretsToMidis(v.frets) : [...overlayChord.pcs].map(p => 48 + p), instrumentTimbre());
    }
  }

  // quick input: tab or notes
  let quick = $state('');
  function applyQuick(e: Event) {
    e.preventDefault();
    const q = quick.trim();
    if (!q) return;
    const tab = parseTab(q, n);
    if (tab) { app.capture = { frets: tab, keys: [] }; strum(fretsToMidis(tab), instrumentTimbre()); quick = ''; return; }
    const notes = parseNoteList(q);
    if (notes) { app.capture = { frets: [], keys: notes }; strum(notes, 'keys'); quick = ''; return; }
    app.notify('Type a tab like x32010 or notes like C E G Bb');
  }

  // Web MIDI: notes you play are latched into the selection
  let midiStatus = $state<'off' | 'on' | 'none'>('off');
  let held = new Set<number>();
  let fresh = true;
  onMount(() => {
    let inputs: any[] = [];
    const nav = navigator as any;
    if (!nav.requestMIDIAccess) { midiStatus = 'none'; return; }
    nav.requestMIDIAccess().then((access: any) => {
      const bind = () => {
        inputs.forEach(i => (i.onmidimessage = null));
        inputs = [...access.inputs.values()];
        inputs.forEach(i => (i.onmidimessage = onMidi));
        midiStatus = inputs.length ? 'on' : 'off';
      };
      bind();
      access.onstatechange = bind;
    }).catch(() => (midiStatus = 'none'));
    return () => inputs.forEach(i => (i.onmidimessage = null));
  });
  function onMidi(ev: { data: Uint8Array }) {
    const [st, note, vel] = ev.data;
    const cmd = st & 0xf0;
    if (cmd === 0x90 && vel > 0) {
      // a new chord starts when every key was released
      if (fresh) { app.capture = { frets: [], keys: [] }; fresh = false; }
      held.add(note);
      if (!app.capture.keys.includes(note)) app.capture.keys = [...app.capture.keys, note];
      playNote(note, 'keys', vel / 127);
    } else if (cmd === 0x80 || (cmd === 0x90 && vel === 0)) {
      held.delete(note);
      if (!held.size) fresh = true;
    }
  }

  const describe = (m: (typeof matches)[number]) =>
    m.type === 'exact' ? 'Exact' : m.type === 'slash' ? 'Slash chord' : `Missing ${m.missReq.map(pretty).join(', ')}`;
  const guides = $derived(best ? new Set(guideTones(best.ref)) : new Set<number>());
</script>

<div class="capture">
  <section class="hero card">
    <div class="hero-head">
      <div>
        <div class="eyebrow">Identify · reverse chord & scale search</div>
        <h1>Play it. THEODOR names it.</h1>
        <p class="muted">Tap frets or keys{midiStatus === 'on' ? ', or play your MIDI keyboard' : ''}. Every chord and scale that fits shows up instantly.</p>
      </div>
      <form class="quick" onsubmit={applyQuick}>
        <input class="field mono" bind:value={quick} placeholder="x32010 or C E G Bb" aria-label="Quick input: tab or notes" data-testid="quick-input" />
        <button class="btn sm" type="submit">Go</button>
      </form>
    </div>

    {#if overlayScale || overlayChord}
      <div class="overlay-bar">
        <Icon name="eye" size={16} />
        {#if overlayScale}
          <span>Showing <strong>{pretty(overlayScale.name)}</strong> across the neck{best ? `, coloured against ${best.symbol}` : ''}</span>
        {:else if overlayChord}
          <span>Showing <strong><Sym symbol={overlayChord.symbol} /></strong></span>
          {#if overlayVoicings.length > 1 && !midis.length}
            <span class="seg sm">
              <button onclick={() => (overlayVoicing = (overlayVoicing + overlayVoicings.length - 1) % overlayVoicings.length)} aria-label="Previous voicing"><Icon name="arrowL" size={14} /></button>
              <button class="on">{overlayVoicing + 1}/{overlayVoicings.length}</button>
              <button onclick={() => (overlayVoicing = (overlayVoicing + 1) % overlayVoicings.length)} aria-label="Next voicing"><Icon name="arrowR" size={14} /></button>
            </span>
          {/if}
        {/if}
        <span class="sp"></span>
        <button class="btn sm ghost" onclick={() => { app.overlayScale = null; app.overlayChord = null; }}>Hide</button>
      </div>
    {/if}

    {#if app.settings.instrument === 'guitar' || app.settings.instrument === 'bass'}
      <div class="board scroll-x" data-testid="fretboard">
        <Fretboard tuning={app.tuning} frets={app.settings.frets} marks={fretMarks} leftHanded={app.settings.leftHanded} minWidth={app.settings.frets * 40}
          muted={new Set(frets.flatMap((f, s) => (f < 0 ? [s] : [])))} onToggle={toggleFret} onMute={muteString} />
      </div>
    {/if}
    {#if app.settings.showPiano}
      <div class="keys scroll-x" data-testid="piano"><Piano lo={36} hi={84} marks={keyMarks} onToggle={toggleKey} /></div>
    {/if}

    <div class="toolbar">
      <span class="notes">
        {#if midis.length}
          {#each midis as m}<span class="chip static">{pretty((best?.tones.find(t => t.pc === m % 12)?.note ?? midiName(m, best && /b/.test(best.rootName) ? 'flat' : undefined).replace(/\d+$/, '')) + (Math.floor(m / 12) - 1))}</span>{/each}
        {:else}<span class="muted">No notes yet — tap the fretboard or piano.</span>{/if}
      </span>
      <span class="sp"></span>
      <button class="btn sm" onclick={strumAll} disabled={!midis.length && !overlayChord}><Icon name="play" size={14} /> Play</button>
      <button class="btn sm ghost" onclick={clear} data-testid="clear"><Icon name="x" size={14} /> Clear</button>
    </div>
  </section>

  <div class="results">
    <section class="card result" data-testid="chord-result">
      <div class="eyebrow">Chord</div>
      {#if best}
        <div class="best">
          <div>
            <h2 class="sym"><Sym symbol={best.symbol} /></h2>
            <p class="muted">{pretty(best.fullName)}{best.inv ? ' · ' + best.inv : ''} · {describe(matches[0])}</p>
          </div>
          <div class="best-actions">
            <button class="btn sm primary" onclick={() => addToSong([best.ref])}><Icon name="plus" size={14} /> Add to song</button>
            <button class="btn sm" onclick={() => (app.detail = { kind: 'chord', ref: best.ref })}><Icon name="info" size={14} /> More</button>
          </div>
        </div>
        <div class="tones">
          {#each best.tones as t}
            <span class="tone fn-{t.fn}" class:missing={!pcs.has(t.pc)} title={INTERVAL_NAME[t.label] + (pcs.has(t.pc) ? '' : ' — not played')}>
              <b>{pretty(t.note)}</b><small>{t.label === '1' ? 'R' : pretty(t.label)}</small>
              {#if guides.has(t.pc)}<i>guide</i>{/if}
            </span>
          {/each}
        </div>
        {#if matches.length > 1}
          <div class="eyebrow sub">Could also be</div>
          <div class="alts">
            {#each matches.slice(1) as m}
              {@const ci = chordInfo(m.root, m.qi, m.bass)}
              <button class="alt" onclick={() => (app.detail = { kind: 'chord', ref: ci.ref })} title={describe(m)}>
                <Sym symbol={ci.symbol} /><small>{m.type === 'partial' ? 'partial' : m.type === 'slash' ? 'slash' : ''}</small>
              </button>
            {/each}
          </div>
        {/if}
      {:else if midis.length === 1}
        <p class="muted">One note: {pretty(midiName(midis[0]))}. Add another to start naming chords.</p>
      {:else if midis.length}
        <p class="muted">No chord name fits these notes — check the scales on the right.</p>
      {:else}
        <p class="muted">Tap at least two notes.</p>
      {/if}
    </section>

    <section class="card result" data-testid="scale-result">
      <div class="eyebrow">Scales containing these notes</div>
      {#if scales.length}
        <ul class="scales">
          {#each scales as m}
            {@const s = scaleInfo(m.root, m.si)}
            {@const on = app.overlayScale?.id === s.ref.id && app.overlayScale?.root === s.root}
            <li class:on>
              <button class="sname" onclick={() => (app.overlayScale = on ? null : s.ref)} title="Show on the neck">
                <span>{pretty(s.name)}</span>
                <small>{m.extra === 0 ? 'exact' : `+${m.extra} notes`}{s.scale.level !== 'basic' ? ' · ' + (s.scale.level === 'jazz' ? 'jazz' : 'fusion') : ''}</small>
              </button>
              <button class="btn icon sm ghost" onclick={() => (app.detail = { kind: 'scale', ref: s.ref })} aria-label="Scale details"><Icon name="info" size={14} /></button>
            </li>
          {/each}
        </ul>
      {:else}
        <p class="muted">Play two or more notes to see every scale they fit in.</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .capture { display: flex; flex-direction: column; gap: 1.2rem; }
  .hero { padding: 1.4rem 1.5rem 1.1rem; display: flex; flex-direction: column; gap: 1rem; }
  .hero-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 1.5rem; flex-wrap: wrap; }
  h1 { font-size: clamp(1.5rem, 3vw, 2.2rem); margin: 0.2rem 0 0.3rem; }
  .quick { display: flex; gap: 0.4rem; width: min(320px, 100%); }
  .quick input { height: 34px; }
  .overlay-bar { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0.6rem 0.45rem 0.9rem; border-radius: 12px; background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); font-size: 0.88rem; flex-wrap: wrap; }
  .seg.sm button { padding: 0.15rem 0.5rem; display: inline-flex; align-items: center; }
  .sp { flex: 1; }
  .board, .keys { margin: 0 -0.4rem; padding: 0 0.4rem; }
  .keys { display: flex; justify-content: center; }
  .toolbar { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .notes { display: flex; gap: 0.3rem; flex-wrap: wrap; align-items: center; font-size: 0.85rem; }
  .chip.static { cursor: default; }
  .results { display: grid; grid-template-columns: 1.3fr 1fr; gap: 1.2rem; }
  .result { padding: 1.2rem 1.4rem; display: flex; flex-direction: column; gap: 0.8rem; min-width: 0; }
  .best { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .sym { font-size: clamp(2.4rem, 5vw, 3.4rem); }
  .best-actions { display: flex; gap: 0.4rem; }
  .tones { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .tone { position: relative; display: inline-flex; flex-direction: column; align-items: center; min-width: 2.9rem; padding: 0.35rem 0.55rem; border-radius: 12px;
    background: color-mix(in srgb, var(--c) 15%, var(--surface-2)); border: 1px solid color-mix(in srgb, var(--c) 45%, transparent); }
  .tone b { font-family: var(--font-display); font-size: 1.05rem; }
  .tone small { color: var(--c); font-weight: 700; font-size: 0.7rem; }
  .tone i { position: absolute; top: -0.55rem; right: -0.3rem; font-style: normal; font-size: 0.52rem; font-weight: 800; text-transform: uppercase; background: var(--text); color: var(--bg); border-radius: 999px; padding: 0 0.35rem; }
  .tone.missing { opacity: 0.45; border-style: dashed; }
  .eyebrow.sub { margin-top: 0.3rem; }
  .alts { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .alt { display: inline-flex; align-items: baseline; gap: 0.3rem; border: 1px solid var(--border-strong); background: var(--surface-2); border-radius: 999px; padding: 0.25rem 0.75rem; cursor: pointer; font-weight: 700; }
  .alt:hover { border-color: var(--accent); }
  .alt small { color: var(--muted); font-weight: 500; font-size: 0.7rem; }
  .scales { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
  .scales li { display: flex; align-items: center; gap: 0.2rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); padding-right: 0.3rem; transition: border-color 0.15s; }
  .scales li.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .sname { flex: 1; display: flex; justify-content: space-between; align-items: baseline; gap: 0.6rem; border: 0; background: transparent; padding: 0.5rem 0.8rem; text-align: left; cursor: pointer; font-weight: 600; }
  .sname small { color: var(--muted); font-weight: 500; font-size: 0.75rem; white-space: nowrap; }
  @media (max-width: 900px) { .results { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .hero { padding: 1rem; } .result { padding: 1rem; } }
</style>
