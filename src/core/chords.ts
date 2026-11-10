// Chord dictionary, identification (notes -> chord names) and spelling.
import { DEG, fnOf, parseFormula, type Fn, type Level, type Tone } from './intervals';
import { FLAT, ROOT_MAJ, ROOT_MIN, SHARP, mod12, pcOf, spell, asciiAcc, type SpellPref } from './notes';

export type Family = 'Triads' | '6ths & Adds' | '7ths' | 'Extended' | 'Altered';

// [symbol suffix, name, formula (parenthesised tones are optional), family]
const QUALITY_DEFS: [string, string, string, Family][] = [
  ['', 'Major', '1 3 5', 'Triads'],
  ['m', 'Minor', '1 b3 5', 'Triads'],
  ['dim', 'Diminished', '1 b3 b5', 'Triads'],
  ['aug', 'Augmented', '1 3 #5', 'Triads'],
  ['sus2', 'Suspended 2nd', '1 2 5', 'Triads'],
  ['sus4', 'Suspended 4th', '1 4 5', 'Triads'],
  ['5', 'Power Chord', '1 5', 'Triads'],
  ['(b5)', 'Major Flat 5', '1 3 b5', 'Triads'],

  ['6', 'Major 6th', '1 3 (5) 6', '6ths & Adds'],
  ['m6', 'Minor 6th', '1 b3 (5) 6', '6ths & Adds'],
  ['6/9', 'Six Nine', '1 3 (5) 6 9', '6ths & Adds'],
  ['m6/9', 'Minor Six Nine', '1 b3 (5) 6 9', '6ths & Adds'],
  ['add9', 'Add 9', '1 3 (5) 9', '6ths & Adds'],
  ['m(add9)', 'Minor Add 9', '1 b3 (5) 9', '6ths & Adds'],
  ['add11', 'Add 11', '1 3 (5) 11', '6ths & Adds'],
  ['m(add11)', 'Minor Add 11', '1 b3 (5) 11', '6ths & Adds'],
  ['add#11', 'Add Sharp 11', '1 3 5 #11', '6ths & Adds'],
  ['sus4(add9)', 'Sus 4 Add 9', '1 4 5 9', '6ths & Adds'],

  ['maj7', 'Major 7th', '1 3 (5) 7', '7ths'],
  ['7', 'Dominant 7th', '1 3 (5) b7', '7ths'],
  ['m7', 'Minor 7th', '1 b3 (5) b7', '7ths'],
  ['m(maj7)', 'Minor Major 7th', '1 b3 (5) 7', '7ths'],
  ['m7b5', 'Half-Diminished 7th', '1 b3 b5 b7', '7ths'],
  ['dim7', 'Diminished 7th', '1 b3 b5 bb7', '7ths'],
  ['7sus4', 'Dominant 7th Sus 4', '1 4 (5) b7', '7ths'],
  ['7sus2', 'Dominant 7th Sus 2', '1 2 5 b7', '7ths'],
  ['maj7sus2', 'Major 7th Sus 2', '1 2 5 7', '7ths'],
  ['7#5', 'Augmented 7th', '1 3 #5 b7', '7ths'],
  ['maj7#5', 'Augmented Major 7th', '1 3 #5 7', '7ths'],
  ['7b5', 'Dominant 7th Flat 5', '1 3 b5 b7', '7ths'],
  ['dim(maj7)', 'Diminished Major 7th', '1 b3 b5 7', '7ths'],

  ['maj9', 'Major 9th', '1 3 (5) 7 9', 'Extended'],
  ['9', 'Dominant 9th', '1 3 (5) b7 9', 'Extended'],
  ['m9', 'Minor 9th', '1 b3 (5) b7 9', 'Extended'],
  ['m(maj9)', 'Minor Major 9th', '1 b3 (5) 7 9', 'Extended'],
  ['9sus4', 'Dominant 9th Sus 4', '1 4 (5) b7 9', 'Extended'],
  ['m9b5', 'Half-Diminished 9th', '1 b3 b5 b7 9', 'Extended'],
  ['maj11', 'Major 11th', '1 3 (5) 7 (9) 11', 'Extended'],
  ['11', 'Dominant 11th', '1 (3) (5) b7 9 11', 'Extended'],
  ['m11', 'Minor 11th', '1 b3 (5) b7 (9) 11', 'Extended'],
  ['maj13', 'Major 13th', '1 3 (5) 7 (9) 13', 'Extended'],
  ['13', 'Dominant 13th', '1 3 (5) b7 (9) 13', 'Extended'],
  ['m13', 'Minor 13th', '1 b3 (5) b7 (9) (11) 13', 'Extended'],
  ['13sus4', 'Dominant 13th Sus 4', '1 4 (5) b7 (9) 13', 'Extended'],

  ['7b9', 'Dominant 7th Flat 9', '1 3 (5) b7 b9', 'Altered'],
  ['7#9', 'Dominant 7th Sharp 9 ("Hendrix")', '1 3 (5) b7 #9', 'Altered'],
  ['7#11', 'Dominant 7th Sharp 11', '1 3 (5) b7 #11', 'Altered'],
  ['7b13', 'Dominant 7th Flat 13', '1 3 (5) b7 b13', 'Altered'],
  ['7b9b13', 'Dominant 7th Flat 9 Flat 13', '1 3 (5) b7 b9 b13', 'Altered'],
  ['7#5#9', 'Altered Dominant (#5 #9)', '1 3 #5 b7 #9', 'Altered'],
  ['7#5b9', 'Altered Dominant (#5 b9)', '1 3 #5 b7 b9', 'Altered'],
  ['7b5b9', 'Altered Dominant (b5 b9)', '1 3 b5 b7 b9', 'Altered'],
  ['7b5#9', 'Altered Dominant (b5 #9)', '1 3 b5 b7 #9', 'Altered'],
  ['7sus4b9', 'Sus 4 Flat 9 (Phrygian)', '1 4 (5) b7 b9', 'Altered'],
  ['9#11', 'Dominant 9th Sharp 11', '1 3 (5) b7 9 #11', 'Altered'],
  ['maj7#11', 'Lydian Major 7th', '1 3 (5) 7 #11', 'Altered'],
  ['maj9#11', 'Major 9th Sharp 11', '1 3 (5) 7 9 #11', 'Altered'],
  ['13b9', 'Dominant 13th Flat 9', '1 3 (5) b7 b9 13', 'Altered'],
  ['13#11', 'Dominant 13th Sharp 11', '1 3 (5) b7 (9) #11 13', 'Altered'],
];

