// Tiny melody generator: demo lines that show how a scale sounds over a chord.
// Deterministic for a given seed so tests (and repeated listening) are stable.
import { mod12 } from './notes';

export interface LickNote {
  midi: number;
  /** start, in beats from the beginning of the chord */
  at: number;
  /** length in beats */
  dur: number;
  vel: number;
}

export interface LickOptions {
  /** scale pitch classes */
  scale: number[];
  /** chord pitch classes */
  chord: number[];
  /** guide tones (3rd / 7th) of this chord, preferred landing notes */
  guides?: number[];
  /** guide tones of the next chord: the line leads into one of them */
  target?: number[];
  beats: number;
  /** previous note, so lines over a progression connect smoothly */
  from?: number;
  lo?: number;
  hi?: number;
  seed?: number;
  /** start with a scale run that plays every note once (good for previews) */
  run?: boolean;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Rhythm cells for one beat: offsets + lengths within the beat. */
const CELLS: [number, number][][] = [
  [[0, 0.5], [0.5, 0.5]], // two eighths
  [[0, 0.5], [0.5, 0.5]],
  [[0, 0.5], [0.5, 0.5]],
  [[0, 1]], // quarter
  [[0.5, 0.5]], // rest + eighth (syncopation)
  [[0, 1 / 3], [1 / 3, 1 / 3], [2 / 3, 1 / 3]], // triplet
];

export function makeLick(o: LickOptions): { notes: LickNote[]; last: number } {
  const lo = o.lo ?? 55, hi = o.hi ?? 79;
  const rand = rng(o.seed ?? 1);
  const scaleSet = new Set(o.scale.map(mod12));
  const chordSet = new Set(o.chord.map(mod12));
  const guideSet = new Set((o.guides ?? []).map(mod12));
  const pool: number[] = [];
  for (let m = lo; m <= hi; m++) if (scaleSet.has(m % 12)) pool.push(m);
  if (!pool.length || o.beats <= 0) return { notes: [], last: o.from ?? lo };

  const nearest = (midi: number, ok: (m: number) => boolean) => {
    let best = -1;
    pool.forEach((m, i) => { if (ok(m) && (best < 0 || Math.abs(m - midi) < Math.abs(pool[best] - midi))) best = i; });
    return best < 0 ? 0 : best;
  };
  const isChord = (m: number) => chordSet.has(m % 12);
  const center = o.from ?? Math.round((lo + hi) / 2);
  let idx = nearest(center, m => guideSet.has(m % 12) || isChord(m));
  let dir = rand() < 0.5 ? 1 : -1;
  const notes: LickNote[] = [];
  let beat = 0;

  // Optional opening run: every scale note once, from the chord tone nearest the start
  if (o.run) {
    const steps = Math.min(pool.length, o.scale.length + 1);
    if (idx + steps >= pool.length) dir = -1; else dir = 1;
    for (let k = 0; k < steps && beat < o.beats - 1; k++) {
      notes.push({ midi: pool[idx], at: beat, dur: 0.5, vel: k === 0 ? 0.85 : 0.7 });
      beat += 0.5;
      idx = Math.max(0, Math.min(pool.length - 1, idx + dir));
    }
    dir = -dir;
  }

  const endBeat = o.beats;
  while (beat < endBeat) {
    const isLastBeat = beat >= endBeat - 1;
    const cell = isLastBeat ? [[0, 1]] as [number, number][] : CELLS[Math.floor(rand() * CELLS.length)];
    for (const [off, len] of cell) {
      const at = beat + off;
      if (at >= endBeat) break;
      const strong = off === 0 && Number.isInteger(beat) && beat % 2 === 0;
      if (isLastBeat && o.target?.length) {
        // Lead into the next chord: step to a note a half/whole step from one of its guide tones
        const tset = new Set(o.target.map(mod12));
        const t = nearest(pool[idx], m => tset.has(mod12(m + 1)) || tset.has(mod12(m - 1)) || tset.has(mod12(m + 2)) || tset.has(mod12(m - 2)));
        idx = t;
      } else if (strong || isLastBeat) {
        // Land on a chord tone (guide tones preferred) near the current position
        const near = nearest(pool[idx] + dir, m => (guideSet.size && rand() < 0.6 ? guideSet.has(m % 12) : isChord(m)));
        idx = Math.abs(near - idx) <= 3 ? near : idx;
      }
      notes.push({ midi: pool[idx], at, dur: len * (rand() < 0.2 ? 0.6 : 0.95), vel: strong ? 0.85 : 0.6 + rand() * 0.15 });
      // Mostly stepwise, sometimes a skip; turn around at the edges or at random
      if (rand() < 0.22) dir = -dir;
      const step = rand() < 0.2 ? 2 : 1;
      let next = idx + dir * step;
      if (next < 0 || next >= pool.length) { dir = -dir; next = idx + dir * step; }
      idx = Math.max(0, Math.min(pool.length - 1, next));
    }
    beat += 1;
  }
  return { notes, last: notes.length ? notes[notes.length - 1].midi : center };
}
