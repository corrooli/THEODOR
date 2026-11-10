<script lang="ts">
  import { onMount } from 'svelte';
  import Logo from './ui/Logo.svelte';
  import Icon from './ui/Icon.svelte';
  import Lookup from './ui/Lookup.svelte';
  import DetailPanel from './ui/DetailPanel.svelte';
  import SettingsPanel from './ui/SettingsPanel.svelte';
  import Toast from './ui/Toast.svelte';
  import CaptureView from './views/CaptureView.svelte';
  import SongView from './views/SongView.svelte';
  import ExploreView from './views/ExploreView.svelte';
  import SoloView from './views/SoloView.svelte';
  import { app, go, readRoute, type View } from './lib/state.svelte';
  import { decodeSeed } from './lib/song';
  import { LEVELS } from './core/intervals';

  const NAV: { id: View; label: string; icon: string; hint: string }[] = [
    { id: 'capture', label: 'Identify', icon: 'target', hint: 'Play notes, get chords & scales' },
    { id: 'song', label: 'Song', icon: 'layers', hint: 'Build parts, analyse key & harmony' },
    { id: 'explore', label: 'Explore', icon: 'spark', hint: 'Harmony board & new ideas' },
    { id: 'solo', label: 'Solo', icon: 'wave', hint: 'What to play over the changes' },
  ];

  // Persist (debounced) whenever settings or songs change
  let saveTimer: number | undefined;
  $effect(() => {
    JSON.stringify(app.settings);
    JSON.stringify(app.songs);
    void app.currentId;
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => app.persist(), 250);
  });
  $effect(() => {
    document.documentElement.dataset.theme = app.settings.theme;
  });

  async function importSeed(seed: string) {
    try {
      const song = await decodeSeed(seed);
      app.songs.unshift(song);
      app.currentId = song.id;
      go('song');
      app.notify(`Opened shared song “${song.title}”`);
    } catch (e) {
      app.notify((e as Error).message);
      go('song');
    }
  }

  onMount(() => {
    const r = readRoute();
    app.view = r.view;
    if (r.seed) importSeed(r.seed);
    const onHash = () => {
      const rr = readRoute();
      app.view = rr.view;
      if (rr.seed) importSeed(rr.seed);
    };
    const flush = () => app.persist();
    window.addEventListener('hashchange', onHash);
    window.addEventListener('pagehide', flush);
    return () => { window.removeEventListener('hashchange', onHash); window.removeEventListener('pagehide', flush); };
  });

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target as HTMLElement)?.isContentEditable;
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      app.lookupOpen = !app.lookupOpen;
      return;
    }
    if (e.key === 'Escape') {
      if (app.lookupOpen) app.lookupOpen = false;
      else if (app.settingsOpen) app.settingsOpen = false;
      else if (app.detail) app.detail = null;
      else if (app.overlayChord) app.overlayChord = null;
      else if (app.overlayScale) app.overlayScale = null;
      else return;
      e.preventDefault();
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === '/') { e.preventDefault(); app.lookupOpen = true; }
  }

  const levelName = $derived(LEVELS.find(l => l.id === app.settings.level)?.name ?? '');
</script>

<svelte:window onkeydown={onKey} />

