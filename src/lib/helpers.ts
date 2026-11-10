// Glue between the theory core, audio and instruments.
import { infoOf, qi, refKey, type ChordInfo, type ChordRef } from '../core/chords';
import { INTERVAL_NAME, type Fn } from '../core/intervals';
import { SHARP, mod12 } from '../core/notes';
import { findVoicings, pianoVoicing, type Voicing } from '../core/voicings';
import type { ScaleInfo } from '../core/scales';
import { fk, type FretMarks, type KeyMarks, type Mark } from '../ui/marks';
import { strum, playScale, type Timbre } from './audio';
import { app } from './state.svelte';
import { chordItem } from './song';

// ---------- voicings (cached) ----------
const vcache = new Map<string, Voicing[]>();
export function voicingsFor(ref: ChordRef, tuning = app.tuning, frets = app.settings.frets): Voicing[] {
  const ci = infoOf(ref);
  const key = `${tuning.join(',')}|${frets}|${refKey(ref)}`;
  let v = vcache.get(key);
  if (!v) {
    v = findVoicings(ci.root, ci.qi, ci.bass, tuning, Math.max(frets, 5));
    if (vcache.size > 400) vcache.clear();
    vcache.set(key, v);
  }
  return v;
}

/** A voicing whose lowest fret is close to `near` (for smooth movement between chords). */
export function voicingNear(ref: ChordRef, near: number | null): Voicing | undefined {
  const list = voicingsFor(ref);
  if (!list.length) return undefined;
  if (near === null) return list[0];
  return list.slice(0, 30).reduce((best, v) => {
    const d = Math.abs((v.pos || 1) - near) * 1.4 - v.score * 0.15;
    const bd = Math.abs((best.pos || 1) - near) * 1.4 - best.score * 0.15;
    return d < bd ? v : best;
  }, list[0]);
}

export function fretsToMidis(frets: number[], tuning = app.tuning): number[] {
  return frets.flatMap((f, s) => (f >= 0 ? [tuning[s] + f] : []));
}

/** Bass line notes for a chord on bass: root, 5th, octave. */
export function bassNotes(ref: ChordRef): number[] {
  const ci = infoOf(ref);
  const low = app.tuning[app.tuning.length - 1];
  let b = low + mod12(ci.bass - low);
  const fifth = ci.tones.find(t => /5$/.test(t.label));
  return [b, ...(fifth ? [b + mod12(fifth.semi)] : []), b + 12];
}

export function instrumentTimbre(): Timbre {
  return app.settings.instrument === 'bass' ? 'bass' : 'guitar';
}

/** Notes to play for a chord on the current instrument. */
export function chordMidis(ref: ChordRef, voicing?: Voicing): number[] {
  if (app.settings.instrument === 'bass') return bassNotes(ref);
  const v = voicing ?? voicingsFor(ref)[0];
  if (v) return fretsToMidis(v.frets);
  const ci = infoOf(ref);
  return pianoVoicing(ci.root, ci.qi, ci.bass);
}

export function playChord(ref: ChordRef, opts: { arp?: boolean; keys?: boolean; voicing?: Voicing } = {}) {
  if (opts.keys) {
    const ci = infoOf(ref);
    strum(pianoVoicing(ci.root, ci.qi, ci.bass), 'keys', { arp: opts.arp });
    return;
  }
  const t = instrumentTimbre();
  strum(chordMidis(ref, opts.voicing), t, { arp: opts.arp || t === 'bass' });
}

export function playChordSequence(refs: ChordRef[], gap = 0.75) {
  refs.forEach((r, i) => setTimeout(() => playChord(r), i * gap * 1000));
}

export function playScaleInfo(info: ScaleInfo) {
  const base = app.settings.instrument === 'bass' ? 36 : 48;
  let start = base + mod12(info.root - base);
  if (start < base) start += 12;
  playScale(info.scale.semis.map(s => start + s), app.settings.instrument === 'bass' ? 'bass' : 'guitar');
}

// ---------- song actions ----------
export function addToSong(refs: ChordRef[], sectionIndex?: number) {
  const song = app.song;
  const sec = song.sections[sectionIndex ?? song.sections.length - 1];
  sec.chords.push(...refs.map(r => chordItem(r)));
  app.touch();
  app.notify(`Added ${refs.map(r => infoOf(r).symbol).join(' ')} to “${sec.name}”`);
}

