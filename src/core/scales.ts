// Scale dictionary, spelling, reverse scale search and scale harmonisation.
import { parseFormula, type Level, type Tone } from './intervals';
import { FLAT, SHARP, ROOT_MAJ, ROOT_MIN, accidentalCount, mod12, spell, type SpellPref } from './notes';
import { Q, chordInfo, type ChordRef } from './chords';

export type ScaleFamily = 'Major modes' | 'Melodic minor modes' | 'Harmonic minor modes' | 'Pentatonic & blues'
  | 'Bebop' | 'Symmetric' | 'Other' ;

interface ScaleDef {
  id: string;
  name: string;
  formula: string;
  family: ScaleFamily;
  level: Level;
  vibe: string;
  aliases?: string[];
  /** For modes: the parent scale id and which degree of it this mode starts on */
  parent?: [string, number];
}

const DEFS: ScaleDef[] = [
  // --- Major modes ---
  { id: 'ionian', name: 'Major (Ionian)', formula: '1 2 3 4 5 6 7', family: 'Major modes', level: 'basic', aliases: ['major', 'ionian', 'maj'],
    vibe: 'Happy, settled, home. The "Do-Re-Mi" scale.' },
  { id: 'dorian', name: 'Dorian', formula: '1 2 b3 4 5 6 b7', family: 'Major modes', level: 'basic', parent: ['ionian', 2],
    vibe: 'Minor but hopeful — the natural 6th lifts it. Santana, "So What", funk jams.' },
  { id: 'phrygian', name: 'Phrygian', formula: '1 b2 b3 4 5 b6 b7', family: 'Major modes', level: 'jazz', parent: ['ionian', 3],
    vibe: 'Dark and Spanish-flavoured thanks to the ♭2. Metal riffs and flamenco.' },
  { id: 'lydian', name: 'Lydian', formula: '1 2 3 #4 5 6 7', family: 'Major modes', level: 'jazz', parent: ['ionian', 4],
    vibe: 'Dreamy, floating major — the ♯4 sounds like wonder. Film scores, Satriani, Steve Vai.' },
  { id: 'mixolydian', name: 'Mixolydian', formula: '1 2 3 4 5 6 b7', family: 'Major modes', level: 'basic', parent: ['ionian', 5],
    vibe: 'Bluesy, rocking major. The sound of a dominant 7 chord — Grateful Dead, AC/DC, country.' },
  { id: 'aeolian', name: 'Natural Minor (Aeolian)', formula: '1 2 b3 4 5 b6 b7', family: 'Major modes', level: 'basic', parent: ['ionian', 6], aliases: ['minor', 'aeolian', 'natural minor', 'min'],
    vibe: 'Sad, serious, epic. The default minor sound.' },
  { id: 'locrian', name: 'Locrian', formula: '1 b2 b3 4 b5 b6 b7', family: 'Major modes', level: 'jazz', parent: ['ionian', 7],
    vibe: 'Unstable and tense (♭5!). Lives over half-diminished chords.' },

  // --- Melodic minor modes ---
  { id: 'melodic-minor', name: 'Melodic Minor', formula: '1 2 b3 4 5 6 7', family: 'Melodic minor modes', level: 'jazz', aliases: ['jazz minor', 'melodic minor'],
    vibe: 'Minor with a major-7 sheen. Sophisticated, mysterious — a jazz staple.' },
  { id: 'dorian-b2', name: 'Dorian ♭2', formula: '1 b2 b3 4 5 6 b7', family: 'Melodic minor modes', level: 'fusion', parent: ['melodic-minor', 2], aliases: ['phrygian natural 6'],
    vibe: 'Phrygian darkness with a bright 6th. Great over sus(♭9) chords.' },
  { id: 'lydian-augmented', name: 'Lydian Augmented', formula: '1 2 3 #4 #5 6 7', family: 'Melodic minor modes', level: 'fusion', parent: ['melodic-minor', 3],
    vibe: 'Lydian with a ♯5 — weightless, otherworldly. Over maj7♯5.' },
  { id: 'lydian-dominant', name: 'Lydian Dominant', formula: '1 2 3 #4 5 6 b7', family: 'Melodic minor modes', level: 'jazz', parent: ['melodic-minor', 4], aliases: ['overtone', 'acoustic', 'lydian b7', 'mixolydian #11'],
    vibe: 'A dominant 7 with a shimmering ♯11. The Simpsons theme, tritone subs, bossa nova.' },
  { id: 'mixolydian-b6', name: 'Mixolydian ♭6', formula: '1 2 3 4 5 b6 b7', family: 'Melodic minor modes', level: 'fusion', parent: ['melodic-minor', 5], aliases: ['aeolian dominant', 'hindu'],
    vibe: 'Major turning bittersweet. Dominant chords heading to minor.' },
  { id: 'locrian-2', name: 'Locrian ♮2', formula: '1 2 b3 4 b5 b6 b7', family: 'Melodic minor modes', level: 'jazz', parent: ['melodic-minor', 6], aliases: ['half diminished', 'locrian natural 2', 'locrian #2'],
    vibe: 'The smoother half-diminished choice — Locrian with a pretty 9th.' },
  { id: 'altered', name: 'Altered (Super Locrian)', formula: '1 b2 b3 3 b5 b6 b7', family: 'Melodic minor modes', level: 'jazz', parent: ['melodic-minor', 7], aliases: ['super locrian', 'alt', 'diminished whole tone'],
    vibe: 'Maximum tension over a dominant: every colour altered (♭9 ♯9 ♯11 ♭13). Resolve it and it feels amazing.' },

  // --- Harmonic minor modes ---
  { id: 'harmonic-minor', name: 'Harmonic Minor', formula: '1 2 b3 4 5 b6 7', family: 'Harmonic minor modes', level: 'jazz',
    vibe: 'Minor with a leading tone — exotic, classical, neoclassical shred.' },
  { id: 'locrian-6', name: 'Locrian ♮6', formula: '1 b2 b3 4 b5 6 b7', family: 'Harmonic minor modes', level: 'fusion', parent: ['harmonic-minor', 2],
    vibe: 'Half-diminished with a twist of 6.' },
  { id: 'ionian-5', name: 'Ionian ♯5', formula: '1 2 3 4 #5 6 7', family: 'Harmonic minor modes', level: 'fusion', parent: ['harmonic-minor', 3], aliases: ['ionian augmented'],
    vibe: 'Major with a raised 5th — glassy and strange.' },
  { id: 'dorian-4', name: 'Dorian ♯4', formula: '1 2 b3 #4 5 6 b7', family: 'Harmonic minor modes', level: 'fusion', parent: ['harmonic-minor', 4], aliases: ['ukrainian dorian', 'romanian minor'],
    vibe: 'Dorian with a gypsy ♯4. Eastern-European flavour.' },
  { id: 'phrygian-dominant', name: 'Phrygian Dominant', formula: '1 b2 3 4 5 b6 b7', family: 'Harmonic minor modes', level: 'jazz', parent: ['harmonic-minor', 5], aliases: ['spanish', 'freygish', 'phrygian major'],
    vibe: 'Spanish/Middle-Eastern drama. The V7 of a minor key — flamenco and metal.' },
  { id: 'lydian-2', name: 'Lydian ♯2', formula: '1 #2 3 #4 5 6 7', family: 'Harmonic minor modes', level: 'fusion', parent: ['harmonic-minor', 6],
    vibe: 'Lydian with an exotic ♯2. Bright and alien.' },
  { id: 'ultralocrian', name: 'Ultralocrian', formula: '1 b2 b3 b4 b5 b6 bb7', family: 'Harmonic minor modes', level: 'fusion', parent: ['harmonic-minor', 7], aliases: ['super locrian bb7'],
    vibe: 'Darkest of them all. Over diminished 7 chords.' },
  { id: 'harmonic-major', name: 'Harmonic Major', formula: '1 2 3 4 5 b6 7', family: 'Harmonic minor modes', level: 'fusion',
    vibe: 'Major with a melancholy ♭6. Bittersweet, cinematic.' },

  // --- Pentatonic & blues ---
  { id: 'major-pentatonic', name: 'Major Pentatonic', formula: '1 2 3 5 6', family: 'Pentatonic & blues', level: 'basic', aliases: ['major pent', 'pentatonic major'],
    vibe: 'Open, sweet, country & classic rock. No wrong notes over a major chord.' },
  { id: 'minor-pentatonic', name: 'Minor Pentatonic', formula: '1 b3 4 5 b7', family: 'Pentatonic & blues', level: 'basic', aliases: ['minor pent', 'pentatonic minor', 'pentatonic', 'the box'],
    vibe: 'THE box. Rock & blues home base — great, but time to think outside it, mate.' },
  { id: 'blues', name: 'Blues', formula: '1 b3 4 b5 5 b7', family: 'Pentatonic & blues', level: 'basic', aliases: ['minor blues', 'blues scale'],
    vibe: 'Minor pentatonic plus the "blue note" ♭5. Instant grit.' },
  { id: 'major-blues', name: 'Major Blues', formula: '1 2 b3 3 5 6', family: 'Pentatonic & blues', level: 'basic',
    vibe: 'Major pentatonic with a ♭3 to slide into the 3rd. B.B. King sweetness.' },
  { id: 'dominant-pentatonic', name: 'Dominant Pentatonic', formula: '1 2 3 5 b7', family: 'Pentatonic & blues', level: 'jazz',
    vibe: 'A pentatonic built for dominant 7 chords — nails the 3rd and ♭7.' },
  { id: 'minor-6-pentatonic', name: 'Minor 6 Pentatonic', formula: '1 b3 4 5 6', family: 'Pentatonic & blues', level: 'jazz',
    vibe: 'Minor pentatonic with a Dorian 6 instead of ♭7. Smooth, modern.' },
  { id: 'suspended-pentatonic', name: 'Suspended Pentatonic', formula: '1 2 4 5 b7', family: 'Pentatonic & blues', level: 'jazz', aliases: ['egyptian'],
    vibe: 'No 3rd at all — open and modal. Perfect over sus chords.' },
  { id: 'kumoi', name: 'Kumoi', formula: '1 2 b3 5 6', family: 'Pentatonic & blues', level: 'fusion',
    vibe: 'Japanese pentatonic, a melodic-minor flavoured five-note set.' },
  { id: 'hirajoshi', name: 'Hirajoshi', formula: '1 2 b3 5 b6', family: 'Pentatonic & blues', level: 'fusion',
    vibe: 'Japanese koto sound — haunting and spacious.' },
  { id: 'in-sen', name: 'In-Sen', formula: '1 b2 4 5 b7', family: 'Pentatonic & blues', level: 'fusion',
    vibe: 'Japanese pentatonic with a dark ♭2. Great over sus♭9.' },

  // --- Bebop ---
  { id: 'bebop-dominant', name: 'Bebop Dominant', formula: '1 2 3 4 5 6 b7 7', family: 'Bebop', level: 'jazz',
    vibe: 'Mixolydian plus a chromatic passing note so chord tones land on the beat. Charlie Parker lines.' },
  { id: 'bebop-major', name: 'Bebop Major', formula: '1 2 3 4 5 #5 6 7', family: 'Bebop', level: 'jazz',
    vibe: 'Major scale with a passing ♯5 — swinging major lines.' },
  { id: 'bebop-dorian', name: 'Bebop Dorian', formula: '1 2 b3 3 4 5 6 b7', family: 'Bebop', level: 'jazz', aliases: ['bebop minor'],
    vibe: 'Dorian with a passing major 3rd — the minor bebop sound.' },
  { id: 'bebop-melodic-minor', name: 'Bebop Melodic Minor', formula: '1 2 b3 4 5 #5 6 7', family: 'Bebop', level: 'fusion',
    vibe: 'Melodic minor with a passing ♯5.' },

  // --- Symmetric ---
  { id: 'whole-tone', name: 'Whole Tone', formula: '1 2 3 #4 #5 b7', family: 'Symmetric', level: 'jazz',
    vibe: 'All whole steps — dreamy, unresolved. Over 7♯5 chords. Debussy and dream sequences.' },
  { id: 'diminished-hw', name: 'Diminished (Half-Whole)', formula: '1 b2 b3 3 #4 5 6 b7', family: 'Symmetric', level: 'jazz', aliases: ['dominant diminished', 'half whole', 'octatonic'],
    vibe: 'The 7♭9 scale: ♭9, ♯9, ♯11 and a natural 13. Tense but slick.' },
  { id: 'diminished-wh', name: 'Diminished (Whole-Half)', formula: '1 2 b3 4 b5 #5 6 7', family: 'Symmetric', level: 'jazz', aliases: ['whole half'],
    vibe: 'Over diminished 7 chords. Symmetric — repeats every minor 3rd.' },
  { id: 'augmented', name: 'Augmented', formula: '1 #2 3 5 #5 7', family: 'Symmetric', level: 'fusion',
    vibe: 'Two augmented triads interlocked. Modern, Coltrane-esque.' },
  { id: 'messiaen-3', name: 'Messiaen Mode 3', formula: '1 2 b3 3 #4 5 b6 b7 7', family: 'Symmetric', level: 'fusion',
    vibe: 'Nine notes, symmetric every major 3rd. Lush and kaleidoscopic.' },

  // --- Other ---
  { id: 'hungarian-minor', name: 'Hungarian Minor', formula: '1 2 b3 #4 5 b6 7', family: 'Other', level: 'fusion', aliases: ['gypsy minor'],
    vibe: 'Harmonic minor with a ♯4 — two exotic leaps. Dramatic.' },
  { id: 'double-harmonic', name: 'Double Harmonic Major', formula: '1 b2 3 4 5 b6 7', family: 'Other', level: 'fusion', aliases: ['byzantine', 'arabic'],
    vibe: 'Middle-Eastern grandeur: two augmented 2nds. Misirlou.' },
  { id: 'neapolitan-minor', name: 'Neapolitan Minor', formula: '1 b2 b3 4 5 b6 7', family: 'Other', level: 'fusion',
    vibe: 'Harmonic minor with a ♭2. Dark and operatic.' },
  { id: 'neapolitan-major', name: 'Neapolitan Major', formula: '1 b2 b3 4 5 6 7', family: 'Other', level: 'fusion',
    vibe: 'Melodic minor with a ♭2. Unusual and elegant.' },
  { id: 'prometheus', name: 'Prometheus', formula: '1 2 3 #4 6 b7', family: 'Other', level: 'fusion',
    vibe: 'Scriabin\'s "mystic chord" scale. Hazy and mystical.' },
  { id: 'enigmatic', name: 'Enigmatic', formula: '1 b2 3 #4 #5 b7 7', family: 'Other', level: 'fusion',
    vibe: 'Verdi\'s puzzle scale. Strange and chromatic.' },
];

