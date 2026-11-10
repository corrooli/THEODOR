// Song analysis: key detection, Roman numerals, harmonic function, chord roles and named patterns.
import { Q, infoOf, qi, type ChordInfo, type ChordRef } from './chords';
import type { Level } from './intervals';
import { ROOT_MAJ, ROOT_MIN, mod12 } from './notes';
import { SCALES, scaleInfo, si } from './scales';

export type Mode = 'major' | 'minor';
export interface Key {
  tonic: number;
  mode: Mode;
}

export const keyName = (k: Key) => (k.mode === 'major' ? ROOT_MAJ : ROOT_MIN)[k.tonic] + (k.mode === 'major' ? ' major' : ' minor');
export const keyEq = (a: Key, b: Key) => a.tonic === b.tonic && a.mode === b.mode;

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10];
const HARM_EXTRA = [11]; // leading tone in minor (harmonic minor V and vii°)
const MEL_EXTRA = [9];   // raised 6th (melodic / Dorian flavour) - tolerated, lightly

export function keyPcs(k: Key, includeMinorVariants = true): Set<number> {
  const base = k.mode === 'major' ? MAJOR : includeMinorVariants ? [...NAT_MINOR, ...HARM_EXTRA] : NAT_MINOR;
  return new Set(base.map(x => mod12(k.tonic + x)));
}

/** Pitch classes that define the chord (required tones + bass), ignoring optional tones. */
function corePcs(ci: ChordInfo): number[] {
  const out = ci.tones.filter(t => !t.opt).map(t => t.pc);
  if (!out.includes(ci.bass)) out.push(ci.bass);
  return out;
}

export interface SongChord {
  ref: ChordRef;
  beats: number;
}

export interface KeyCandidate {
  key: Key;
  score: number;
  confidence: number;
}

/** Rank all 24 major/minor keys for a chord sequence. */
export function detectKey(chords: SongChord[]): KeyCandidate[] {
  if (!chords.length) return [];
  const infos = chords.map(c => infoOf(c.ref));
  const cands: KeyCandidate[] = [];
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const mode of ['major', 'minor'] as Mode[]) {
      const key = { tonic, mode };
      const pcs = keyPcs(key);
      const natural = keyPcs(key, false);
      const melodic = new Set([...pcs, ...MEL_EXTRA.map(x => mod12(tonic + x))]);
      let score = 0;
      infos.forEach((ci, i) => {
        const w = Math.min(chords[i].beats || 4, 8);
        const core = corePcs(ci);
        const inside = core.filter(p => pcs.has(p)).length / core.length;
        let fit = inside === 1 ? 1 : inside - 0.6;
        // In minor, chords that need the raised 7th count a bit less than natural ones
        if (mode === 'minor' && inside === 1 && !core.every(p => natural.has(p))) fit = 0.85;
        if (mode === 'minor' && inside < 1 && core.every(p => melodic.has(p))) fit = Math.max(fit, 0.4);
        score += fit * w;
        // Tonic chord evidence
        const isTonic = ci.root === tonic && (mode === 'major' ? !ci.q.minorish && ci.q.sym !== 'dim' : ci.q.minorish);
        if (isTonic) {
          score += 0.6 * w;
          if (i === 0) score += 1.5;
          if (i === infos.length - 1) score += 2.5;
        }
        // Dominant -> tonic resolution
        const next = infos[i + 1];
        if (next && next.root === tonic && mod12(ci.root - tonic) === 7 && !ci.q.minorish) score += ci.q.dominant ? 3 : 2;
      });
      // A minor key needs evidence beyond its relative major: a major V / leading tone
      if (mode === 'minor') {
        const hasLeading = infos.some(ci => corePcs(ci).includes(mod12(tonic + 11)) && mod12(ci.root - tonic) === 7);
        if (!hasLeading) score -= 2;
      }
      // Blues: dominant 7ths on I and IV (and V) point to the I as home even though they clash with the key
      if (mode === 'major') {
        const domBeats = (d: number) => infos.reduce((n, ci, k) => n + (ci.q.dominant && mod12(ci.root - tonic) === d ? Math.min(chords[k].beats || 4, 8) : 0), 0);
        const i7 = domBeats(0), iv7 = domBeats(5), v7 = domBeats(7);
        if (i7 && iv7) score += 0.9 * (i7 + iv7 + v7);
      }
      cands.push({ key, score, confidence: 0 });
    }
  }
  cands.sort((a, b) => b.score - a.score);
  const best = cands[0].score, second = cands[1]?.score ?? 0;
  const total = chords.reduce((n, c) => n + Math.min(c.beats || 4, 8), 0) || 1;
  for (const c of cands) {
    const rel = Math.max(0, c.score) / Math.max(1e-9, best);
    c.confidence = Math.round(100 * Math.min(1, rel * (0.55 + 0.45 * Math.min(1, (best - second + total * 0.15) / (total * 0.6)))));
  }
  return cands;
}