// ---------- marks ----------
export interface ToneLabel {
  fn: Fn;
  note: string;
  label: string;
  full: string;
}
export function labelFor(pc: number, info: ChordInfo | null): ToneLabel {
  if (!info) return { fn: 'none', note: SHARP[pc], label: '', full: '' };
  const t = info.tones.find(t => t.pc === pc);
  if (t) return { fn: t.fn, note: t.note, label: t.label, full: INTERVAL_NAME[t.label] };
  if (pc === info.bass) return { fn: 'bass', note: info.bassName, label: 'bass', full: 'Slash bass' };
  return { fn: 'none', note: SHARP[pc], label: '', full: '' };
}

const shown = (l: ToneLabel) => (app.settings.labels === 'intervals' && l.label && l.label !== 'bass' ? (l.label === '1' ? 'R' : l.label) : l.note);

/** Marks for chord display: `frets` solid, chord tones elsewhere as ghosts. */
export function chordFretMarks(info: ChordInfo | null, frets: number[] | null, pcs: Set<number>, ghosts = true, tuning = app.tuning, maxFret = app.settings.frets): FretMarks {
  const m: FretMarks = new Map();
  tuning.forEach((open, s) => {
    for (let f = 0; f <= maxFret; f++) {
      const pc = (open + f) % 12;
      const on = frets?.[s] === f;
      if (!on && !(ghosts && pcs.has(pc))) continue;
      const l = labelFor(pc, info);
      m.set(fk(s, f), { kind: on ? 'on' : 'ghost', fn: l.fn, text: shown(l), title: l.full ? `${l.note} · ${l.full}` : l.note });
    }
  });
  return m;
}

export function chordKeyMarks(info: ChordInfo | null, on: Iterable<number>, pcs: Set<number>, ghosts = true, lo = 36, hi = 84): KeyMarks {
  const m: KeyMarks = new Map();
  const onSet = new Set(on);
  for (let midi = lo; midi <= hi; midi++) {
    const isOn = onSet.has(midi);
    if (!isOn && !(ghosts && pcs.has(midi % 12))) continue;
    const l = labelFor(midi % 12, info);
    m.set(midi, { kind: isOn ? 'on' : 'ghost', fn: l.fn, text: shown(l), title: l.full ? `${l.note} · ${l.full}` : l.note });
  }
  return m;
}

/** Scale over the whole neck; chord tones coloured, guide tones ringed, other scale notes neutral. */
export function scaleFretMarks(scale: ScaleInfo, chord: ChordInfo | null, guides: Set<number> = new Set(), window: [number, number] | null = null, tuning = app.tuning, maxFret = app.settings.frets): FretMarks {
  const m: FretMarks = new Map();
  const noteOf = new Map(scale.notes.map(n => [n.pc, n]));
  tuning.forEach((open, s) => {
    for (let f = 0; f <= maxFret; f++) {
      if (window && (f < window[0] || f > window[1]) && !(f === 0 && window[0] <= 1)) continue;
      const pc = (open + f) % 12;
      const sn = noteOf.get(pc);
      if (!sn) continue;
      const ct = chord?.tones.find(t => t.pc === pc);
      const label = app.settings.labels === 'intervals' ? (sn.label === '1' ? 'R' : sn.label) : sn.note;
      let mark: Mark;
      if (ct) mark = { kind: guides.has(pc) ? 'guide' : 'on', fn: ct.fn, text: app.settings.labels === 'intervals' ? (ct.label === '1' ? 'R' : ct.label) : ct.note, ring: guides.has(pc), title: `${sn.note} · chord tone (${INTERVAL_NAME[ct.label]})${guides.has(pc) ? ' · guide tone' : ''}` };
      else if (!chord && sn.label === '1') mark = { kind: 'on', fn: 'root', text: label, title: `${sn.note} · root` };
      else mark = { kind: 'scale', fn: 'none', text: label, title: `${sn.note} · ${INTERVAL_NAME[sn.label] ?? sn.label}` };
      m.set(fk(s, f), mark);
    }
  });
  return m;
}

export function scaleKeyMarks(scale: ScaleInfo, chord: ChordInfo | null, lo = 36, hi = 84): KeyMarks {
  const m: KeyMarks = new Map();
  const noteOf = new Map(scale.notes.map(n => [n.pc, n]));
  for (let midi = lo; midi <= hi; midi++) {
    const sn = noteOf.get(midi % 12);
    if (!sn) continue;
    const ct = chord?.tones.find(t => t.pc === sn.pc);
    if (ct) m.set(midi, { kind: 'on', fn: ct.fn, text: ct.note });
    else if (!chord && sn.label === '1') m.set(midi, { kind: 'on', fn: 'root', text: sn.note });
    else m.set(midi, { kind: 'scale', fn: 'none', text: sn.note });
  }
  return m;
}

export { qi };
