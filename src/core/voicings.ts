// Playable fretted-instrument voicings and piano voicings.
import { Q } from './chords';
import { mod12 } from './notes';

export interface Voicing {
  /** frets[s]: -1 muted, 0 open, n fretted. String 0 = highest string. */
  frets: number[];
  score: number;
  pos: number;
  fSpan: number;
  played: number;
  bucket: number;
}

export interface VoicingOptions {
  span?: number;
  maxInternalMutes?: number;
  relaxed?: boolean;
  limit?: number;
}

/**
 * Find playable voicings for a chord on any fretted instrument.
 * Checks finger count, barres, string skips, bass note and that every note is a chord tone,
 * then ranks by comfort and voice-leading quality and diversifies across the neck.
 */
export function findVoicings(root: number, qIndex: number, bass: number, tuning: number[], maxFret: number, opts: VoicingOptions = {}): Voicing[] {
  const q = Q[qIndex];
  const span = opts.span ?? 4;
  const maxInternalMutes = opts.maxInternalMutes ?? 1;
  const limit = opts.limit ?? 120;
  const nStr = tuning.length;
  const allowed = new Set(q.tones.map(t => mod12(root + t.semi)));
  allowed.add(bass);
  const req = new Set(q.tones.filter(t => !t.opt).map(t => mod12(root + t.semi)));
  req.add(bass);
  const optPcs = q.tones.filter(t => t.opt).map(t => mod12(root + t.semi));
  const hasFlat9 = q.tones.some(t => t.label === 'b9');
  const isDyad = q.tones.length <= 2;
  const minStrings = Math.max(isDyad ? 2 : Math.min(3, nStr), Math.min(req.size, nStr));
  const found = new Map<string, Voicing>();
  const cur: number[] = new Array(nStr);

  const evaluate = () => {
    let played = 0, minMidi = Infinity, opens = 0, top = -1, bot = -1;
    const hit = new Set<number>();
    let fCount = 0, minF = Infinity, maxF = -Infinity;
    for (let s = 0; s < nStr; s++) {
      const f = cur[s];
      if (f < 0) continue;
      played++;
      if (top < 0) top = s;
      bot = s;
      const midi = tuning[s] + f;
      if (midi < minMidi) minMidi = midi;
      hit.add(midi % 12);
      if (f > 0) { fCount++; if (f < minF) minF = f; if (f > maxF) maxF = f; } else opens++;
    }
    if (played < minStrings) return;
    if (minMidi % 12 !== bass) return;
    for (const r of req) if (!hit.has(r)) return;

    // Finger feasibility (with simple barre detection)
    let fingers = fCount;
    if (fCount > 4) {
      let atMin = 0, barreLow = -1;
      for (let s = 0; s < nStr; s++) if (cur[s] === minF) { atMin++; barreLow = s; }
      if (atMin < 2) return;
      fingers = 1 + fCount - atMin;
      if (fingers > 4) return;
      for (let s = 0; s < barreLow; s++) if (cur[s] === 0) return; // no open strings under a barre
    }

    let internal = 0, skipAfterBass = 0;
    for (let s = top + 1; s < bot; s++) if (cur[s] < 0) { internal++; if (s === bot - 1) skipAfterBass++; }
    if (internal > maxInternalMutes) return;

    let missingOpt = 0;
    for (const p of optPcs) if (!hit.has(p)) missingOpt++;
    const fSpan = fCount ? maxF - minF : 0;
    const pos = fCount ? minF : 0;
    const openPosition = !fCount || maxF <= 4;

    const pcCount = new Map<number, number>();
    let sandwiched = 0;
    for (let s = 0; s < nStr; s++) {
      const f = cur[s];
      if (f < 0) continue;
      const pc = (tuning[s] + f) % 12;
      pcCount.set(pc, (pcCount.get(pc) || 0) + 1);
      if (f === 0 && s > top && s < bot) {
        let hiFret = false, loFret = false;
        for (let u = 0; u < s; u++) if (cur[u] > 0) hiFret = true;
        for (let u = s + 1; u < nStr; u++) if (cur[u] > 0) loFret = true;
        if (hiFret && loFret) sandwiched++;
      }
    }
    let tripled = 0;
    for (const c of pcCount.values()) if (c > 2) tripled += c - 2;

    // Voice-leading sanity: minor 9ths between voices sound harsh (unless it's a b9 chord),
    // and close intervals low on the neck turn to mud.
    const sounding: number[] = [];
    for (let s = 0; s < nStr; s++) if (cur[s] >= 0) sounding.push(tuning[s] + cur[s]);
    sounding.sort((a, b) => a - b);
    let harsh = 0;
    for (let a = 0; a < sounding.length; a++) {
      for (let b = a + 1; b < sounding.length; b++) {
        const d = sounding[b] - sounding[a];
        if (!hasFlat9 && (d === 13 || d === 25)) harsh++;
      }
      if (a > 0 && sounding[a] - sounding[a - 1] <= 2 && sounding[a - 1] < 52) harsh++;
    }

    let score = played * (isDyad ? 0.5 : 2)
      - (internal - skipAfterBass) * 4
      - skipAfterBass * 1.5
      - missingOpt * 3
      - pos * 0.4
      - fSpan * 1.8
      - fingers * 0.5
      - top * (isDyad ? 0 : 1.0)
      - tripled * 2
      - harsh * 3;
    if (openPosition) score += opens * 0.5;
    else score -= opens * 3 + sandwiched * 3;
    if (tuning[bot] + cur[bot] === minMidi) score += 1.5;

    const key = cur.join(',');
    if (!found.has(key)) found.set(key, { frets: [...cur], score, pos, fSpan, played, bucket: openPosition ? 0 : minF });
  };

  for (let w = 1; w <= Math.max(1, maxFret - 1); w++) {
    const lo = w, hi = Math.min(maxFret, w + span - 1);
    const o: number[][] = [];
    for (let s = 0; s < nStr; s++) {
      const list = [-1];
      if (allowed.has(tuning[s] % 12)) list.push(0);
      for (let f = lo; f <= hi; f++) if (allowed.has((tuning[s] + f) % 12)) list.push(f);
      o.push(list);
    }
    const rec = (s: number) => {
      if (s === nStr) { evaluate(); return; }
      for (const f of o[s]) { cur[s] = f; rec(s + 1); }
    };
    rec(0);
  }

  const sorted = [...found.values()].sort((a, b) => b.score - a.score || a.pos - b.pos);
  if (!sorted.length && !opts.relaxed) {
    return findVoicings(root, qIndex, bass, tuning, maxFret, { ...opts, span: 5, maxInternalMutes: 2, relaxed: true });
  }
  // Diversify: discount neck regions that are already well covered.
  const pool = sorted.slice(0, 2000);
  const picked: Voicing[] = [];
  const perBucket = new Map<number, number>();
  while (pool.length && picked.length < limit) {
    let bi = 0, bs = -Infinity;
    for (let i = 0; i < pool.length; i++) {
      let crowd = 0;
      for (const [b, c] of perBucket) if (Math.abs(b - pool[i].bucket) <= 1) crowd += c;
      const adj = pool[i].score - crowd * 1.2;
      if (adj > bs) { bs = adj; bi = i; }
    }
    const v = pool.splice(bi, 1)[0];
    picked.push(v);
    perBucket.set(v.bucket, (perBucket.get(v.bucket) || 0) + 1);
  }
  return picked;
}