// ---------- Roman numerals ----------
const NUMERAL = ['I', '♭II', 'II', '♭III', 'III', 'IV', '♯IV', 'V', '♭VI', 'VI', '♭VII', 'VII'];

/** Roman numeral body (with case and quality marks) for a chord relative to a tonic. */
export function romanNumeral(ref: ChordRef, tonic: number): string {
  const ci = infoOf(ref);
  return romanFor(ci.root, ci.qi, tonic);
}

export function romanFor(root: number, qIndex: number, tonic: number): string {
  const q = Q[qIndex];
  let n = NUMERAL[mod12(root - tonic)];
  const lower = q.minorish;
  if (lower) n = n.toLowerCase();
  const sym = q.sym;
  if (sym === 'dim') return n + '°';
  if (sym === 'dim7') return n + '°7';
  if (sym === 'm7b5') return n + 'ø7';
  if (sym === 'm9b5') return n + 'ø9';
  if (sym === 'aug') return n + '+';
  if (sym === '7#5') return n + '+7';
  const suffix = lower ? sym.replace(/^m/, '') : sym;
  return n + suffix;
}

// ---------- Chord roles ----------
export type HarmonicFunction = 'T' | 'S' | 'D' | '?';
export type Role = 'diatonic' | 'secondary-dominant' | 'tritone-sub' | 'related-ii' | 'passing-dim' | 'borrowed' | 'chromatic';

export interface ChordAnalysis {
  index: number;
  info: ChordInfo;
  roman: string;
  fn: HarmonicFunction;
  role: Role;
  /** Plain-English explanation */
  why: string;
  level: Level;
  /** index of the chord this one leads to, if it resolves */
  target?: number;
}

const FN_MAJOR: Record<number, HarmonicFunction> = { 0: 'T', 2: 'S', 4: 'T', 5: 'S', 7: 'D', 9: 'T', 11: 'D' };
const FN_MINOR: Record<number, HarmonicFunction> = { 0: 'T', 2: 'S', 3: 'T', 5: 'S', 7: 'D', 8: 'S', 10: 'D', 11: 'D' };
const FN_WORD: Record<HarmonicFunction, string> = { T: 'home', S: 'away', D: 'tension', '?': 'colour' };
export const FUNCTION_LABEL: Record<HarmonicFunction, string> = { T: 'Tonic · home', S: 'Subdominant · away', D: 'Dominant · tension', '?': 'Colour' };

const isDominantType = (ci: ChordInfo) => ci.q.dominant || (ci.q.sym === '' || ci.q.sym === '7#5' || ci.q.sym === 'aug');
const PARALLEL_MODES = ['aeolian', 'dorian', 'phrygian', 'mixolydian', 'lydian', 'harmonic-minor', 'melodic-minor', 'ionian'];

function plainRoman(r: string) {
  return r.replace(/[^IViv♭♯]/g, '');
}