const BASIC_CHORDS = new Set(['', 'm', 'dim', 'aug', 'sus2', 'sus4', '5', '6', 'm6', 'add9', 'm(add9)', 'maj7', '7', 'm7', '7sus4']);
const FUSION_CHORDS = new Set(['(b5)', 'add#11', 'maj7sus2', 'maj7#5', '7b5', 'dim(maj7)', 'm(maj9)', 'm9b5', 'maj11',
  '7b9b13', '7#5#9', '7#5b9', '7b5b9', '7b5#9', '7sus4b9', '9#11', 'maj9#11', '13b9', '13#11', '7b13']);

export interface ChordQuality {
  i: number;
  level: Level;
  sym: string;
  name: string;
  fam: Family;
  tones: Tone[];
  minorish: boolean;
  /** dominant function: has a major 3rd and minor 7th */
  dominant: boolean;
  norm: string;
}

export const normSym = (s: string) => asciiAcc(s.replace(/[()\s,]/g, ''));

export const Q: ChordQuality[] = QUALITY_DEFS.map(([sym, name, formula, fam], i) => {
  const tones = parseFormula(formula);
  const labels = new Set(tones.map(t => t.label));
  return {
    i, sym, name, fam, tones,
    level: BASIC_CHORDS.has(sym) ? 'basic' : FUSION_CHORDS.has(sym) ? 'fusion' : 'jazz',
    minorish: labels.has('b3') && !labels.has('3'),
    dominant: labels.has('b7') && (labels.has('3') || labels.has('4')),
    norm: normSym(sym),
  };
});
export const FAMILIES: Family[] = [...new Set(Q.map(q => q.fam))];
const BY_SYM = new Map(Q.map(q => [q.sym, q]));

export function qualityBySym(sym: string): ChordQuality | undefined {
  return BY_SYM.get(sym);
}
export function qi(sym: string): number {
  const q = BY_SYM.get(sym);
  if (!q) throw new Error(`Unknown chord quality "${sym}"`);
  return q.i;
}

/** Serializable reference to a chord. Quality stored by symbol so saved songs survive dictionary changes. */
export interface ChordRef {
  root: number;
  q: string;
  bass?: number;
  pref?: SpellPref;
}

