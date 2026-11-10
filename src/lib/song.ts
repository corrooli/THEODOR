// Song model, file format and versioned share links ("seed links").
import { parseChordSymbol, qualityBySym, type ChordRef } from '../core/chords';
import type { Key } from '../core/analysis';

export const SONG_FORMAT_VERSION = 1;

export interface SongChordItem {
  id: string;
  ref: ChordRef;
  beats: number;
}
export interface Section {
  id: string;
  name: string;
  chords: SongChordItem[];
}
export interface Song {
  v: number;
  id: string;
  title: string;
  tempo: number;
  /** null = detect automatically */
  key: Key | null;
  sections: Section[];
  updated: number;
}

export const uid = () => Math.random().toString(36).slice(2, 10);

export function newSong(title = 'Untitled jam'): Song {
  return { v: SONG_FORMAT_VERSION, id: uid(), title, tempo: 96, key: null, sections: [{ id: uid(), name: 'Verse', chords: [] }], updated: Date.now() };
}

export function chordItem(ref: ChordRef, beats = 4): SongChordItem {
  return { id: uid(), ref, beats };
}

/** Build a song from text like "Verse: Dm7 G7 Cmaj7 | Chorus: F G Em Am". */
export function songFromText(title: string, text: string, tempo = 96): Song {
  const s = newSong(title);
  s.tempo = tempo;
  s.sections = text.split('|').map(part => {
    const m = part.match(/^\s*([^:]+):(.*)$/);
    const name = m ? m[1].trim() : 'Section';
    const chords = (m ? m[2] : part).trim().split(/\s+/).filter(Boolean).map(sym => {
      const [chordSym, beatStr] = sym.split('*');
      const ref = parseChordSymbol(chordSym);
      if (!ref) throw new Error(`Bad chord "${chordSym}"`);
      return chordItem(ref, beatStr ? parseInt(beatStr, 10) : 4);
    });
    return { id: uid(), name, chords };
  });
  return s;
}

export const DEMO_SONGS: { title: string; text: string; tempo: number; blurb: string }[] = [
  { title: 'Autumn-ish ii–V Workout', tempo: 120, blurb: 'Circle of fifths, major and minor ii–V–Is.',
    text: 'A: Cm7 F7 Bbmaj7 Ebmaj7 Am7b5 D7 Gm7 Gm7 | B: Am7b5 D7 Gm7 Gm7 Cm7 F7 Bbmaj7 Ebmaj7 | C: Am7b5 D7 Gm7 C7 Fm7 Bb7 Ebmaj7 Ebmaj7 Am7b5 D7 Gm7*8' },
  { title: 'Twelve-Bar Blues in A', tempo: 100, blurb: 'Dominant chords everywhere — break out of the box.',
    text: 'Blues: A7 D7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7' },
  { title: 'Pop Axis Anthem', tempo: 92, blurb: 'The four chords — then try the ideas engine on it.',
    text: 'Verse: C G Am F | Chorus: F G Em Am F G C C' },
  { title: 'Dorian Funk Vamp', tempo: 104, blurb: 'Two chords, one mode. Oye como funk.',
    text: 'Vamp: Am7*8 D7*8' },
];

// ---------- Validation & migration ----------
type Migrator = (raw: any) => any;
/** MIGRATIONS[n] upgrades a version-n song to version n+1. Never delete one. */
const MIGRATIONS: Record<number, Migrator> = {};

