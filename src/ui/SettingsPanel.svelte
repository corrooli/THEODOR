<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import { app } from '../lib/state.svelte';
  import { LEVELS } from '../core/intervals';
  import { BASS_TUNINGS, GUITAR_TUNINGS, type Tuning } from '../lib/instruments';

  const groups = (list: Tuning[]) => [...new Set(list.map(t => t.group))].map(g => ({ g, items: list.filter(t => t.group === g) }));
  const s = app.settings;
</script>

<Sheet open={app.settingsOpen} onClose={() => (app.settingsOpen = false)} label="Settings" width={440}>
  <div class="wrap">
    <div class="head">
      <h2>Settings</h2>
      <button class="btn icon ghost" onclick={() => (app.settingsOpen = false)} aria-label="Close"><Icon name="x" /></button>
    </div>

    <section>
      <div class="eyebrow">Theory depth</div>
      <div class="levels">
        {#each LEVELS as l}
          <button class="level" class:on={app.settings.level === l.id} onclick={() => (app.settings.level = l.id)} data-level={l.id}>
            <strong>{l.name}</strong>
            <span>{l.blurb}</span>
          </button>
        {/each}
      </div>
      <p class="note">Depth filters which scales, chords and ideas THEODOR suggests. You can always look anything up.</p>
    </section>

    <section>
      <div class="eyebrow">Instrument</div>
      <div class="seg">
        <button class:on={s.instrument === 'guitar'} onclick={() => (app.settings.instrument = 'guitar')}>Guitar</button>
        <button class:on={s.instrument === 'bass'} onclick={() => (app.settings.instrument = 'bass')}>Bass</button>
      </div>
      <label class="row">
        <span>Tuning</span>
        {#if app.settings.instrument === 'guitar'}
          <select class="field" bind:value={app.settings.guitarTuning} data-testid="tuning">
            {#each groups(GUITAR_TUNINGS) as grp}<optgroup label={grp.g}>{#each grp.items as t}<option value={t.name}>{t.name}</option>{/each}</optgroup>{/each}
          </select>
        {:else}
          <select class="field" bind:value={app.settings.bassTuning} data-testid="tuning">
            {#each groups(BASS_TUNINGS) as grp}<optgroup label={grp.g}>{#each grp.items as t}<option value={t.name}>{t.name}</option>{/each}</optgroup>{/each}
          </select>
        {/if}
      </label>
      <label class="row">
        <span>Frets shown</span>
        <select class="field" bind:value={app.settings.frets}>
          {#each [12, 15, 17, 19, 22, 24] as f}<option value={f}>{f}</option>{/each}
        </select>
      </label>
      <label class="row check"><input type="checkbox" bind:checked={app.settings.leftHanded} /> <span>Left-handed fretboard</span></label>
      <label class="row check"><input type="checkbox" bind:checked={app.settings.showPiano} /> <span>Show piano</span></label>
    </section>

    <section>
      <div class="eyebrow">Display</div>
      <div class="row">
        <span>Note labels</span>
        <div class="seg">
          <button class:on={s.labels === 'notes'} onclick={() => (app.settings.labels = 'notes')}>Note names</button>
          <button class:on={s.labels === 'intervals'} onclick={() => (app.settings.labels = 'intervals')}>Intervals</button>
        </div>
      </div>
      <div class="row">
        <span>Theme</span>
        <div class="seg">
          <button class:on={s.theme === 'dark'} onclick={() => (app.settings.theme = 'dark')}>Dark</button>
          <button class:on={s.theme === 'light'} onclick={() => (app.settings.theme = 'light')}>Light</button>
        </div>
      </div>
      <label class="row check"><input type="checkbox" bind:checked={app.settings.sound} /> <span>Sound</span></label>
    </section>

    <section class="about">
      <p><strong>THEODOR</strong> — THEOry + DORian. Think outside the box, mate!</p>
      <p class="muted">Everything stays in your browser. Songs are saved locally; share them as links or JSON files.</p>
    </section>
  </div>
</Sheet>

<style>
  .wrap { padding: 1.25rem 1.5rem 2rem; display: flex; flex-direction: column; gap: 1.6rem; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  section { display: flex; flex-direction: column; gap: 0.7rem; }
  .levels { display: flex; flex-direction: column; gap: 0.5rem; }
  .level {
    text-align: left; display: flex; flex-direction: column; gap: 0.1rem; padding: 0.75rem 1rem; border-radius: 14px; cursor: pointer;
    border: 1px solid var(--border-strong); background: var(--surface-2); transition: border-color 0.15s, background 0.2s;
  }
  .level span { font-size: 0.82rem; color: var(--muted); }
  .level.on { border-color: transparent; background: linear-gradient(var(--surface-2), var(--surface-2)) padding-box, var(--brand-grad) border-box; border: 1.5px solid transparent; }
  .row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; font-size: 0.9rem; }
  .row select { max-width: 230px; }
  .row.check { justify-content: flex-start; cursor: pointer; }
  .note { font-size: 0.8rem; color: var(--muted); }
  .about { gap: 0.3rem; font-size: 0.88rem; }
</style>