<div class="shell">
  <header class="topbar">
    <a class="brand" href="#/capture" onclick={(e) => { e.preventDefault(); go('capture'); }} aria-label="THEODOR home">
      <Logo size={30} />
    </a>

    <nav class="tabs" aria-label="Main">
      {#each NAV as n}
        <button class="tab" class:on={app.view === n.id} onclick={() => go(n.id)} title={n.hint} data-view={n.id}>
          <Icon name={n.icon} size={17} />
          <span>{n.label}</span>
        </button>
      {/each}
    </nav>

    <div class="right">
      <button class="search" onclick={() => (app.lookupOpen = true)} aria-label="Search chords and scales">
        <Icon name="search" size={16} />
        <span class="search-label">Chord, scale, notes…</span>
        <kbd>⌘K</kbd>
      </button>
      <button class="btn ghost sm level" onclick={() => (app.settingsOpen = true)} title="Theory depth — change in settings">
        {levelName}
      </button>
      <button class="btn icon ghost" onclick={() => (app.settings.theme = app.settings.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme">
        <Icon name={app.settings.theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>
      <button class="btn icon ghost" onclick={() => (app.settingsOpen = true)} aria-label="Settings" data-testid="settings-btn">
        <Icon name="sliders" size={18} />
      </button>
    </div>
  </header>

  <main class="main">
    {#key app.view}
      <div class="view rise">
        {#if app.view === 'capture'}<CaptureView />
        {:else if app.view === 'song'}<SongView />
        {:else if app.view === 'explore'}<ExploreView />
        {:else}<SoloView />{/if}
      </div>
    {/key}
  </main>

  <footer class="foot">
    <Logo size={18} />
    <span class="tag">Think outside the box, mate!</span>
    <span class="sp"></span>
    <a href="https://github.com/corrooli/THEODOR" target="_blank" rel="noopener">Source (AGPL-3.0)</a>
    <a href="https://ko-fi.com/olivercorrodi" target="_blank" rel="noopener">☕ Buy me a coffee</a>
  </footer>

  <nav class="bottom-tabs" aria-label="Main (mobile)">
    {#each NAV as n}
      <button class:on={app.view === n.id} onclick={() => go(n.id)} data-view={n.id}>
        <Icon name={n.icon} size={20} />
        <span>{n.label}</span>
      </button>
    {/each}
    <button onclick={() => (app.lookupOpen = true)}><Icon name="search" size={20} /><span>Search</span></button>
  </nav>
</div>

<Lookup />
<DetailPanel />
<SettingsPanel />
<Toast />

<style>
  .shell { min-height: 100vh; display: flex; flex-direction: column; }
  .topbar {
    position: sticky; top: 0; z-index: 50; display: flex; align-items: center; gap: 1rem;
    padding: 0.7rem clamp(1rem, 3vw, 2rem);
    background: color-mix(in srgb, var(--bg) 72%, transparent);
    backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
    border-bottom: 1px solid var(--border);
  }
  .brand { text-decoration: none; display: flex; }
  .tabs { display: flex; gap: 0.25rem; margin-left: 1rem; padding: 4px; border-radius: 999px; background: var(--surface); border: 1px solid var(--border); }
  .tab {
    display: inline-flex; align-items: center; gap: 0.45rem; border: 0; background: transparent; cursor: pointer;
    padding: 0.45rem 0.95rem; border-radius: 999px; font-weight: 600; font-size: 0.88rem; color: var(--text-2);
    transition: background 0.25s var(--ease), color 0.2s;
  }
  .tab:hover { color: var(--text); }
  .tab.on { background: var(--surface-3); color: var(--text); box-shadow: 0 0 0 1px var(--border-strong) inset; }
  .tab.on :global(svg) { color: var(--brand-2); }
  .right { margin-left: auto; display: flex; align-items: center; gap: 0.35rem; }
  .search {
    display: inline-flex; align-items: center; gap: 0.55rem; height: 38px; padding: 0 0.6rem 0 0.85rem; min-width: 250px;
    border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface); color: var(--muted); cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.2s;
  }
  .search:hover { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 15%, transparent); }
  .search-label { flex: 1; text-align: left; font-size: 0.88rem; }
  .level { color: var(--accent); }
  .main { flex: 1; width: 100%; max-width: 1360px; margin: 0 auto; padding: clamp(1rem, 3vw, 2rem); }
  .foot {
    display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; padding: 1.25rem clamp(1rem, 3vw, 2rem) 1.5rem;
    border-top: 1px solid var(--border); color: var(--muted); font-size: 0.85rem; max-width: 1360px; width: 100%; margin: 0 auto;
  }
  .foot .tag { font-style: italic; }
  .foot .sp { flex: 1; }
  .foot a { color: var(--text-2); text-decoration: none; }
  .foot a:hover { color: var(--accent); }
  .bottom-tabs { display: none; }

  @media (max-width: 1100px) { .search { min-width: 0; } .search-label, .search kbd, .level { display: none; } }
  @media (max-width: 820px) {
    .tabs, .search { display: none; }
    .main { padding-bottom: 6rem; }
    .foot { padding-bottom: 6rem; }
    .bottom-tabs {
      display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 60; justify-content: space-around;
      padding: 0.4rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--surface) 88%, transparent); backdrop-filter: blur(18px); border-top: 1px solid var(--border);
    }
    .bottom-tabs button {
      flex: 1; display: flex; flex-direction: column; align-items: center; gap: 2px; border: 0; background: transparent;
      color: var(--muted); font-size: 0.68rem; font-weight: 600; padding: 0.35rem 0; cursor: pointer; border-radius: 12px;
    }
    .bottom-tabs button.on { color: var(--text); background: var(--surface-3); }
    .bottom-tabs button.on :global(svg) { color: var(--brand-2); }
  }
</style>