/** Close-position piano voicing with the bass at `bassOctaveMidi` (default C3 octave). */
export function pianoVoicing(root: number, qIndex: number, bass: number, bassOctaveMidi = 48): number[] {
  const q = Q[qIndex];
  const tones = q.tones.filter(t => !(t.opt && (t.label === '3' || t.label === '11')));
  const bassMidi = bassOctaveMidi + mod12(bass);
  const notes = [bassMidi];
  const idx = tones.findIndex(t => mod12(root + t.semi) === mod12(bass));
  const ordered = idx >= 0 ? [...tones.slice(idx + 1), ...tones.slice(0, idx)] : tones;
  let prev = bassMidi;
  for (const t of ordered) {
    const pc = mod12(root + t.semi);
    let m = prev + 1;
    while (m % 12 !== pc) m++;
    notes.push(m);
    prev = m;
  }
  return notes;
}

/** Tab string, low string first: [0,1,0,2,3,-1] -> "x32010" */
export const tabString = (frets: number[]) =>
  [...frets].reverse().map(f => (f < 0 ? 'x' : String(f))).join(frets.some(f => f > 9) ? '-' : '');

/** Parse "x32010", "x-3-2-0-1-0", "8 10 10 9 8 8" (low string first) into frets (string 0 = high). */
export function parseTab(str: string, nStr = 6): number[] | null {
  const s = str.trim();
  let toks: string[] | null = null;
  if (new RegExp(`^[xX\\d]{${nStr}}$`).test(s)) toks = s.split('');
  else {
    const parts = s.split(/[\s\-.,|]+/).filter(Boolean);
    if (parts.length === nStr && parts.every(p => /^(x|X|\d{1,2})$/.test(p))) toks = parts;
  }
  if (!toks) return null;
  return toks.map(t => (/x/i.test(t) ? -1 : parseInt(t, 10))).reverse();
}
