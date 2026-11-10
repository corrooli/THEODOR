// Global app state (Svelte 5 runes), persisted to localStorage.
import type { ChordRef } from '../core/chords';
import type { ScaleRef } from '../core/scales';
import type { Level } from '../core/intervals';
import { DEMO_SONGS, newSong, normalizeSong, songFromText, type Song } from './song';
import { findTuning, type InstrumentId } from './instruments';
import { setMuted } from './audio';

export type View = 'capture' | 'song' | 'explore' | 'solo';
export type Detail = { kind: 'chord'; ref: ChordRef } | { kind: 'scale'; ref: ScaleRef } | null;

export interface Settings {
  level: Level;
  instrument: InstrumentId;
  guitarTuning: string;
  bassTuning: string;
  frets: number;
  showPiano: boolean;
  labels: 'notes' | 'intervals';
  leftHanded: boolean;
  sound: boolean;
  theme: 'dark' | 'light';
}

const SETTINGS_KEY = 'theodor.settings.v1';
const SONGS_KEY = 'theodor.songs.v1';
const CURRENT_KEY = 'theodor.current.v1';

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

const defaultSettings: Settings = {
  level: 'jazz', instrument: 'guitar', guitarTuning: 'Standard E', bassTuning: '4-String Standard',
  frets: 15, showPiano: true, labels: 'notes', leftHanded: false, sound: true,
  theme: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark',
};

function loadSongs(): Song[] {
  try {
    const raw = localStorage.getItem(SONGS_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) return arr.flatMap(s => { try { return [normalizeSong(s)]; } catch { return []; } });
    }
  } catch { /* ignore */ }
  // First visit: a blank jam plus the demo songs to play with
  return [newSong('My first jam'), ...DEMO_SONGS.map(d => songFromText(d.title, d.text, d.tempo))];
}

class AppState {
  view = $state<View>('capture');
  settings = $state<Settings>(load(SETTINGS_KEY, defaultSettings));
  songs = $state<Song[]>(loadSongs());
  currentId = $state<string>('');
  detail = $state<Detail>(null);
  lookupOpen = $state(false);
  settingsOpen = $state(false);
  toast = $state<{ msg: string; id: number } | null>(null);
  /** index into the flattened chord list of the current song */
  selectedChord = $state<string | null>(null);
  /** chord being played back (item id) */
  playingId = $state<string | null>(null);
  /** Identify view input: fret per string (-1 = muted) and piano keys */
  capture = $state<{ frets: number[]; keys: number[] }>({ frets: [], keys: [] });
  /** Scale shown on the Identify neck (from lookup "show on neck") */
  overlayScale = $state<ScaleRef | null>(null);
  /** Chord shown on the Identify neck (from lookup "show on neck") */
  overlayChord = $state<ChordRef | null>(null);

  constructor() {
    let cur = '';
    try { cur = localStorage.getItem(CURRENT_KEY) ?? ''; } catch { /* ignore */ }
    this.currentId = this.songs.some(s => s.id === cur) ? cur : this.songs[0].id;
  }

  get song(): Song {
    return this.songs.find(s => s.id === this.currentId) ?? this.songs[0];
  }

  get tuning(): number[] {
    const s = this.settings;
    return findTuning(s.instrument, s.instrument === 'bass' ? s.bassTuning : s.guitarTuning).notes;
  }
  get tuningName(): string {
    const s = this.settings;
    return findTuning(s.instrument, s.instrument === 'bass' ? s.bassTuning : s.guitarTuning).name;
  }

  notify(msg: string) {
    this.toast = { msg, id: Date.now() };
  }

  touch() {
    this.song.updated = Date.now();
  }

  persist() {
    save(SETTINGS_KEY, this.settings);
    save(SONGS_KEY, this.songs);
    try { localStorage.setItem(CURRENT_KEY, this.currentId); } catch { /* ignore */ }
    setMuted(!this.settings.sound);
  }
}

export const app = new AppState();

// Simple hash router: #/capture, #/song, #/explore, #/solo  (+ ?s=<seed> for shared songs)
const VIEWS: View[] = ['capture', 'song', 'explore', 'solo'];
export function readRoute(): { view: View; seed: string | null } {
  const h = location.hash.replace(/^#\/?/, '');
  const [path, query] = h.split('?');
  const view = (VIEWS as string[]).includes(path) ? (path as View) : 'capture';
  const seed = new URLSearchParams(query ?? '').get('s');
  return { view, seed };
}
export function go(view: View) {
  app.view = view;
  if (readRoute().view !== view || location.hash.includes('?')) history.replaceState(null, '', `#/${view}`);
}
