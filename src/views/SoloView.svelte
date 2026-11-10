<script lang="ts">
  import { onDestroy } from 'svelte';
  import Fretboard from '../ui/Fretboard.svelte';
  import Piano from '../ui/Piano.svelte';
  import Icon from '../ui/Icon.svelte';
  import Sym from '../ui/Sym.svelte';
  import { app, go } from '../lib/state.svelte';
  import { transport } from '../lib/transport.svelte';
  import { infoOf } from '../core/chords';
  import { detectKey, keyName, type Key } from '../core/analysis';
  import { scalesForChord, guideTones, type ScaleChoice } from '../core/chordScales';
  import { scaleInfoOf } from '../core/scales';
  import { pretty } from '../core/notes';
  import { playScaleInfo, scaleFretMarks, scaleKeyMarks } from '../lib/helpers';

  const song = $derived(app.song);
  const items = $derived(song.sections.flatMap(s => s.chords));
  const seq = $derived(items.map(c => ({ ref: c.ref, beats: c.beats })));
  const key = $derived<Key>(song.key ?? (seq.length ? detectKey(seq)[0].key : { tonic: 0, mode: 'major' }));

  let picked = $state(0);
  const current = $derived(transport.playing && transport.index >= 0 ? transport.index : Math.min(picked, Math.max(0, items.length - 1)));

  const options = $derived(items.map((c, i) => scalesForChord(c.ref, key, items[(i + 1) % items.length]?.ref, app.settings.level)));
  // chosen scale per chord item id (index into its options)
  let choice = $state<Record<string, number>>({});
  const chosen = (i: number): ScaleChoice | undefined => options[i]?.[Math.min(choice[items[i]?.id] ?? 0, (options[i]?.length ?? 1) - 1)];

  const item = $derived(items[current]);
  const chord = $derived(item ? infoOf(item.ref) : null);
  const scaleChoice = $derived(item ? chosen(current) : undefined);
  const scale = $derived(scaleChoice ? scaleInfoOf(scaleChoice.ref) : null);
  const guides = $derived(item ? new Set(guideTones(item.ref)) : new Set<number>());
  const nextItem = $derived(items.length > 1 ? items[(current + 1) % items.length] : null);
  const nextChord = $derived(nextItem ? infoOf(nextItem.ref) : null);
  const nextGuides = $derived(nextItem ? guideTones(nextItem.ref) : []);

  let lock = $state(false);
  let lockFrom = $state(5);
  const windowRange = $derived<[number, number] | null>(lock ? [lockFrom, lockFrom + 4] : null);

  const fretMarks = $derived(scale ? scaleFretMarks(scale, chord, guides, windowRange) : new Map());
  const keyMarks = $derived(scale ? scaleKeyMarks(scale, chord, 48, 84) : new Map());

  function togglePlay() {
    if (transport.playing) transport.stop();
    else transport.start(items, song.tempo, 0);
  }
  function breakTheBox() {
    const next: Record<string, number> = {};
    items.forEach((c, i) => {
      const idx = options[i].findIndex(o => o.outsideTheBox && !o.inKey);
      const alt = idx >= 0 ? idx : options[i].findIndex(o => o.outsideTheBox);
      next[c.id] = alt >= 0 ? alt : 0;
    });
    choice = next;
    app.notify('Every chord now gets its own colour. Outside the box!');
  }
  function safe() {
    const next: Record<string, number> = {};
    items.forEach((c, i) => {
      const idx = options[i].findIndex(o => !o.outsideTheBox);
      next[c.id] = idx >= 0 ? idx : 0;
    });
    choice = next;
  }

  onDestroy(() => transport.stop());
</script>