export function normalizeSong(raw: any): Song {
  if (!raw || typeof raw !== 'object') throw new Error('Not a song');
  let v = typeof raw.v === 'number' ? raw.v : 1;
  if (v > SONG_FORMAT_VERSION) throw new Error(`This song was made with a newer THEODOR (format v${v}). Please refresh the app.`);
  while (v < SONG_FORMAT_VERSION) { raw = MIGRATIONS[v](raw); v++; }
  const sections: Section[] = (Array.isArray(raw.sections) ? raw.sections : []).map((s: any) => ({
    id: typeof s.id === 'string' ? s.id : uid(),
    name: String(s.name ?? 'Section').slice(0, 40),
    chords: (Array.isArray(s.chords) ? s.chords : []).flatMap((c: any) => {
      const ref = c.ref ?? c;
      const root = Number(ref.root);
      if (!Number.isInteger(root) || root < 0 || root > 11 || !qualityBySym(String(ref.q))) return [];
      const r: ChordRef = { root, q: String(ref.q) };
      if (Number.isInteger(ref.bass) && ref.bass !== root && ref.bass >= 0 && ref.bass < 12) r.bass = ref.bass;
      if (ref.pref === 'flat' || ref.pref === 'sharp') r.pref = ref.pref;
      const beats = Math.min(32, Math.max(1, Math.round(Number(c.beats ?? 4)) || 4));
      return [{ id: typeof c.id === 'string' ? c.id : uid(), ref: r, beats }];
    }),
  }));
  const key = raw.key && Number.isInteger(raw.key.tonic) && (raw.key.mode === 'major' || raw.key.mode === 'minor')
    ? { tonic: ((raw.key.tonic % 12) + 12) % 12, mode: raw.key.mode } : null;
  return {
    v: SONG_FORMAT_VERSION,
    id: typeof raw.id === 'string' ? raw.id : uid(),
    title: String(raw.title ?? 'Untitled jam').slice(0, 80),
    tempo: Math.min(300, Math.max(30, Math.round(Number(raw.tempo)) || 96)),
    key,
    sections: sections.length ? sections : [{ id: uid(), name: 'Verse', chords: [] }],
    updated: Number(raw.updated) || Date.now(),
  };
}

// ---------- Files ----------
export function songToJSON(song: Song): string {
  return JSON.stringify({ format: 'theodor-song', ...song }, null, 2);
}
export function songFromJSON(text: string): Song {
  return normalizeSong(JSON.parse(text));
}

// ---------- Seed links ----------
// Compact array form keeps links short: [v, title, tempo, key|0, [[name, [[root, q, beats, bass?, pref?], ...]], ...]]
function compact(song: Song): unknown[] {
  return [
    SONG_FORMAT_VERSION, song.title, song.tempo, song.key ? [song.key.tonic, song.key.mode === 'major' ? 1 : 0] : 0,
    song.sections.map(s => [s.name, s.chords.map(c => {
      const a: unknown[] = [c.ref.root, c.ref.q, c.beats];
      if (c.ref.bass !== undefined || c.ref.pref) a.push(c.ref.bass ?? -1);
      if (c.ref.pref) a.push(c.ref.pref === 'flat' ? 'b' : '#');
      return a;
    })]),
  ];
}
function expand(a: any[]): Song {
  const [v, title, tempo, key, sections] = a;
  return normalizeSong({
    v, title, tempo,
    key: Array.isArray(key) ? { tonic: key[0], mode: key[1] ? 'major' : 'minor' } : null,
    sections: (sections ?? []).map((s: any[]) => ({
      name: s[0],
      chords: (s[1] ?? []).map((c: any[]) => ({
        beats: c[2],
        ref: { root: c[0], q: c[1], ...(c[3] !== undefined && c[3] >= 0 ? { bass: c[3] } : {}), ...(c[4] ? { pref: c[4] === 'b' ? 'flat' : 'sharp' } : {}) },
      })),
    })),
  });
}

const b64url = (bytes: Uint8Array) => {
  let s = '';
  bytes.forEach(b => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
};
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ReadableWritablePair<Uint8Array, Uint8Array>));
  return new Uint8Array(await out.arrayBuffer());
}

/** Encode a song as "<version>.<base64url(deflate(json))>". */
export async function encodeSeed(song: Song): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compact(song)));
  const packed = await pipe(json, new CompressionStream('deflate-raw'));
  return `${SONG_FORMAT_VERSION}.${b64url(packed)}`;
}

export async function decodeSeed(seed: string): Promise<Song> {
  const m = seed.match(/^(\d+)\.([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('That share link looks broken.');
  const bytes = await pipe(unb64url(m[2]), new DecompressionStream('deflate-raw'));
  const arr = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(arr)) throw new Error('That share link looks broken.');
  return expand(arr);
}
