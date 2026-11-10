// Universal lookup: work out what the user typed (chord, scale, notes, tab or progression)
// and offer fuzzy suggestions while typing.
import { Q, parseChordSymbol, chordInfo, type ChordRef } from './chords';
import { withinLevel, type Level } from './intervals';
import { FLAT, ROOT_MAJ, SHARP, asciiAcc, isNoteName, pcOf } from './notes';
import { SCALES, parseScale, scaleInfo, type ScaleRef } from './scales';
import { parseTab } from './voicings';

export type Interpretation =
  | { kind: 'chord'; ref: ChordRef }
  | { kind: 'scale'; ref: ScaleRef }
  | { kind: 'notes'; midis: number[] }
  | { kind: 'tab'; frets: number[] }
  | { kind: 'progression'; chords: ChordRef[] };

/** "C E G Bb", "C4 E4 G4", "c,eb,g" -> MIDI numbers (ascending from octave 3 unless octaves given). */
export function parseNoteList(str: string): number[] | null {
  const tokens = asciiAcc(str.trim()).split(/[\s,]+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const out: number[] = [];
  let prev: number | null = null;
  for (const tok of tokens) {
    const m = tok.match(/^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d)?$/);
    if (!m) return null;
    const pc = pcOf(m[1], m[2] ?? '');
    let midi: number;
    if (m[3] !== undefined) midi = (parseInt(m[3], 10) + 1) * 12 + pc;
    else if (prev === null) midi = 48 + pc;
    else { midi = prev + 1; while (midi % 12 !== pc) midi++; }
    out.push(midi);
    prev = midi;
  }
  return out;
}

export function parseProgression(str: string): ChordRef[] | null {
  const tokens = str.trim().split(/[\s,|]+|\s-\s/).filter(t => t && t !== '-' && t !== '|');
  if (tokens.length < 2) return null;
  const out: ChordRef[] = [];
  for (const t of tokens) {
    const c = parseChordSymbol(t);
    if (!c) return null;
    out.push(c);
  }
  return out;
}

/** All valid interpretations, most likely first. */
export function interpret(query: string, nStrings = 6): Interpretation[] {
  const q = query.trim();
  if (!q) return [];
  const out: Interpretation[] = [];
  const tab = parseTab(q, nStrings);
  if (tab) out.push({ kind: 'tab', frets: tab });
  const scale = parseScale(q);
  if (scale) out.push({ kind: 'scale', ref: scale });
  const chord = parseChordSymbol(q);
  if (chord) out.push({ kind: 'chord', ref: chord });
  const notes = parseNoteList(q);
  if (notes) out.push({ kind: 'notes', midis: notes });
  const prog = parseProgression(q);
  if (prog && !(notes && prog.every(c => c.q === '' && !c.bass) && false)) out.push({ kind: 'progression', chords: prog });
  return out;
}

export type Suggestion =
  | { kind: 'chord'; ref: ChordRef; label: string; sub: string }
  | { kind: 'scale'; ref: ScaleRef; label: string; sub: string };

/**
 * Fuzzy suggestions while typing: "dor" -> Dorian scales, "Bb m" -> Bb minor chords/scales,
 * "altered" -> altered scale + altered chords. Root defaults to the first letter typed, else C.
 */
export function suggest(query: string, level: Level = 'fusion', limit = 24): Suggestion[] {
  const raw = asciiAcc(query.trim());
  if (!raw) return [];
  const m = raw.match(/^([A-Ga-g][#b]?)(?:\s+|(?=[^#b]|$))(.*)$/);
  let root: number | null = null;
  let rest = raw.toLowerCase();
  if (m && (isNoteName(m[1]) && (m[2].length === 0 || /^\s/.test(raw.slice(m[1].length)) || /^[mM0-9(+\-°ø]/.test(m[2])))) {
    root = pcOf(m[1][0], m[1].slice(1));
    rest = m[2].trim().toLowerCase();
  }
  const prefFlat = !!m && /b$/.test(m[1] ?? '') && m[1].length === 2;
  const roots = root === null ? [0] : [root];
  const out: (Suggestion & { score: number })[] = [];
  const words = rest.split(/\s+/).filter(Boolean);
  const matchScore = (hay: string) => {
    if (!words.length) return 1;
    let s = 0;
    for (const w of words) {
      const i = hay.indexOf(w);
      if (i < 0) return 0;
      s += i === 0 ? 3 : /\s/.test(hay[i - 1]) ? 2 : 1;
    }
    return s;
  };
  for (const r of roots) {
    const rootName = prefFlat ? FLAT[r] : root === null ? 'C' : (SHARP[r].length === 1 ? SHARP[r] : (/#/.test(raw) ? SHARP[r] : ROOT_MAJ[r]));
    for (const s of SCALES) {
      if (!withinLevel(s.level, level)) continue;
      const hay = [s.name, s.id.replace(/-/g, ' '), ...(s.aliases ?? []), s.family].join(' | ').toLowerCase();
      const sc = matchScore(hay);
      if (!sc) continue;
      const info = scaleInfo(r, s.i, prefFlat ? 'flat' : undefined);
      out.push({ kind: 'scale', ref: info.ref, label: info.name, sub: s.vibe, score: sc + (s.level === 'basic' ? 0.5 : 0) });
    }
    for (const q of Q) {
      if (!withinLevel(q.level, level)) continue;
      const hay = [q.sym, q.name, q.fam].join(' | ').toLowerCase();
      // exact symbol typed right after the root, e.g. "Cmaj7"
      const symHit = rest && (q.norm.toLowerCase() === rest.replace(/[()\s]/g, ''));
      const sc = symHit ? 10 : matchScore(hay);
      if (!sc) continue;
      const ci = chordInfo(r, q.i, undefined, prefFlat ? 'flat' : undefined);
      out.push({ kind: 'chord', ref: ci.ref, label: ci.symbol, sub: `${q.name} · ${ci.tones.map(t => t.note).join(' ')}`, score: sc + (q.level === 'basic' ? 0.5 : 0) });
    }
    void rootName;
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map(({ score: _s, ...s }) => s as Suggestion);
}