<div class="solo">
  <section class="card head">
    <div>
      <div class="eyebrow">Solo · what to play over the changes</div>
      <h1>{song.title} <span class="muted key">in {keyName(key)}</span></h1>
      <p class="muted">Loop the song and see the right notes for each chord. Big coloured dots are chord tones, rings are guide tones (3rds & 7ths) — land on them.</p>
    </div>
    <div class="transport">
      <button class="btn" class:primary={!transport.playing} onclick={togglePlay} disabled={!items.length} data-testid="solo-play">
        <Icon name={transport.playing ? 'stop' : 'loop'} size={15} /> {transport.playing ? 'Stop' : 'Loop it'}
      </button>
      <label class="bpm"><input type="number" min="40" max="260" bind:value={song.tempo} aria-label="Tempo" /> bpm</label>
      <div class="seg">
        {#each [['strum', 'Strum'], ['comp', 'Jazz'], ['pad', 'Pad']] as [f, l]}
          <button class:on={transport.feel === f} onclick={() => (transport.feel = f as typeof transport.feel)}>{l}</button>
        {/each}
      </div>
    </div>
  </section>

  {#if !items.length}
    <section class="card empty">
      <h3>No chords to solo over yet</h3>
      <p class="muted">Add a progression in the Song view, or pick a demo song there.</p>
      <button class="btn primary sm" onclick={() => go('song')}>Go to Song</button>
    </section>
  {:else}
    <section class="card timeline scroll-x">
      {#each items as c, i (c.id)}
        {@const ch = chosen(i)}
        <button class="tl" class:cur={i === current} style="flex-grow: {c.beats}" onclick={() => { picked = i; if (transport.playing) transport.start(items, song.tempo, i); }}>
          <span class="tl-sym"><Sym symbol={infoOf(c.ref).symbol} /></span>
          <span class="tl-scale" class:outside={ch?.outsideTheBox}>{ch ? pretty(ch.name) : '—'}</span>
          {#if i === current && transport.playing}<span class="beat" style="width: {((transport.beat + 1) / c.beats) * 100}%"></span>{/if}
        </button>
      {/each}
    </section>

    <div class="cols">
      <section class="card neck">
        <div class="neck-head">
          <div class="now">
            {#if chord}<span class="eyebrow">Now</span><h2><Sym symbol={chord.symbol} /></h2>{/if}
            {#if scale}<span class="arrow">→</span><h3>{pretty(scale.name)}</h3>
              <button class="btn icon sm ghost" onclick={() => scale && playScaleInfo(scale)} aria-label="Play scale"><Icon name="play" size={13} /></button>{/if}
          </div>
          {#if nextChord}
            <div class="next">
              <span class="eyebrow">Next</span> <Sym symbol={nextChord.symbol} />
              <span class="muted">· aim for {nextGuides.map(pc => pretty(nextChord.tones.find(t => t.pc === pc)?.note ?? '')).join(' & ')}</span>
            </div>
          {/if}
        </div>
        <div class="board scroll-x">
          <Fretboard tuning={app.tuning} frets={app.settings.frets} marks={fretMarks} leftHanded={app.settings.leftHanded} window={windowRange} />
        </div>
        <div class="neck-tools">
          <label class="check"><input type="checkbox" bind:checked={lock} /> Position lock</label>
          {#if lock}
            <input type="range" min="0" max={app.settings.frets - 4} bind:value={lockFrom} aria-label="Position" />
            <span class="muted small">frets {lockFrom}–{lockFrom + 4}</span>
          {/if}
          <span class="sp"></span>
          <span class="legend"><i class="dot ct"></i> chord tone <i class="dot gt"></i> guide tone <i class="dot sc"></i> scale note</span>
        </div>
        {#if app.settings.showPiano}
          <div class="keys scroll-x"><Piano lo={48} hi={84} marks={keyMarks} /></div>
        {/if}
      </section>

      <aside class="card choices">
        <div class="ch-head">
          <div class="eyebrow">Scales for <Sym symbol={chord?.symbol ?? ''} /></div>
        </div>
        <div class="presets">
          <button class="btn sm" onclick={safe}>Play it safe</button>
          <button class="btn sm primary" onclick={breakTheBox} data-testid="break-box"><Icon name="spark" size={13} /> Break the box</button>
        </div>
        <ul>
          {#each options[current] ?? [] as o, oi}
            {@const on = (choice[item.id] ?? 0) === oi}
            <li>
              <button class="opt" class:on onclick={() => (choice[item.id] = oi)}>
                <span class="opt-title">{pretty(o.name)}
                  {#if o.inKey}<span class="badge" style="--c: var(--hf-T)">in key</span>{/if}
                  {#if o.outsideTheBox}<span class="badge" style="--c: var(--brand-2)">outside the box</span>{/if}
                </span>
                <span class="opt-why">{o.why}</span>
              </button>
            </li>
          {/each}
        </ul>
      </aside>
    </div>
  {/if}
</div>

<style>
  .solo { display: flex; flex-direction: column; gap: 1.2rem; }
  .head { padding: 1.3rem 1.5rem; display: flex; justify-content: space-between; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
  h1 { font-size: clamp(1.4rem, 3vw, 2rem); margin: 0.2rem 0 0.3rem; }
  h1 .key { font-size: 0.6em; font-weight: 500; }
  .transport { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
  .bpm { display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.8rem; color: var(--muted); }
  .bpm input { width: 3.6rem; height: 32px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface-2); color: var(--text); text-align: center; font: inherit; }
  .empty { padding: 1.4rem; display: flex; flex-direction: column; gap: 0.6rem; align-items: flex-start; }
  .timeline { display: flex; gap: 0.35rem; padding: 0.6rem; }
  .tl { position: relative; flex-basis: 6rem; min-width: 6rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.05rem; padding: 0.45rem 0.7rem; border-radius: 12px; border: 1px solid var(--border); background: var(--surface-2); cursor: pointer; overflow: hidden; text-align: left; transition: border-color 0.15s, background 0.2s; }
  .tl.cur { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, var(--surface-2)); }
  .tl-sym { font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; }
  .tl-scale { font-size: 0.68rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
  .tl-scale.outside { color: var(--brand-2); }
  .beat { position: absolute; left: 0; bottom: 0; height: 3px; background: var(--accent); transition: width 0.1s linear; }
  .cols { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 1.2rem; align-items: start; }
  .neck { padding: 1rem 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
  .neck-head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap; }
  .now { display: flex; align-items: baseline; gap: 0.6rem; flex-wrap: wrap; }
  .now h2 { font-size: 2rem; }
  .now h3 { font-size: 1.15rem; }
  .arrow { color: var(--muted); }
  .next { font-size: 0.88rem; font-family: var(--font-display); font-weight: 700; }
  .next .muted { font-family: var(--font-ui); font-weight: 500; }
  .neck-tools { display: flex; align-items: center; gap: 0.7rem; flex-wrap: wrap; font-size: 0.85rem; }
  .check { display: inline-flex; gap: 0.4rem; align-items: center; cursor: pointer; }
  .small { font-size: 0.78rem; }
  .sp { flex: 1; }
  .legend { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: var(--muted); }
  .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-left: 0.4rem; }
  .dot.ct { background: var(--fn-root); }
  .dot.gt { background: var(--fn-third); box-shadow: 0 0 0 2px var(--surface), 0 0 0 3.5px var(--text); }
  .dot.sc { background: var(--surface-3); border: 1px solid var(--border-strong); }
  .keys { display: flex; justify-content: center; }
  .choices { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.7rem; position: sticky; top: 5rem; }
  .presets { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .choices ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
  .opt { width: 100%; text-align: left; border: 1px solid var(--border); background: var(--surface-2); border-radius: 12px; padding: 0.6rem 0.8rem; cursor: pointer; display: flex; flex-direction: column; gap: 0.15rem; transition: border-color 0.15s; }
  .opt:hover { border-color: var(--border-strong); }
  .opt.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--surface-2)); }
  .opt-title { font-weight: 700; display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
  .opt-why { font-size: 0.78rem; color: var(--muted); }
  @media (max-width: 1000px) { .cols { grid-template-columns: 1fr; } .choices { position: static; } }
</style>