export interface SpelledTone extends Tone {
  pc: number;
  note: string;
  fn: Fn;
}

export interface ChordInfo {
  root: number;
  qi: number;
  bass: number;
  q: ChordQuality;
  rootName: string;
  tones: SpelledTone[];
  bassName: string;
  symbol: string;
  inv: string;
  pref: SpellPref;
  fullName: string;
  foreignBass: boolean;
  pcs: Set<number>;
  ref: ChordRef;
}

function inversionName(label: string): string {
  if (['3', 'b3', '2', '4'].includes(label)) return '1st inversion';
  if (['5', 'b5', '#5'].includes(label)) return '2nd inversion';
  if (['7', 'b7', 'bb7', '6'].includes(label)) return '3rd inversion';
  return label + ' in bass';
}

/** pref forces the spelling of black-key roots. */
export function chordInfo(root: number, qIndex: number, bass?: number, pref?: SpellPref): ChordInfo {
  const q = Q[qIndex];
  root = mod12(root);
  const b = bass == null ? root : mod12(bass);
  const spellings = pref === 'flat' ? FLAT : pref === 'sharp' ? SHARP : (q.minorish ? ROOT_MIN : ROOT_MAJ);
  const rootName = spellings[root];
  const tones: SpelledTone[] = q.tones.map(t => ({ ...t, pc: mod12(root + t.semi), note: spell(rootName, t.semi, t.deg), fn: fnOf(t.label) }));
  const bassTone = tones.find(t => t.pc === b);
  let bassName = bassTone ? bassTone.note : spellings[b];
  // Double accidentals are correct inside the chord but unreadable as a slash bass
  if (/##|bb/.test(bassName) || ['Fb', 'Cb', 'E#', 'B#'].includes(bassName)) bassName = (/b/.test(rootName) ? FLAT : SHARP)[b];
  const symbol = rootName + q.sym + (b !== root ? '/' + bassName : '');
  let inv = '';
  if (b !== root) inv = bassTone ? inversionName(bassTone.label) : 'over ' + bassName + ' bass';
  return {
    root, qi: qIndex, bass: b, q, rootName, tones, bassName, symbol, inv, pref,
    fullName: rootName + ' ' + q.name,
    foreignBass: !bassTone,
    pcs: new Set([...tones.map(t => t.pc), b]),
    ref: { root, q: q.sym, ...(b !== root ? { bass: b } : {}), ...(pref ? { pref } : {}) },
  };
}

export function infoOf(ref: ChordRef): ChordInfo {
  return chordInfo(ref.root, qi(ref.q), ref.bass, ref.pref);
}

export const refKey = (r: ChordRef) => `${r.root}:${r.q}:${r.bass ?? r.root}`;

export type MatchType = 'exact' | 'slash' | 'partial';
export interface ChordMatch {
  root: number;
  qi: number;
  bass: number;
  type: MatchType;
  missReq: string[];
  missOpt: string[];
  score: number;
}

/**
 * Identify chords from pitch classes + bass pitch class. Sorted best first.
 *   exact   - every played note is a chord tone, every required tone present
 *   slash   - upper notes form an exact chord over a non-chord-tone bass (C/D)
 *   partial - played notes are a subset of the chord
 */
export function identify(pcs: Set<number>, bass: number): ChordMatch[] {
  const out: ChordMatch[] = [];
  const n = pcs.size;
  if (!n) return out;
  for (let root = 0; root < 12; root++) {
    for (const q of Q) {
      const chordPcs = new Set(q.tones.map(t => mod12(root + t.semi)));
      let foreignBass = false;
      let extras = 0;
      for (const p of pcs) if (!chordPcs.has(p)) extras++;
      if (extras) {
        if (extras === 1 && !chordPcs.has(bass) && n >= 3) foreignBass = true;
        else continue;
      }
      const missReq: string[] = [], missOpt: string[] = [];
      for (const t of q.tones) {
        const pc = mod12(root + t.semi);
        const present = pcs.has(pc) && !(foreignBass && pc === bass);
        if (!present) (t.opt ? missOpt : missReq).push(t.label);
      }
      if (foreignBass && missReq.length) continue;
      const type: MatchType = foreignBass ? 'slash' : missReq.length ? 'partial' : 'exact';
      let score = 100 - 30 * missReq.length - 3 * missOpt.length - 2 * q.tones.length;
      if (missReq.includes('1')) score -= 15;
      if (bass === root) score += 20;
      else if (foreignBass) score -= 15;
      else score += 4;
      if (q.fam === 'Triads' || q.fam === '7ths') score += 1;
      out.push({ root, qi: q.i, bass, type, missReq, missOpt, score });
    }
  }
  out.sort((a, b) => b.score - a.score || a.qi - b.qi || a.root - b.root);
  return out;
}

/** Convenience: identify from MIDI notes. */
export function identifyMidi(midis: number[]): ChordMatch[] {
  if (!midis.length) return [];
  return identify(new Set(midis.map(mod12)), mod12(Math.min(...midis)));
}

// ---------- Parsing ----------
const SUFFIX_ALIASES: Record<string, string> = {
  'M': '', 'maj': '', 'major': '', 'Maj': '',
  'min': 'm', 'mi': 'm', 'minor': 'm', '-': 'm',
  '+': 'aug', '°': 'dim', 'o': 'dim',
  'ø': 'm7b5', 'ø7': 'm7b5', 'm7-5': 'm7b5', '-7b5': 'm7b5', 'min7b5': 'm7b5', 'halfdim': 'm7b5',
  '°7': 'dim7', 'o7': 'dim7',
  'Δ': 'maj7', 'Δ7': 'maj7', 'M7': 'maj7', 'ma7': 'maj7', 'Maj7': 'maj7', 'j7': 'maj7',
  'Δ9': 'maj9', 'M9': 'maj9', 'Maj9': 'maj9', 'M11': 'maj11', 'M13': 'maj13', 'Maj13': 'maj13',
  'sus': 'sus4', 'add2': 'add9', '2': 'add9', '69': '6/9', '6add9': '6/9', 'm69': 'm6/9', '-69': 'm6/9',
  '-7': 'm7', 'min7': 'm7', 'mi7': 'm7', '-6': 'm6', '-9': 'm9', '-11': 'm11', '-13': 'm13',
  'mM7': 'm(maj7)', '-maj7': 'm(maj7)', 'minmaj7': 'm(maj7)', 'mΔ': 'm(maj7)', '-Δ': 'm(maj7)', 'mΔ7': 'm(maj7)', 'mM9': 'm(maj9)',
  '+7': '7#5', 'aug7': '7#5', '7+5': '7#5', '7aug': '7#5', '7+': '7#5',
  '7-5': '7b5', '7+9': '7#9', '7-9': '7b9', 'dom7': '7', 'dom': '7',
  'madd4': 'm(add11)', 'add4': 'add11', 'no3': '5', 'sus24': 'sus4(add9)', 'sus2sus4': 'sus4(add9)', 'sus2(add4)': 'sus4(add9)',
  'maj7+5': 'maj7#5', '+maj7': 'maj7#5', 'augmaj7': 'maj7#5', 'Δ#5': 'maj7#5', 'Δ#11': 'maj7#11',
  'alt': '7#5#9', '7alt': '7#5#9', 'b5': '(b5)', '-5': '(b5)', 'dimmaj7': 'dim(maj7)', 'madd9': 'm(add9)', 'madd11': 'm(add11)',
};

function normalizeSuffix(raw: string): string {
  const s = raw.replace(/\s/g, '');
  if (s in SUFFIX_ALIASES) return normSym(SUFFIX_ALIASES[s]);
  const stripped = normSym(s);
  if (stripped in SUFFIX_ALIASES) return normSym(SUFFIX_ALIASES[stripped]);
  return stripped
    .replace(/^min(?=\d)/, 'm').replace(/^-(?=\d)/, 'm')
    .replace(/^Δ/, 'maj').replace(/^M(?=\d)/, 'maj').replace(/^Maj/, 'maj');
}

export function parseChordSymbol(str: string): ChordRef | null {
  const s = asciiAcc(str.trim());
  const m = s.match(/^([A-Ga-g])([#b]?)(.*?)(?:\/([A-Ga-g])([#b]?))?$/);
  if (!m) return null;
  const root = pcOf(m[1], m[2]);
  const norm = normalizeSuffix(m[3]);
  const q = Q.find(q => q.norm === norm);
  if (!q) return null;
  const ref: ChordRef = { root, q: q.sym };
  if (m[4]) {
    const bass = pcOf(m[4], m[5]);
    if (bass !== root) ref.bass = bass;
  }
  if (m[2] === 'b') ref.pref = 'flat';
  else if (m[2] === '#') ref.pref = 'sharp';
  return ref;
}

export { DEG };