export function analyzeSong(chords: SongChord[], key: Key): ChordAnalysis[] {
  const infos = chords.map(c => infoOf(c.ref));
  const pcs = keyPcs(key);
  const keyNameStr = keyName(key);
  const out: ChordAnalysis[] = [];

  infos.forEach((ci, i) => {
    const next = infos[i + 1];
    const deg = mod12(ci.root - key.tonic);
    const roman = romanFor(ci.root, ci.qi, key.tonic);
    const core = corePcs(ci);
    const diatonic = core.every(p => pcs.has(p));
    const base = { index: i, info: ci, roman };

    // 1. Diatonic
    if (diatonic) {
      const fnMap = key.mode === 'major' ? FN_MAJOR : FN_MINOR;
      const fn = fnMap[deg] ?? '?';
      out.push({ ...base, fn, role: 'diatonic', level: 'basic',
        why: `${roman} in ${keyNameStr} — a ${FN_WORD[fn]} chord${fn === 'T' ? ' that feels settled' : fn === 'S' ? ' that moves away from home' : fn === 'D' ? ' that wants to resolve home' : ''}.` });
      return;
    }

    // 2. Secondary dominant: dominant-type chord a 5th above a diatonic chord (not the tonic itself)
    if (isDominantType(ci)) {
      const targetRoot = mod12(ci.root - 7);
      const targetDeg = mod12(targetRoot - key.tonic);
      const scaleDegs = key.mode === 'major' ? MAJOR : NAT_MINOR;
      if (scaleDegs.includes(targetDeg) && targetDeg !== 0) {
        const resolves = next && next.root === targetRoot;
        const targetQ = resolves ? next.qi : diatonicQualityAt(key, targetDeg);
        const targetRoman = plainRoman(romanFor(targetRoot, targetQ, key.tonic));
        const sym = ci.q.dominant ? ci.q.sym.replace(/^7/, '7') : '';
        out.push({ ...base, roman: `V${sym}/${targetRoman}`, fn: 'D', role: 'secondary-dominant', level: 'basic',
          ...(resolves ? { target: i + 1 } : {}),
          why: `Borrowed dominant: ${ci.symbol} is the V of ${targetRoman}${resolves ? ` and pulls straight into ${next.symbol}` : ''}. It adds a strong push towards that chord.` });
        return;
      }
    }

    // 3. Tritone substitution: dominant chord a half-step above where it resolves
    if (ci.q.dominant && next && mod12(ci.root - next.root) === 1) {
      const targetRoman = plainRoman(romanFor(next.root, next.qi, key.tonic));
      out.push({ ...base, roman: `subV7/${targetRoman}`, fn: 'D', role: 'tritone-sub', level: 'jazz', target: i + 1,
        why: `Tritone sub: ${ci.symbol} replaces the normal V7 of ${next.symbol}. Same tension notes (3rd and 7th swap), smooth chromatic bass slide down.` });
      return;
    }

    // 4. Passing diminished: dim chord a half-step below the next chord
    if ((ci.q.sym === 'dim7' || ci.q.sym === 'dim') && next && mod12(next.root - ci.root) === 1) {
      out.push({ ...base, fn: 'D', role: 'passing-dim', level: 'jazz', target: i + 1,
        why: `Passing diminished: ${ci.symbol} slides chromatically up into ${next.symbol}. Works like a V7♭9 in disguise.` });
      return;
    }

    // 5. Related ii: a minor chord leading into a secondary dominant a 4th up (ii–V of something)
    if (ci.q.minorish && next && mod12(next.root - ci.root) === 5 && isDominantType(next) && !next.q.minorish) {
      const targetRoot = mod12(next.root - 7);
      const targetRoman = plainRoman(romanFor(targetRoot, diatonicQualityAt(key, mod12(targetRoot - key.tonic)), key.tonic));
      out.push({ ...base, roman: `ii/${targetRoman}`, fn: 'S', role: 'related-ii', level: 'jazz', target: i + 1,
        why: `The "ii" half of a ii–V aimed at ${targetRoman}: ${ci.symbol} → ${next.symbol}. Jazz loves borrowing whole ii–Vs.` });
      return;
    }

    // 6. Borrowed from a parallel mode (modal interchange)
    for (const id of PARALLEL_MODES) {
      const s = scaleInfo(key.tonic, si(id));
      if (core.every(p => s.pcs.has(p))) {
        const fn = (key.mode === 'major' ? FN_MINOR : FN_MAJOR)[deg] ?? 'S';
        const modeWord = SCALES[si(id)].name.replace(' (Aeolian)', '').replace('Natural ', '');
        out.push({ ...base, fn, role: 'borrowed', level: key.mode === 'major' && id === 'aeolian' ? 'basic' : 'jazz',
          why: `Borrowed chord (modal interchange): ${ci.symbol} comes from ${s.rootName} ${modeWord}. Same home note, different colour — instant mood shift.` });
        return;
      }
    }

    // 7. Anything else
    out.push({ ...base, fn: '?', role: 'chromatic', level: 'jazz',
      why: `Chromatic chord: ${ci.symbol} sits outside ${keyNameStr}. Often a passing colour, a pivot to a new key, or pure attitude.` });
  });
  return out;
}

/** Quality index of the diatonic 7th chord on a degree (semitones from tonic). */
export function diatonicQualityAt(key: Key, deg: number): number {
  const major: Record<number, string> = { 0: 'maj7', 2: 'm7', 4: 'm7', 5: 'maj7', 7: '7', 9: 'm7', 11: 'm7b5' };
  const minor: Record<number, string> = { 0: 'm7', 2: 'm7b5', 3: 'maj7', 5: 'm7', 7: '7', 8: 'maj7', 10: '7', 11: 'dim7' };
  const sym = (key.mode === 'major' ? major : minor)[mod12(deg)];
  return qi(sym ?? '');
}