export interface Scale extends ScaleDef {
  i: number;
  tones: Tone[];
  minorish: boolean;
  /** semitone set relative to the root */
  semis: number[];
}

export const SCALES: Scale[] = DEFS.map((d, i) => {
  const tones = parseFormula(d.formula);
  const labels = new Set(tones.map(t => t.label));
  return { ...d, i, tones, semis: tones.map(t => t.semi), minorish: labels.has('b3') && !labels.has('3') };
});
export const SCALE_FAMILIES: ScaleFamily[] = [...new Set(SCALES.map(s => s.family))];
const BY_ID = new Map(SCALES.map(s => [s.id, s]));
export const scaleById = (id: string) => BY_ID.get(id);
export function si(id: string): number {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`Unknown scale "${id}"`);
  return s.i;
}

export interface ScaleRef {
  root: number;
  id: string;
  pref?: SpellPref;
}

export interface ScaleNote {
  pc: number;
  note: string;
  label: string;
  deg: number;
}
export interface ScaleInfo {
  root: number;
  scale: Scale;
  rootName: string;
  name: string;
  notes: ScaleNote[];
  pcs: Set<number>;
  ref: ScaleRef;
}

/** Spell a scale; for black-key roots pick the spelling with the fewest accidentals unless forced. */
export function scaleInfo(root: number, scaleIndex: number, pref?: SpellPref): ScaleInfo {
  const scale = SCALES[scaleIndex];
  root = mod12(root);
  const build = (rootName: string) => scale.tones.map(t => ({ pc: mod12(root + t.semi), note: spell(rootName, t.semi, t.deg), label: t.label, deg: t.deg }));
  let rootName: string;
  if (pref) rootName = (pref === 'flat' ? FLAT : SHARP)[root];
  else if (FLAT[root] === SHARP[root]) rootName = SHARP[root];
  else {
    const fl = build(FLAT[root]), sh = build(SHARP[root]);
    const a = accidentalCount(fl.map(n => n.note)), b = accidentalCount(sh.map(n => n.note));
    rootName = a < b ? FLAT[root] : b < a ? SHARP[root] : (scale.minorish ? ROOT_MIN : ROOT_MAJ)[root];
  }
  const notes = build(rootName);
  return {
    root, scale, rootName, notes,
    name: `${rootName} ${scale.name}`,
    pcs: new Set(notes.map(n => n.pc)),
    ref: { root, id: scale.id, ...(pref ? { pref } : {}) },
  };
}
export const scaleInfoOf = (ref: ScaleRef) => scaleInfo(ref.root, si(ref.id), ref.pref);

