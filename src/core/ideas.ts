// Idea engine: reharmonisation, substitutions and approach chords for a chord in context.
import { infoOf, qualityBySym, refKey, type ChordRef } from './chords';
import { withinLevel, type Level } from './intervals';
import { mod12 } from './notes';
import { diatonicChord, keyPcs, type Key } from './analysis';

export type IdeaKind = 'replace' | 'insert-before';
export type IdeaFamily = 'Colour' | 'Substitute' | 'Approach' | 'Borrow' | 'Outside';

export interface Idea {
  id: string;
  kind: IdeaKind;
  family: IdeaFamily;
  chords: ChordRef[];
  title: string;
  why: string;
  level: Level;
  /** 1 = subtle, 3 = spicy */
  spice: 1 | 2 | 3;
}

const ref = (root: number, q: string, pref?: ChordRef['pref']): ChordRef => ({ root: mod12(root), q, ...(pref ? { pref } : {}) });

function sameChord(a: ChordRef, b: ChordRef) {
  return refKey(a) === refKey(b);
}

/**
 * Generate ideas for chords[index] in a key. `next` is the chord that follows (if any).
 */
export function ideasFor(chord: ChordRef, key: Key, next?: ChordRef, level: Level = 'fusion'): Idea[] {
  const ci = infoOf(chord);
  const q = ci.q;
  const root = ci.root;
  const deg = mod12(root - key.tonic);
  const pcs = keyPcs(key, false);
  const ideas: Idea[] = [];
  const pref = chord.pref;
  const add = (i: Omit<Idea, 'id'>) => {
    if (!withinLevel(i.level, level)) return;
    if (i.kind === 'replace' && i.chords.length === 1 && sameChord(i.chords[0], chord)) return;
    if (i.chords.some(c => !qualityBySym(c.q))) return;
    const id = i.kind + ':' + i.chords.map(refKey).join('|');
    if (ideas.some(x => x.id === id)) return;
    ideas.push({ ...i, id });
  };
  const isMaj = !q.minorish && !q.dominant && !['dim', 'dim7', 'm7b5', 'aug', '5'].includes(q.sym);
  const isMin = q.minorish && !['dim', 'dim7', 'm7b5', 'm9b5', 'dim(maj7)'].includes(q.sym);
  const isDom = q.dominant;
  const nextInfo = next ? infoOf(next) : undefined;

  // ---- Colour: extensions on the same root ----
  if (isMaj) {
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, deg === 5 && key.mode === 'major' ? 'maj7' : 'maj7', pref)], title: 'Make it a maj7', why: 'Adds the major 7th: softer, jazzier, more sophisticated.', level: 'basic', spice: 1 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'add9', pref)], title: 'add9 shimmer', why: 'The 9th adds sparkle without changing the chord\'s job.', level: 'basic', spice: 1 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, '6/9', pref)], title: '6/9 — the jazz ending', why: 'Major 6th + 9th: warm and open, the classic final chord.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'maj9', pref)], title: 'maj9 lushness', why: 'Major 7 plus 9: neo-soul and R&B lushness.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Outside', chords: [ref(root, 'maj7#11', pref)], title: 'Lydian maj7♯11', why: 'The ♯11 floats — dreamy, film-score, fusion. Play Lydian over it.', level: 'fusion', spice: 3 });
  }
  if (isMin) {
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'm7', pref)], title: 'Make it m7', why: 'The minor 7th smooths it out — instantly more soulful.', level: 'basic', spice: 1 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'm9', pref)], title: 'm9 silk', why: 'Minor 9th: smooth, neo-soul, the "Herbie" sound.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'm11', pref)], title: 'm11 — open & modern', why: 'The 11th makes it airy and modal. Fusion keyboards everywhere.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'm6', pref)], title: 'Dorian m6', why: 'The major 6th gives a hip, Dorian/James Bond flavour.', level: 'jazz', spice: 2 });
    if (deg === 0) add({ kind: 'replace', family: 'Outside', chords: [ref(root, 'm(maj7)', pref)], title: 'm(maj7) noir', why: 'Minor with a major 7th — spy-movie tension. Melodic minor territory.', level: 'fusion', spice: 3 });
  }
  if (isDom) {
    const toMinor = nextInfo?.q.minorish;
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, '9', pref)], title: 'Dominant 9', why: 'Adds the 9th: funkier, fuller. James Brown would approve.', level: 'basic', spice: 1 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, '13', pref)], title: 'Dominant 13', why: 'The 13th on top: big-band brightness.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, '7sus4', pref)], title: 'Suspend it (7sus4)', why: 'Hold the 4th instead of the 3rd — floating, modern, less obvious.', level: 'jazz', spice: 1 });
    add({ kind: 'replace', family: 'Outside', chords: [ref(root, toMinor ? '7b9' : '7#9', pref)], title: toMinor ? '7♭9 — dark pull' : '7♯9 — Hendrix grit', why: toMinor ? 'The ♭9 leans hard into a minor chord. Classic minor-key dominant.' : 'The "Hendrix chord": bluesy major/minor clash, maximum attitude.', level: 'jazz', spice: 2 });
    add({ kind: 'replace', family: 'Outside', chords: [ref(root, '7#5#9', pref)], title: 'Altered dominant', why: 'Alter everything (♭9 ♯9 ♯5): maximum tension before resolving. Altered scale over it.', level: 'fusion', spice: 3 });
    add({ kind: 'replace', family: 'Outside', chords: [ref(root, '13#11', pref)], title: 'Lydian dominant 13♯11', why: 'Bright, shimmering dominant. Lydian dominant scale — fusion gold.', level: 'fusion', spice: 3 });
  }
  if (q.sym === '5') {
    add({ kind: 'replace', family: 'Colour', chords: [ref(root, 'sus2', pref)], title: 'Open sus2', why: 'Add the 2nd: open and ringing, no major/minor commitment.', level: 'basic', spice: 1 });
  }

  // ---- Substitutes: same job, different chord ----
  const diaSub = (d: number, title: string, why: string, lvl: Level = 'basic') => {
    const c = diatonicChord(key, d);
    if (key.mode === 'major' || pcs.has(c.root)) add({ kind: 'replace', family: 'Substitute', chords: [c], title, why, level: lvl, spice: 1 });
  };
  if (key.mode === 'major') {
    if (deg === 0 && (isMaj || isDom)) {
      diaSub(9, 'Relative minor (vi)', 'Same notes mostly, but sadder. vi can stand in for I.');
      diaSub(4, 'iii as tonic substitute', 'Shares three notes with Imaj7 — a subtle, jazzy swap.', 'jazz');
    }
    if (deg === 5 && isMaj) diaSub(2, 'ii instead of IV', 'ii7 and IVmaj7 share three notes — and ii sets up a ii–V.');
    if (deg === 2 && isMin) diaSub(5, 'IV instead of ii', 'Same function (away from home), brighter colour.');
    if (deg === 9 && isMin) diaSub(0, 'I instead of vi', 'Lift the mood: the relative major.');
    if (deg === 7 && (isDom || isMaj)) diaSub(11, 'vii ø instead of V', 'viiø7 is a V9 without its root — lighter tension.', 'jazz');
  } else {
    if (deg === 0 && isMin) add({ kind: 'replace', family: 'Substitute', chords: [ref(key.tonic + 3, 'maj7')], title: 'Relative major (♭III)', why: 'Brighter cousin with the same notes.', level: 'basic', spice: 1 });
  }
  // Relative major/minor of the chord itself
  if (isMaj && !(key.mode === 'major' && deg === 0)) add({ kind: 'replace', family: 'Substitute', chords: [ref(root + 9, 'm7')], title: 'Its relative minor', why: `${infoOf(ref(root + 9, 'm7')).symbol} shares most notes with ${ci.symbol} — softer, sadder.`, level: 'basic', spice: 1 });
  if (isMin && !(key.mode === 'minor' && deg === 0)) add({ kind: 'replace', family: 'Substitute', chords: [ref(root + 3, 'maj7')], title: 'Its relative major', why: `${infoOf(ref(root + 3, 'maj7')).symbol} shares most notes with ${ci.symbol} — brighter.`, level: 'basic', spice: 1 });
  // Tritone substitution
  if (isDom) {
    add({ kind: 'replace', family: 'Substitute', chords: [ref(root + 6, '7', 'flat')], title: 'Tritone sub', why: `${infoOf(ref(root + 6, '7', 'flat')).symbol} shares the same 3rd and 7th as ${ci.symbol} (swapped) — resolves down by a half step. Pure jazz.`, level: 'jazz', spice: 2 });
  }

  // ---- Approach: chords inserted before the next chord ----
  if (nextInfo && !['dim', 'dim7'].includes(nextInfo.q.sym)) {
    const t = nextInfo.root;
    const tMinor = nextInfo.q.minorish;
    add({ kind: 'insert-before', family: 'Approach', chords: [ref(t + 7, '7')], title: `Secondary dominant into ${nextInfo.symbol}`, why: `Put the V7 of ${nextInfo.symbol} right before it — a strong magnetic pull into the next chord.`, level: 'basic', spice: 1 });
    add({ kind: 'insert-before', family: 'Approach', chords: [ref(t + 2, tMinor ? 'm7b5' : 'm7'), ref(t + 7, tMinor ? '7b9' : '7')], title: `ii–V into ${nextInfo.symbol}`, why: `Aim a whole ii–V at ${nextInfo.symbol}. The bread and butter of jazz reharmonisation.`, level: 'jazz', spice: 2 });
    add({ kind: 'insert-before', family: 'Approach', chords: [ref(t + 1, '7', 'flat')], title: 'Tritone approach', why: `A dominant one half-step above ${nextInfo.symbol}, sliding down into it. Smooth and slinky.`, level: 'jazz', spice: 2 });
    add({ kind: 'insert-before', family: 'Approach', chords: [ref(t - 1, 'dim7')], title: 'Passing diminished', why: `A dim7 a half step below ${nextInfo.symbol} creeps up into it — old-school and classy.`, level: 'jazz', spice: 2 });
    add({ kind: 'insert-before', family: 'Outside', chords: [ref(t + 1, nextInfo.q.sym, 'flat')], title: 'Chromatic side-slip', why: `Play ${nextInfo.symbol} a half step higher first, then slide down. Fusion players love this tension trick.`, level: 'fusion', spice: 3 });
    if (key.mode === 'major' && t === key.tonic && !tMinor) {
      add({ kind: 'insert-before', family: 'Borrow', chords: [ref(key.tonic + 5, 'm7'), ref(key.tonic + 10, '7', 'flat')], title: 'Backdoor ii–V', why: 'iv7–♭VII7 sneaks home through the back door — soulful, Beatles-y, gospel.', level: 'jazz', spice: 2 });
    }
  }

  // ---- Borrow: modal interchange (parallel minor in major, parallel major in minor) ----
  if (key.mode === 'major') {
    if (deg === 5 && isMaj) add({ kind: 'replace', family: 'Borrow', chords: [ref(root, 'm6')], title: 'Minor iv (borrowed)', why: 'Borrow iv from the parallel minor: the bittersweet "Creep" / Beatles moment.', level: 'basic', spice: 2 });
    if (deg === 0 || deg === 9) add({ kind: 'replace', family: 'Borrow', chords: [ref(key.tonic + 8, 'maj7', 'flat')], title: '♭VI from parallel minor', why: 'A borrowed ♭VImaj7: epic, cinematic lift.', level: 'jazz', spice: 2 });
    if (deg === 7 || deg === 5) add({ kind: 'replace', family: 'Borrow', chords: [ref(key.tonic + 10, '7', 'flat')], title: '♭VII7 (backdoor)', why: 'Borrowed ♭VII7 — a gentler road home than V7. Rock and soul favourite.', level: 'jazz', spice: 2 });
    if (deg === 2 && isMin) add({ kind: 'replace', family: 'Borrow', chords: [ref(root, 'm7b5')], title: 'iiø7 from minor', why: 'Half-diminished ii borrowed from minor — darker setup for the V.', level: 'jazz', spice: 2 });
  } else {
    if (deg === 5 && isMin) add({ kind: 'replace', family: 'Borrow', chords: [ref(root, '7')], title: 'Dorian IV7', why: 'Major IV (with ♭7) in a minor key — that Dorian/funk sound. "Oye Como Va".', level: 'basic', spice: 2 });
    if (deg === 7 && isMin) add({ kind: 'replace', family: 'Borrow', chords: [ref(root, '7')], title: 'Major V7 (harmonic minor)', why: 'Raise the 3rd: the minor v becomes V7 and really pulls home.', level: 'basic', spice: 1 });
    if (deg === 0 && isMin) add({ kind: 'replace', family: 'Borrow', chords: [ref(root, '')], title: 'Picardy third', why: 'End on a major tonic in a minor song — sudden sunlight.', level: 'jazz', spice: 2 });
  }

  const famOrder: IdeaFamily[] = ['Colour', 'Substitute', 'Approach', 'Borrow', 'Outside'];
  return ideas.sort((a, b) => famOrder.indexOf(a.family) - famOrder.indexOf(b.family) || a.spice - b.spice);
}

/** Apply an idea to a chord list, returning the new list. */
export function applyIdea<T extends { ref: ChordRef; beats: number }>(chords: T[], index: number, idea: Idea, make: (ref: ChordRef, beats: number) => T): T[] {
  const out = [...chords];
  const cur = chords[index];
  if (idea.kind === 'replace') {
    const each = Math.max(1, Math.round(cur.beats / idea.chords.length));
    out.splice(index, 1, ...idea.chords.map(r => make(r, each)));
  } else {
    // Steal time from the current chord for the approach chords when possible
    const nextIdx = index + 1;
    const approachBeats = cur.beats >= 4 ? 2 : cur.beats >= 2 ? 1 : 1;
    const per = Math.max(1, Math.floor(approachBeats / idea.chords.length)) || 1;
    if (cur.beats > approachBeats) out[index] = make(cur.ref, cur.beats - approachBeats);
    out.splice(nextIdx, 0, ...idea.chords.map(r => make(r, per)));
  }
  return out;
}
