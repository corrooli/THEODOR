// Chord-scale theory: which scales to play over a chord, with guide tones.
import { infoOf, type ChordRef } from './chords';
import { withinLevel, type Level } from './intervals';
import { mod12 } from './notes';
import { SCALES, scaleInfo, si, type ScaleRef } from './scales';
import { keyPcs, type Key } from './analysis';

export interface ScaleChoice {
  ref: ScaleRef;
  name: string;
  /** fits the song's key at this point */
  inKey: boolean;
  /** not a pentatonic/blues box - a step outside */
  outsideTheBox: boolean;
  why: string;
  level: Level;
}

// Curated candidates per chord family, best first, with a plain-English reason.
type Cand = [id: string, why: string];
const MAJ: Cand[] = [
  ['ionian', 'The plain major sound — every note fits, but watch the 4th (it clashes with the 3rd).'],
  ['lydian', 'Swap the 4th for a ♯4: no clashes, dreamy and modern.'],
  ['major-pentatonic', 'Five safe notes — no wrong moves.'],
  ['bebop-major', 'Major scale + passing ♯5 for swinging eighth-note lines.'],
];
const MIN: Cand[] = [
  ['dorian', 'Minor with a bright 6th — the go-to jazz/funk minor sound.'],
  ['aeolian', 'Darker natural minor — great when the chord is the home chord.'],
  ['minor-pentatonic', 'The box. Safe, bluesy — then add Dorian\'s 2 and 6 to break out.'],
  ['minor-6-pentatonic', 'Pentatonic with a Dorian 6 — modern and smooth.'],
  ['bebop-dorian', 'Dorian with a passing 3rd: bebop minor lines.'],
  ['phrygian', 'Dark ♭2 colour — only when the chord sits on the 3rd degree.'],
  ['melodic-minor', 'Minor with a major 7th: mysterious, sophisticated.'],
  ['blues', 'Minor pentatonic + ♭5 grit.'],
];
const MINMAJ: Cand[] = [
  ['melodic-minor', 'The natural home of m(maj7): minor with a major 7th.'],
  ['harmonic-minor', 'Exotic alternative with a ♭6.'],
];
const DOM: Cand[] = [
  ['mixolydian', 'The dominant\'s own mode: major with a ♭7. Blues-rock home.'],
  ['bebop-dominant', 'Mixolydian + passing major 7th: chord tones land on the beat.'],
  ['dominant-pentatonic', 'Five notes that nail the 3rd and ♭7.'],
  ['lydian-dominant', 'Mixolydian with a ♯11 — bright and modern, perfect for tritone subs.'],
  ['blues', 'Minor blues over a dominant: the classic bluesy clash.'],
  ['altered', 'Every tension (♭9 ♯9 ♯11 ♭13). Use when the next chord is home — resolve it!'],
  ['diminished-hw', 'Half-whole diminished: ♭9, ♯9, ♯11 and 13. Slick and symmetric.'],
  ['phrygian-dominant', 'Spanish ♭9/♭13 colour — perfect when resolving to minor.'],
  ['mixolydian-b6', 'Bittersweet ♭13 — dominant leaning into a minor chord.'],
  ['whole-tone', 'Dreamy ♯5 sound. Great over 7♯5.'],
];
const SUS: Cand[] = [
  ['mixolydian', 'Sus chords love Mixolydian — just lean on the 4th.'],
  ['suspended-pentatonic', 'A pentatonic without a 3rd: perfectly open over sus.'],
  ['dorian', 'Think "minor chord a 5th up": a 7sus4 is a ii–V in one chord.'],
  ['dorian-b2', 'For sus♭9: dark and modern.'],
  ['phrygian', 'Sus♭9 colour with a ♭6.'],
  ['in-sen', 'Japanese pentatonic with a ♭2 — sus♭9 magic.'],
];
const HDIM: Cand[] = [
  ['locrian', 'The half-diminished\'s own mode — the ♭2 is crunchy though.'],
  ['locrian-2', 'Locrian with a natural 9: the smoother, hipper choice.'],
];
const DIM: Cand[] = [
  ['diminished-wh', 'Symmetric whole-half: built for diminished 7 chords.'],
  ['ultralocrian', 'Seventh mode of harmonic minor — the dim7 as vii°7.'],
];
const AUG: Cand[] = [
  ['whole-tone', 'All whole steps — the augmented sound itself.'],
  ['lydian-augmented', 'Lydian with ♯5: over maj7♯5.'],
  ['augmented', 'Two augmented triads: modern and symmetric.'],
];
const POWER: Cand[] = [
  ['minor-pentatonic', 'Rock home base over a power chord.'],
  ['major-pentatonic', 'Sweeter major colour.'],
  ['mixolydian', 'Rocking major with ♭7.'],
  ['dorian', 'Minor with a hip 6th.'],
];

