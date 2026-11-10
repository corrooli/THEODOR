<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon from '../ui/Icon.svelte';
  import Sym from '../ui/Sym.svelte';
  import { app } from '../lib/state.svelte';
  import { transport } from '../lib/transport.svelte';
  import { infoOf, parseChordSymbol, type ChordRef } from '../core/chords';
  import { analyzeSong, detectKey, detectPatterns, keyName, FUNCTION_LABEL, type Key } from '../core/analysis';
  import { ideasFor, applyIdea, type Idea } from '../core/ideas';
  import { scalesForChord } from '../core/chordScales';
  import { pretty, ROOT_MAJ, ROOT_MIN } from '../core/notes';
  import { withinLevel } from '../core/intervals';
  import { chordItem, encodeSeed, newSong, songFromJSON, songToJSON, uid, DEMO_SONGS, type Song } from '../lib/song';
  import { playChord, playChordSequence } from '../lib/helpers';

  const song = $derived(app.song);
  const flat = $derived(song.sections.flatMap((s, si) => s.chords.map((c, ci) => ({ item: c, si, ci }))));
  const seq = $derived(flat.map(f => ({ ref: f.item.ref, beats: f.item.beats })));
  const keys = $derived(seq.length ? detectKey(seq) : []);
  const key = $derived<Key>(song.key ?? keys[0]?.key ?? { tonic: 0, mode: 'major' });
  const analysis = $derived(seq.length ? analyzeSong(seq, key) : []);
  const patterns = $derived(seq.length ? detectPatterns(seq, key).filter(p => withinLevel(p.level, app.settings.level)) : []);
  const patternGroups = $derived.by(() => {
    const m = new Map<string, { name: string; about: string; count: number }>();
    for (const p of patterns) {
      const g = m.get(p.name);
      if (g) g.count++;
      else m.set(p.name, { name: p.name, about: p.about, count: 1 });
    }
    return [...m.values()];
  });
  const indexOf = (id: string) => flat.findIndex(f => f.item.id === id);

  const selIndex = $derived(app.selectedChord ? indexOf(app.selectedChord) : -1);
  const sel = $derived(selIndex >= 0 ? flat[selIndex] : null);
  const selAnalysis = $derived(selIndex >= 0 ? analysis[selIndex] : null);
  const nextRef = $derived(selIndex >= 0 && flat.length > 1 ? flat[(selIndex + 1) % flat.length].item.ref : undefined);
  const ideas = $derived(sel ? ideasFor(sel.item.ref, key, nextRef, app.settings.level) : []);
  const selScales = $derived(sel ? scalesForChord(sel.item.ref, key, nextRef, app.settings.level).slice(0, 3) : []);
  let ideaFamily = $state<string>('All');
  const families = $derived(['All', ...new Set(ideas.map(i => i.family))]);
  const shownIdeas = $derived(ideaFamily === 'All' ? ideas : ideas.filter(i => i.family === ideaFamily));
  $effect(() => { if (!families.includes(ideaFamily)) ideaFamily = 'All'; });

  const ALL_KEYS: Key[] = [...Array(12).keys()].flatMap(t => [{ tonic: t, mode: 'major' as const }, { tonic: t, mode: 'minor' as const }]);
  const keyId = (k: Key | null) => (k ? `${k.tonic}:${k.mode}` : 'auto');

  onDestroy(() => transport.stop());

  // ---------- library ----------
  function selectSong(id: string) { transport.stop(); app.currentId = id; app.selectedChord = null; }
  function createSong() {
    const s = newSong(`Jam ${app.songs.length + 1}`);
    app.songs.unshift(s);
    selectSong(s.id);
  }
  function duplicate() {
    const copy: Song = JSON.parse(JSON.stringify(song));
    copy.id = uid();
    copy.title = song.title + ' (copy)';
    copy.sections.forEach(s => { s.id = uid(); s.chords.forEach(c => (c.id = uid())); });
    app.songs.unshift(copy);
    selectSong(copy.id);
  }
  function remove() {
    if (!confirm(`Delete “${song.title}”? This cannot be undone.`)) return;
    const idx = app.songs.findIndex(s => s.id === song.id);
    app.songs.splice(idx, 1);
    if (!app.songs.length) app.songs.push(newSong('My first jam'));
    selectSong(app.songs[Math.min(idx, app.songs.length - 1)].id);
  }
  function exportJSON() {
    const blob = new Blob([songToJSON(song)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${song.title.replace(/[^\w\- ]+/g, '').trim() || 'song'}.theodor.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  let fileInput: HTMLInputElement | undefined = $state();
  async function importJSON(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files?.length) return;
    let last = '';
    for (const f of files) {
      try {
        const s = songFromJSON(await f.text());
        if (app.songs.some(x => x.id === s.id)) s.id = uid();
        app.songs.unshift(s);
        last = s.id;
      } catch (err) {
        app.notify(`Could not read ${f.name}: ${(err as Error).message}`);
      }
    }
    if (last) { selectSong(last); app.notify('Song imported'); }
    (e.target as HTMLInputElement).value = '';
  }
  async function share() {
    try {
      const seed = await encodeSeed(song);
      const url = `${location.origin}${location.pathname}#/song?s=${seed}`;
      await navigator.clipboard.writeText(url);
      app.notify('Share link copied — send it to your band');
    } catch {
      app.notify('Could not copy the link');
    }
  }

  // ---------- editing ----------
  let addText = $state<Record<string, string>>({});
  function addChords(sectionIndex: number) {
    const sec = song.sections[sectionIndex];
    const text = (addText[sec.id] ?? '').trim();
    if (!text) return;
    const items = [];
    for (const tok of text.split(/[\s,|]+/).filter(Boolean)) {
      const [sym, beatStr] = tok.split('*');
      const ref = parseChordSymbol(sym);
      if (!ref) { app.notify(`“${sym}” is not a chord I know`); return; }
      items.push(chordItem(ref, beatStr ? Math.max(1, Math.min(16, parseInt(beatStr, 10) || 4)) : 4));
    }
    sec.chords.push(...items);
    addText[sec.id] = '';
    app.touch();
  }
  function addSection() {
    const names = ['Verse', 'Chorus', 'Bridge', 'Solo', 'Outro', 'Intro'];
    const name = names.find(n => !song.sections.some(s => s.name === n)) ?? `Part ${song.sections.length + 1}`;
    song.sections.push({ id: uid(), name, chords: [] });
    app.touch();
  }
  function removeSection(i: number) {
    if (song.sections.length === 1) { song.sections[0].chords = []; return; }
    song.sections.splice(i, 1);
    app.touch();
  }
  function removeChord(si: number, ci: number) {
    const [c] = song.sections[si].chords.splice(ci, 1);
    if (app.selectedChord === c.id) app.selectedChord = null;
    app.touch();
  }
  function setBeats(si: number, ci: number, d: number) {
    const c = song.sections[si].chords[ci];
    c.beats = Math.max(1, Math.min(16, c.beats + d));
    app.touch();
  }
  function move(si: number, ci: number, d: number) {
    const arr = song.sections[si].chords;
    const j = ci + d;
    if (j < 0 || j >= arr.length) return;
    [arr[ci], arr[j]] = [arr[j], arr[ci]];
    app.touch();
  }
  function select(id: string, ref: ChordRef) {
    app.selectedChord = app.selectedChord === id ? null : id;
    if (app.selectedChord) playChord(ref);
  }
  function setKey(v: string) {
    if (v === 'auto') song.key = null;
    else { const [t, m] = v.split(':'); song.key = { tonic: +t, mode: m as Key['mode'] }; }
    app.touch();
  }

  // ---------- ideas ----------
  function audition(idea: Idea) {
    if (!sel) return;
    const refs = idea.kind === 'replace' ? [...idea.chords, ...(nextRef ? [nextRef] : [])] : [sel.item.ref, ...idea.chords, ...(nextRef ? [nextRef] : [])];
    playChordSequence(refs, 0.8);
  }
  function auditionOriginal() {
    if (!sel) return;
    playChordSequence([sel.item.ref, ...(nextRef ? [nextRef] : [])], 0.8);
  }
  function apply(idea: Idea) {
    if (!sel) return;
    const sec = song.sections[sel.si];
    const before = new Set(sec.chords.map(c => c.id));
    sec.chords = applyIdea(sec.chords, sel.ci, idea, (ref, beats) => chordItem(ref, beats));
    const added = sec.chords.find(c => !before.has(c.id));
    if (idea.kind === 'replace' && added) app.selectedChord = added.id;
    app.touch();
    app.notify(`Applied: ${idea.title}`);
  }

  // ---------- transport ----------
  function togglePlay() {
    if (transport.playing) transport.stop();
    else transport.start(flat.map(f => f.item), song.tempo, Math.max(0, selIndex));
  }

  const roleColor: Record<string, string> = {
    diatonic: 'var(--muted)', 'secondary-dominant': 'var(--hf-D)', 'tritone-sub': 'var(--brand-2)', 'related-ii': 'var(--hf-S)',
    'passing-dim': 'var(--fn-seventh)', borrowed: 'var(--brand-3)', chromatic: 'var(--brand-1)',
  };
  const roleName: Record<string, string> = {
    diatonic: 'in key', 'secondary-dominant': 'secondary dominant', 'tritone-sub': 'tritone sub', 'related-ii': 'related ii',
    'passing-dim': 'passing dim', borrowed: 'borrowed', chromatic: 'chromatic',
  };
  const spice = (n: number) => '🌶'.repeat(n);
  const totalBars = $derived(Math.round(seq.reduce((a, c) => a + c.beats, 0) / 4));
</script>

<div class="song">
  <aside class="library card">
    <div class="lib-head">
      <div class="eyebrow">Your songs</div>
      <button class="btn icon sm" onclick={createSong} aria-label="New song" title="New song" data-testid="new-song"><Icon name="plus" size={16} /></button>
    </div>
    <ul>
      {#each app.songs as s (s.id)}
        <li><button class:on={s.id === song.id} onclick={() => selectSong(s.id)}>
          <span>{s.title}</span><small>{s.sections.reduce((a, x) => a + x.chords.length, 0)} chords</small>
        </button></li>
      {/each}
    </ul>
    <div class="lib-actions">
      <button class="btn sm ghost" onclick={() => fileInput?.click()}><Icon name="upload" size={14} /> Import</button>
      <input bind:this={fileInput} type="file" accept=".json,application/json" multiple hidden onchange={importJSON} />
    </div>
  </aside>

  <div class="main-col">
    <section class="card head">
      <div class="title-row">
        <input class="title" bind:value={song.title} oninput={() => app.touch()} aria-label="Song title" data-testid="song-title" />
        <div class="head-actions">
          <button class="btn sm" onclick={share} title="Copy a link that contains the whole song"><Icon name="share" size={14} /> Share link</button>
          <button class="btn sm ghost" onclick={exportJSON} title="Download as JSON"><Icon name="download" size={14} /> JSON</button>
          <button class="btn icon sm ghost" onclick={duplicate} aria-label="Duplicate song" title="Duplicate"><Icon name="copy" size={15} /></button>
          <button class="btn icon sm ghost" onclick={remove} aria-label="Delete song" title="Delete"><Icon name="trash" size={15} /></button>
        </div>
      </div>

      <div class="meta">
        <div class="key-box">
          <span class="eyebrow">Key</span>
          <strong data-testid="song-key">{keyName(key)}</strong>
          {#if !song.key && keys[0]}<span class="conf" title="How sure THEODOR is">{keys[0].confidence}% sure</span>{/if}
          <select class="field sm" value={keyId(song.key)} onchange={(e) => setKey((e.target as HTMLSelectElement).value)} aria-label="Key">
            <option value="auto">Auto-detect</option>
            {#each ALL_KEYS as k}<option value={keyId(k)}>{keyName(k)}</option>{/each}
          </select>
        </div>
        {#if !song.key && keys.length > 1 && keys[1].confidence > 25}
          <div class="alts">or maybe
            {#each keys.slice(1, 3) as k}<button class="chip" onclick={() => setKey(keyId(k.key))}>{keyName(k.key)}</button>{/each}
          </div>
        {/if}
        <span class="sp"></span>
        <div class="transport">
          <button class="btn sm" class:primary={!transport.playing} onclick={togglePlay} disabled={!flat.length} data-testid="play">
            <Icon name={transport.playing ? 'stop' : 'play'} size={14} /> {transport.playing ? 'Stop' : selIndex >= 0 ? 'Play from here' : 'Play'}
          </button>
          <label class="bpm"><input type="number" min="40" max="260" bind:value={song.tempo} aria-label="Tempo" /> bpm</label>
          <div class="seg">
            {#each [['strum', 'Strum'], ['comp', 'Jazz'], ['pad', 'Pad']] as [f, l]}
              <button class:on={transport.feel === f} onclick={() => (transport.feel = f as typeof transport.feel)}>{l}</button>
            {/each}
          </div>
          <button class="btn icon sm" class:on={transport.loop} onclick={() => (transport.loop = !transport.loop)} title="Loop" aria-label="Loop" aria-pressed={transport.loop}><Icon name="loop" size={15} /></button>
          <button class="btn icon sm" class:on={transport.metronome} onclick={() => (transport.metronome = !transport.metronome)} title="Click" aria-label="Metronome" aria-pressed={transport.metronome}><Icon name="metro" size={15} /></button>
        </div>
      </div>
      {#if patterns.length}
        <div class="patterns">
          {#each patternGroups as g}
            <span class="pattern" title={g.about}><Icon name="spark" size={13} /> {g.name}{#if g.count > 1}<small>×{g.count}</small>{/if}</span>
          {/each}
        </div>
      {/if}
    </section>

    {#if !flat.length}
      <section class="card empty">
        <h3>Start with some chords</h3>
        <p class="muted">Type a progression below (e.g. <code>Am7 D7 Gmaj7*8</code> — <code>*8</code> = 8 beats), add chords from Identify or ⌘K, or load a demo:</p>
        <div class="demo">
          {#each DEMO_SONGS as d}
            <button class="chip" onclick={() => { const s = app.songs.find(x => x.title === d.title); if (s) selectSong(s.id); }}>{d.title}</button>
          {/each}
        </div>
      </section>
    {/if}

    {#each song.sections as sec, si (sec.id)}
      <section class="card section">
        <div class="sec-head">
          <input class="sec-name" bind:value={sec.name} aria-label="Section name" />
          <span class="muted small">{Math.round(sec.chords.reduce((a, c) => a + c.beats, 0) / 4)} bars</span>
          <span class="sp"></span>
          <button class="btn icon sm ghost" onclick={() => removeSection(si)} aria-label="Remove section" title="Remove section"><Icon name="trash" size={14} /></button>
        </div>
        <div class="blocks">
          {#each sec.chords as c, ci (c.id)}
            {@const idx = indexOf(c.id)}
            {@const a = analysis[idx]}
            <div class="block hf-{a?.fn ?? '?'}" class:sel={app.selectedChord === c.id} class:playing={app.playingId === c.id}
              style="flex-grow: {c.beats}; --role: {roleColor[a?.role ?? 'diatonic']}" data-testid="chord-block">
              <button class="block-main" onclick={() => select(c.id, c.ref)} title={a?.why}>
                <span class="roman">{a ? pretty(a.roman) : ''}</span>
                <span class="csym"><Sym symbol={infoOf(c.ref).symbol} /></span>
                <span class="role">{a && a.role !== 'diatonic' ? roleName[a.role] : ''}</span>
              </button>
              <div class="block-tools">
                <button onclick={() => setBeats(si, ci, -1)} aria-label="Fewer beats">−</button>
                <span>{c.beats}</span>
                <button onclick={() => setBeats(si, ci, 1)} aria-label="More beats">+</button>
                <button onclick={() => move(si, ci, -1)} aria-label="Move left"><Icon name="arrowL" size={11} /></button>
                <button onclick={() => move(si, ci, 1)} aria-label="Move right"><Icon name="arrowR" size={11} /></button>
                <button onclick={() => removeChord(si, ci)} aria-label="Remove chord"><Icon name="x" size={11} /></button>
              </div>
              {#if app.playingId === c.id}<span class="beatbar" style="width: {((transport.beat + 1) / c.beats) * 100}%"></span>{/if}
            </div>
          {/each}
          <form class="add" onsubmit={(e) => { e.preventDefault(); addChords(si); }}>
            <input class="field" placeholder="Add: Dm7 G7 Cmaj7*8" bind:value={addText[sec.id]} aria-label="Add chords to {sec.name}" data-testid="add-chords" />
          </form>
        </div>
      </section>
    {/each}
    <button class="btn ghost add-sec" onclick={addSection}><Icon name="plus" size={15} /> Add section</button>

    <div class="legend muted">
      <span class="lg hf-T">Tonic · home</span><span class="lg hf-S">Subdominant · away</span><span class="lg hf-D">Dominant · tension</span><span class="lg hf-?">Colour / outside</span>
      <span class="sp"></span><span>{totalBars} bars · {song.tempo} bpm</span>
    </div>
  </div>

  <aside class="insight card" class:open={!!sel}>
    {#if sel && selAnalysis}
      {@const ci = selAnalysis.info}
      <div class="ins-head">
        <div>
          <div class="eyebrow">{FUNCTION_LABEL[selAnalysis.fn]}</div>
          <h2><Sym symbol={ci.symbol} /> <span class="roman-big">{pretty(selAnalysis.roman)}</span></h2>
        </div>
        <button class="btn icon sm ghost" onclick={() => (app.selectedChord = null)} aria-label="Close"><Icon name="x" size={16} /></button>
      </div>
      <p class="why">{selAnalysis.why}</p>
      <div class="row-actions">
        <button class="btn sm" onclick={() => playChord(ci.ref)}><Icon name="play" size={13} /> Play</button>
        <button class="btn sm ghost" onclick={() => (app.detail = { kind: 'chord', ref: ci.ref })}><Icon name="info" size={13} /> Voicings</button>
      </div>

      {#if selScales.length}
        <div class="eyebrow">Solo with</div>
        <div class="scales">
          {#each selScales as s}
            <button class="chip" class:outside={s.outsideTheBox} onclick={() => (app.detail = { kind: 'scale', ref: s.ref })} title={s.why}>{pretty(s.name)}</button>
          {/each}
        </div>
      {/if}

      <div class="ideas-head">
        <div class="eyebrow">Ideas · think outside the box</div>
        <button class="btn sm ghost" onclick={auditionOriginal} title="Hear the original"><Icon name="play" size={12} /> Original</button>
      </div>
      {#if families.length > 2}
        <div class="seg wrap">
          {#each families as f}<button class:on={ideaFamily === f} onclick={() => (ideaFamily = f)}>{f}</button>{/each}
        </div>
      {/if}
      <ul class="ideas">
        {#each shownIdeas as idea (idea.id)}
          <li class="idea">
            <div class="idea-top">
              <span class="badge">{idea.family}</span>
              <span class="spice" title="Spice level">{spice(idea.spice)}</span>
            </div>
            <div class="idea-title">{pretty(idea.title)}</div>
            <div class="idea-chords">
              {#if idea.kind === 'insert-before'}<span class="muted"><Sym symbol={ci.symbol} /> →</span>{/if}
              {#each idea.chords as r}<Sym symbol={infoOf(r).symbol} />{/each}
              {#if nextRef}<span class="muted">→ <Sym symbol={infoOf(nextRef).symbol} /></span>{/if}
            </div>
            <p class="idea-why">{idea.why}</p>
            <div class="idea-actions">
              <button class="btn sm" onclick={() => audition(idea)}><Icon name="play" size={12} /> Hear it</button>
              <button class="btn sm primary" onclick={() => apply(idea)} data-testid="apply-idea">Use it</button>
            </div>
          </li>
        {:else}
          <li class="muted">No ideas at this depth — try a deeper theory level in settings.</li>
        {/each}
      </ul>
    {:else}
      <div class="ins-empty">
        <Icon name="bulb" size={28} />
        <h3>Tap a chord</h3>
        <p class="muted">See why it works in {keyName(key)}, what to solo with, and ideas to make it more interesting — then hear them before you commit.</p>
      </div>
    {/if}
  </aside>
</div>

<style>
  .song { display: grid; grid-template-columns: 220px minmax(0, 1fr) 360px; gap: 1.2rem; align-items: start; }
  .library { padding: 1rem; position: sticky; top: 5rem; display: flex; flex-direction: column; gap: 0.6rem; max-height: calc(100vh - 7rem); overflow: auto; }
  .lib-head { display: flex; justify-content: space-between; align-items: center; }
  .library ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .library li button { width: 100%; text-align: left; border: 0; background: transparent; padding: 0.45rem 0.6rem; border-radius: 10px; cursor: pointer; display: flex; flex-direction: column; }
  .library li button:hover { background: var(--surface-2); }
  .library li button.on { background: var(--surface-3); }
  .library li span { font-weight: 600; font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .library li small { color: var(--muted); font-size: 0.72rem; }
  .main-col { display: flex; flex-direction: column; gap: 1rem; min-width: 0; }
  .head { padding: 1.1rem 1.3rem; display: flex; flex-direction: column; gap: 0.8rem; }
  .title-row { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .title { flex: 1; min-width: 200px; font-family: var(--font-display); font-weight: 700; font-size: 1.8rem; letter-spacing: -0.02em; border: 0; background: transparent; color: var(--text); outline: none; padding: 0; border-bottom: 2px solid transparent; }
  .title:focus { border-bottom-color: var(--accent); }
  .head-actions { display: flex; gap: 0.3rem; flex-wrap: wrap; }
  .meta { display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; }
  .key-box { display: flex; align-items: center; gap: 0.5rem; }
  .key-box strong { font-family: var(--font-display); font-size: 1.15rem; }
  .conf { font-size: 0.72rem; color: var(--muted); }
  select.sm { height: 30px; width: 9.5rem; font-size: 0.8rem; }
  .alts { display: flex; align-items: center; gap: 0.3rem; font-size: 0.8rem; color: var(--muted); }
  .sp { flex: 1; }
  .transport { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
  .bpm { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); }
  .bpm input { width: 3.6rem; height: 30px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); text-align: center; font: inherit; font-size: 0.85rem; }
  .btn.on { border-color: var(--accent); color: var(--accent); }
  .patterns { display: flex; flex-wrap: wrap; gap: 0.4rem; }
    .pattern small { opacity: 0.6; margin-left: 0.15rem; }
  .pattern { display: inline-flex; align-items: center; gap: 0.3rem; font-size: 0.78rem; font-weight: 600; padding: 0.2rem 0.65rem; border-radius: 999px; background: color-mix(in srgb, var(--brand-2) 14%, transparent); color: var(--text); cursor: help; }
  .empty { padding: 1.4rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .demo { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  code { font-family: var(--font-mono); font-size: 0.85em; background: var(--surface-2); padding: 0.05em 0.35em; border-radius: 5px; }
  .section { padding: 0.9rem 1rem 1rem; display: flex; flex-direction: column; gap: 0.6rem; }
  .sec-head { display: flex; align-items: center; gap: 0.6rem; }
  .sec-name { font-family: var(--font-display); font-weight: 700; font-size: 1rem; border: 0; background: transparent; color: var(--text); outline: none; width: 10rem; }
  .small { font-size: 0.78rem; }
  .blocks { display: flex; flex-wrap: wrap; gap: 0.45rem; }
  .block {
    position: relative; flex-basis: 6.5rem; min-width: 6.5rem; max-width: 22rem; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border);
    overflow: hidden; transition: border-color 0.15s, transform 0.15s var(--ease), box-shadow 0.2s;
  }
  .block::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--c); }
  .block:hover { border-color: var(--border-strong); }
  .block.sel { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 25%, transparent); }
  .block.playing { transform: translateY(-2px); box-shadow: 0 8px 24px -10px var(--c); border-color: var(--c); }
  .block-main { width: 100%; border: 0; background: transparent; text-align: left; padding: 0.5rem 0.7rem 0.2rem 0.9rem; cursor: pointer; display: flex; flex-direction: column; }
  .roman { font-family: var(--font-display); font-size: 0.75rem; color: var(--c); font-weight: 700; min-height: 1em; }
  .csym { font-family: var(--font-display); font-weight: 700; font-size: 1.25rem; }
  .role { font-size: 0.64rem; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; color: var(--role); min-height: 1em; }
  .block-tools { display: flex; align-items: center; gap: 0.05rem; padding: 0 0.4rem 0.3rem 0.7rem; opacity: 0; transition: opacity 0.15s; font-size: 0.72rem; color: var(--muted); }
  .block:hover .block-tools, .block.sel .block-tools, .block:focus-within .block-tools { opacity: 1; }
  .block-tools button { border: 0; background: transparent; color: var(--muted); cursor: pointer; padding: 0.1rem 0.3rem; border-radius: 6px; display: inline-flex; }
  .block-tools button:hover { background: var(--surface-3); color: var(--text); }
  .beatbar { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--c); transition: width 0.1s linear; }
  .add { flex: 1 1 12rem; display: flex; }
  .add input { height: 100%; min-height: 3.2rem; border-style: dashed; }
  .add-sec { align-self: flex-start; }
  .legend { display: flex; flex-wrap: wrap; gap: 0.9rem; font-size: 0.75rem; align-items: center; }
  .lg { display: inline-flex; align-items: center; gap: 0.35rem; }
  .lg::before { content: ''; width: 10px; height: 10px; border-radius: 3px; background: var(--c); }
  .insight { padding: 1.1rem 1.2rem; position: sticky; top: 5rem; display: flex; flex-direction: column; gap: 0.7rem; max-height: calc(100vh - 7rem); overflow: auto; }
  .ins-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .ins-head h2 { font-size: 1.9rem; display: flex; align-items: baseline; gap: 0.6rem; }
  .roman-big { font-size: 1rem; color: var(--muted); }
  .why { font-size: 0.9rem; color: var(--text-2); }
  .row-actions { display: flex; gap: 0.4rem; }
  .scales { display: flex; flex-wrap: wrap; gap: 0.35rem; }
  .chip.outside { border-color: color-mix(in srgb, var(--brand-2) 60%, transparent); }
  .ideas-head { display: flex; justify-content: space-between; align-items: center; margin-top: 0.4rem; }
  .seg.wrap { flex-wrap: wrap; border-radius: 14px; }
  .ideas { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
  .idea { padding: 0.75rem 0.85rem; border-radius: 14px; background: var(--surface-2); border: 1px solid var(--border); display: flex; flex-direction: column; gap: 0.3rem; }
  .idea-top { display: flex; justify-content: space-between; align-items: center; }
  .spice { font-size: 0.7rem; }
  .idea-title { font-weight: 700; }
  .idea-chords { display: flex; flex-wrap: wrap; gap: 0.45rem; font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; align-items: baseline; }
  .idea-why { font-size: 0.8rem; color: var(--muted); }
  .idea-actions { display: flex; gap: 0.35rem; margin-top: 0.2rem; }
  .ins-empty { display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; padding: 0.5rem 0; color: var(--muted); }
  .ins-empty h3 { color: var(--text); }
  @media (max-width: 1250px) {
    .song { grid-template-columns: 200px minmax(0, 1fr); }
    .insight { grid-column: 1 / -1; position: static; max-height: none; }
  }
  @media (max-width: 820px) {
    .song { grid-template-columns: 1fr; }
    .library { position: static; max-height: 14rem; }
    .title { font-size: 1.4rem; }
  }
</style>