export interface ScaleMatch {
  root: number;
  si: number;
  /** scale notes you did not play */
  extra: number;
  score: number;
}

/** Reverse scale search: every scale (any root) that contains all given pitch classes. */
export function identifyScales(pcs: Set<number>, tonic?: number, level: Level = 'fusion'): ScaleMatch[] {
  const out: ScaleMatch[] = [];
  if (!pcs.size) return out;
  const rank = { basic: 0, jazz: 1, fusion: 2 } as const;
  for (const s of SCALES) {
    if (rank[s.level] > rank[level]) continue;
    for (let root = 0; root < 12; root++) {
      const set = new Set(s.semis.map(x => mod12(root + x)));
      let ok = true;
      for (const p of pcs) if (!set.has(p)) { ok = false; break; }
      if (!ok) continue;
      const extra = set.size - pcs.size;
      let score = -extra * 2 + (s.level === 'basic' ? 3 : s.level === 'jazz' ? 1 : 0) + (set.size === 7 ? 1 : 0);
      if (tonic !== undefined && root === tonic) score += 6;
      if (pcs.has(root)) score += 1;
      out.push({ root, si: s.i, extra, score });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.si - b.si || a.root - b.root);
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

export interface DiatonicChord {
  degree: number;
  roman: string;
  ref: ChordRef;
  symbol: string;
}

/**
 * Harmonise a 7-note scale by stacking thirds. `size` 3 = triads, 4 = sevenths.
 * Returns [] for scales that are not heptatonic.
 */
export function diatonicChords(root: number, scaleIndex: number, size: 3 | 4 = 4): DiatonicChord[] {
  const info = scaleInfo(root, scaleIndex);
  const s = info.scale;
  if (s.tones.length !== 7) return [];
  const out: DiatonicChord[] = [];
  for (let d = 0; d < 7; d++) {
    const chordRoot = info.notes[d].pc;
    const rel = new Set<number>();
    for (let k = 0; k < size; k++) rel.add(mod12(info.notes[(d + 2 * k) % 7].pc - chordRoot));
    const q = Q.find(q => {
      const set = new Set(q.tones.map(t => t.semi % 12));
      return set.size === rel.size && [...rel].every(x => set.has(x)) && q.tones.length === size;
    });
    if (!q) continue;
    const ci = chordInfo(chordRoot, q.i, undefined, /b/.test(info.rootName) || info.notes.some(n => /[A-G]b/.test(n.note)) ? 'flat' : undefined);
    // Use the scale's own spelling for the chord root
    const rootNote = info.notes[d].note;
    const symbol = rootNote + q.sym;
    let roman = ROMAN[d];
    const third = rel.has(4) ? 'maj' : rel.has(3) ? 'min' : 'other';
    if (third === 'min') roman = roman.toLowerCase();
    if (q.sym === 'dim' || q.sym === 'dim7') roman = roman.toLowerCase() + '°' + (q.sym === 'dim7' ? '7' : '');
    else if (q.sym === 'm7b5') roman = roman.toLowerCase() + 'ø7';
    else if (q.sym === 'aug') roman += '+';
    else if (size === 4) roman += q.sym.replace(/^m(?!aj)/, '').replace('(maj7)', 'maj7') || '';
    out.push({ degree: d + 1, roman, ref: { ...ci.ref, pref: /b/.test(rootNote) ? 'flat' : /#/.test(rootNote) ? 'sharp' : undefined }, symbol });
  }
  return out;
}

/** Parse "D dorian", "e altered", "Bb harmonic minor", "F# min pent". */
export function parseScale(str: string): ScaleRef | null {
  const m = str.trim().replace(/♯/g, '#').replace(/♭/g, 'b').match(/^([A-Ga-g])([#b]?)\s+(.+)$/);
  if (!m) return null;
  const root = mod12('CDEFGAB'.indexOf(m[1].toUpperCase()) >= 0
    ? [0, 2, 4, 5, 7, 9, 11]['CDEFGAB'.indexOf(m[1].toUpperCase())] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) : 0);
  const q = m[3].toLowerCase().replace(/[^a-z0-9#♯♭ ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\bpent\b/, 'pentatonic').replace(/\bmin\b/, 'minor').replace(/\bmaj\b/, 'major');
  const norm = (s: string) => s.toLowerCase().replace(/[()♭♯]/g, m => (m === '♭' ? 'b' : m === '♯' ? '#' : '')).replace(/\s+/g, ' ').trim();
  let best: Scale | undefined;
  for (const s of SCALES) {
    const names = [s.id.replace(/-/g, ' '), norm(s.name), ...(s.aliases ?? [])];
    if (names.some(n => n === q)) { best = s; break; }
  }
  if (!best) best = SCALES.find(s => [norm(s.name), ...(s.aliases ?? [])].some(n => n.startsWith(q) && q.length >= 3));
  if (!best) return null;
  const ref: ScaleRef = { root, id: best.id };
  if (m[2] === 'b') ref.pref = 'flat';
  else if (m[2] === '#') ref.pref = 'sharp';
  return ref;
}