function candidatesFor(sym: string, minorish: boolean, dominant: boolean): Cand[] {
  if (sym === 'm(maj7)' || sym === 'm(maj9)') return [...MINMAJ, ...MIN];
  if (sym === 'm7b5' || sym === 'm9b5') return HDIM;
  if (sym === 'dim' || sym === 'dim7' || sym === 'dim(maj7)') return DIM;
  if (sym === 'aug' || sym === 'maj7#5') return AUG;
  if (sym === '5') return POWER;
  if (/sus/.test(sym)) return SUS;
  if (dominant) {
    if (/#11/.test(sym)) return [DOM[3], ...DOM.filter((_, i) => i !== 3)];
    if (/#5|alt|b13/.test(sym)) return [DOM[5], DOM[9], DOM[8], ...DOM];
    if (/b9/.test(sym)) return [DOM[6], DOM[7], DOM[5], ...DOM];
    if (/#9/.test(sym)) return [DOM[5], DOM[6], DOM[4], ...DOM];
    return DOM;
  }
  if (minorish) return MIN;
  if (/#11/.test(sym)) return [MAJ[1], ...MAJ];
  return MAJ;
}

/** The mode of the key's own scale that starts on this chord's root, if the chord fits the key. */
function keyModeAt(chord: ChordRef, key: Key): string | null {
  const ci = infoOf(chord);
  const kp = keyPcs(key, false);
  const core = ci.tones.filter(t => !t.opt).map(t => t.pc);
  if (!core.every(p => kp.has(p))) return null;
  const deg = mod12(ci.root - key.tonic);
  const majorModes: Record<number, string> = { 0: 'ionian', 2: 'dorian', 4: 'phrygian', 5: 'lydian', 7: 'mixolydian', 9: 'aeolian', 11: 'locrian' };
  const minorModes: Record<number, string> = { 0: 'aeolian', 2: 'locrian', 3: 'ionian', 5: 'dorian', 7: 'phrygian', 8: 'lydian', 10: 'mixolydian' };
  return (key.mode === 'major' ? majorModes : minorModes)[deg] ?? null;
}

export function scalesForChord(chord: ChordRef, key?: Key, next?: ChordRef, level: Level = 'fusion'): ScaleChoice[] {
  const ci = infoOf(chord);
  const required = ci.tones.filter(t => !t.opt).map(t => t.pc);
  const cands = candidatesFor(ci.q.sym, ci.q.minorish, ci.q.dominant);
  const out: ScaleChoice[] = [];
  const seen = new Set<string>();
  const kp = key ? keyPcs(key) : null;
  const nextInfo = next ? infoOf(next) : undefined;
  const resolvesToMinor = !!nextInfo && nextInfo.q.minorish && mod12(ci.root - nextInfo.root) === 7;

  const push = (id: string, why: string) => {
    if (seen.has(id)) return;
    const s = SCALES[si(id)];
    if (!withinLevel(s.level, level)) return;
    const info = scaleInfo(ci.root, s.i, chord.pref);
    if (!required.every(p => info.pcs.has(p))) return; // must contain every chord tone
    seen.add(id);
    out.push({
      ref: info.ref,
      name: info.name,
      inKey: !!kp && [...info.pcs].every(p => kp.has(p)),
      outsideTheBox: s.family !== 'Pentatonic & blues',
      why,
      level: s.level,
    });
  };

  if (key) {
    const m = keyModeAt(chord, key);
    if (m) push(m, `Stays inside the key — it's the key's own scale starting on ${ci.rootName}.`);
  }
  if (ci.q.dominant && resolvesToMinor) {
    push('phrygian-dominant', `Resolving to a minor chord: the ♭9 and ♭13 lead smoothly into ${nextInfo!.symbol}.`);
    push('altered', `Maximum tension before ${nextInfo!.symbol} — resolve every altered note by a half step.`);
  }
  for (const [id, why] of cands) push(id, why);
  return out;
}

/** Guide tones: the 3rd and 7th (or 6th) — the notes that define the chord. */
export function guideTones(chord: ChordRef): number[] {
  const ci = infoOf(chord);
  return ci.tones.filter(t => ['3', 'b3', '7', 'b7', 'bb7'].includes(t.label) || (t.label === '6' && !ci.tones.some(x => /7$/.test(x.label)))).map(t => t.pc);
}