/** The diatonic 7th chord on a scale degree as a ChordRef. */
export function diatonicChord(key: Key, deg: number): ChordRef {
  return { root: mod12(key.tonic + deg), q: Q[diatonicQualityAt(key, deg)].sym };
}

// ---------- Named patterns ----------
type Kind = 'maj' | 'min' | 'dom' | 'dim' | 'hdim' | 'any';
interface PatternDef {
  name: string;
  /** [degree in semitones from tonic, allowed kinds] */
  seq: [number, Kind[]][];
  modes: Mode[];
  level: Level;
  about: string;
}

function kindOf(ci: ChordInfo): Kind {
  const s = ci.q.sym;
  if (s === 'dim' || s === 'dim7') return 'dim';
  if (s === 'm7b5' || s === 'm9b5') return 'hdim';
  if (ci.q.dominant) return 'dom';
  if (ci.q.minorish) return 'min';
  return 'maj';
}

const M: Kind[] = ['maj'], m: Kind[] = ['min'], D: Kind[] = ['dom'], MD: Kind[] = ['maj', 'dom'], A: Kind[] = ['any'];
const PATTERNS: PatternDef[] = [
  { name: 'Pachelbel / Canon', seq: [[0, M], [7, MD], [9, m], [4, m], [5, M], [0, M], [5, M], [7, MD]], modes: ['major'], level: 'basic',
    about: 'The Canon in D sequence — under hundreds of pop songs.' },
  { name: '50s / Doo-wop', seq: [[0, M], [9, m], [5, M], [7, MD]], modes: ['major'], level: 'basic',
    about: 'I–vi–IV–V. "Stand By Me", "Earth Angel" — sweet and nostalgic.' },
  { name: 'Pop axis', seq: [[0, M], [7, MD], [9, m], [5, M]], modes: ['major'], level: 'basic',
    about: 'I–V–vi–IV, the "four chords" of pop. "Let It Be", "With or Without You".' },
  { name: 'Sad pop axis', seq: [[9, m], [5, M], [0, M], [7, MD]], modes: ['major'], level: 'basic',
    about: 'vi–IV–I–V: the pop axis starting on the minor chord — wistful.' },
  { name: 'Royal Road', seq: [[5, M], [7, MD], [4, m], [9, m]], modes: ['major'], level: 'jazz',
    about: 'IV–V–iii–vi, beloved in J-pop and anime themes. Yearning and dramatic.' },
  { name: 'Jazz turnaround', seq: [[0, M], [9, ['min', 'dom']], [2, ['min', 'dom']], [7, D]], modes: ['major'], level: 'jazz',
    about: 'I–vi–ii–V: loops back to the top. Swap in dominants (I–VI7–II7–V7) for extra spice.' },
  { name: 'iii–vi–ii–V', seq: [[4, ['min', 'dom']], [9, ['min', 'dom']], [2, ['min', 'dom']], [7, D]], modes: ['major'], level: 'jazz',
    about: 'Circle-of-fifths chain into the V. Classic standards move.' },
  { name: 'Andalusian cadence', seq: [[0, m], [10, M], [8, M], [7, MD]], modes: ['minor'], level: 'basic',
    about: 'i–♭VII–♭VI–V, the flamenco descent. "Hit the Road Jack", "Stray Cat Strut".' },
  { name: 'Backdoor ii–V', seq: [[5, m], [10, D], [0, M]], modes: ['major'], level: 'jazz',
    about: 'iv7–♭VII7–I: sneaks home through the back door. Soulful and warm.' },
  { name: 'Backdoor dominant', seq: [[10, D], [0, M]], modes: ['major'], level: 'jazz',
    about: '♭VII7 resolving to I — a softer alternative to V7–I.' },
  { name: 'Minor ii–V–i', seq: [[2, ['hdim', 'min', 'dim']], [7, D], [0, m]], modes: ['minor', 'major'], level: 'jazz',
    about: 'iiø7–V7–i: the dark, dramatic version of the ii–V–I. Try the altered scale over the V.' },
  { name: 'ii–V–I', seq: [[2, m], [7, D], [0, M]], modes: ['major'], level: 'basic',
    about: 'THE jazz cadence: away → tension → home. Learn to play through this and you can play standards.' },
  { name: 'ii–V', seq: [[2, ['min', 'hdim']], [7, D]], modes: ['major', 'minor'], level: 'basic',
    about: 'A ii–V on its own: sets up the I, even when it never arrives.' },
  { name: 'I–IV–V', seq: [[0, MD], [5, MD], [7, MD]], modes: ['major'], level: 'basic',
    about: 'The three-chord trick: blues, rock & roll, folk, punk.' },
  { name: 'Mixolydian vamp', seq: [[0, MD], [10, M]], modes: ['major'], level: 'basic',
    about: 'I–♭VII: rock and jam-band staple. Play Mixolydian over it.' },
  { name: 'Dorian vamp', seq: [[0, m], [5, MD]], modes: ['minor'], level: 'basic',
    about: 'i–IV (major IV!) — the Dorian giveaway. "Oye Como Va", "Moondance". Dorian over the lot.' },
  { name: 'Phrygian vamp', seq: [[0, m], [1, M]], modes: ['minor'], level: 'jazz',
    about: 'i–♭II: dark Spanish / metal sound. Phrygian or Phrygian Dominant.' },
  { name: 'Authentic cadence', seq: [[7, MD], [0, ['maj', 'min']]], modes: ['major', 'minor'], level: 'basic',
    about: 'V–I: the strongest "we\'re home" move in Western music.' },
  { name: 'Plagal cadence', seq: [[5, ['maj', 'min']], [0, ['maj', 'min']]], modes: ['major', 'minor'], level: 'basic',
    about: 'IV–I, the "Amen" cadence. Gentle resolution.' },
  { name: 'Deceptive cadence', seq: [[7, MD], [9, m]], modes: ['major'], level: 'jazz',
    about: 'V–vi: sets up home, then swerves to the minor chord. Surprise!' },
];

export interface PatternHit {
  name: string;
  start: number;
  length: number;
  level: Level;
  about: string;
}

export function detectPatterns(chords: SongChord[], key: Key): PatternHit[] {
  const infos = chords.map(c => infoOf(c.ref));
  const hits: PatternHit[] = [];
  const covered = new Map<string, number[]>(); // pattern name -> starts (avoid overlapping duplicates of smaller patterns)
  const used: boolean[][] = [];
  for (const p of PATTERNS) {
    if (!p.modes.includes(key.mode)) continue;
    for (let start = 0; start + p.seq.length <= infos.length; start++) {
      const ok = p.seq.every(([deg, kinds], k) => {
        const ci = infos[start + k];
        if (mod12(ci.root - key.tonic) !== deg) return false;
        const kd = kindOf(ci);
        return kinds.includes('any') || kinds.includes(kd) || (kinds.includes('maj') && kd === 'dom' && p.level === 'basic' && false);
      });
      if (!ok) continue;
      // Skip if fully contained in an already found (longer) pattern
      const range = Array.from({ length: p.seq.length }, (_, k) => start + k);
      if (used.some(u => range.every(r => u.includes(r)))) continue;
      hits.push({ name: p.name, start, length: p.seq.length, level: p.level, about: p.about });
      used.push(range);
      covered.set(p.name, [...(covered.get(p.name) ?? []), start]);
    }
  }

  // Circle of fifths chains (4+ roots each a 5th below the previous)
  let run = 1;
  for (let i = 1; i <= infos.length; i++) {
    if (i < infos.length && mod12(infos[i - 1].root - infos[i].root) === 7) run++;
    else {
      if (run >= 4) {
        const start = i - run;
        const range = Array.from({ length: run }, (_, k) => start + k);
        if (!used.some(u => range.every(r => u.includes(r)))) {
          hits.push({ name: 'Circle of fifths', start, length: run, level: 'jazz',
            about: 'Roots falling in fifths — each chord resolves into the next. The engine of jazz standards ("Autumn Leaves", "Fly Me to the Moon").' });
        }
      }
      run = 1;
    }
  }

  // Blues: dominant chords on I, IV and V
  const domDegs = new Set(infos.filter(ci => ci.q.dominant).map(ci => mod12(ci.root - key.tonic)));
  if (domDegs.has(0) && domDegs.has(5) && infos.length >= 3) {
    hits.push({ name: 'Blues', start: 0, length: infos.length, level: 'basic',
      about: 'Dominant 7ths on I and IV (and usually V) — that\'s the blues. Mix major and minor pentatonic, or play Mixolydian per chord.' });
  }
  return hits.sort((a, b) => a.start - b.start || b.length - a.length);
}
