// Hear a scale over a chord: backing chord + generated demo line.
import { infoOf, type ChordRef } from '../core/chords';
import { guideTones } from '../core/chordScales';
import { makeLick, type LickNote } from '../core/licks';
import type { ScaleInfo } from '../core/scales';
import { pianoVoicing } from '../core/voicings';
import { audio, createBus, now, strum, voice } from './audio';
import { app } from './state.svelte';

/** Comfortable lead register (G3–G5). */
export const LEAD_LO = 55;
export const LEAD_HI = 79;

export function scheduleLine(notes: LickNote[], start: number, spb: number, dest: AudioNode) {
  for (const n of notes) voice(n.midi, start + n.at * spb, 'lead', n.vel, Math.max(0.08, n.dur * spb), dest);
}

let stopPreview: (() => void) | null = null;

/** Two bars: chord held underneath, a run through the scale, then a phrase landing on chord tones. */
export function previewScaleOverChord(chord: ChordRef, scale: ScaleInfo, bpm = app.song.tempo): () => void {
  stopPreview?.();
  const c = audio();
  const bus = createBus();
  const ci = infoOf(chord);
  const spb = 60 / Math.max(70, Math.min(150, bpm));
  const beats = 8;
  const t0 = now() + 0.08;
  const backing = pianoVoicing(ci.root, ci.qi, ci.bass, 48);
  for (const b of [0, 4]) {
    strum(backing, 'keys', { at: t0 + b * spb, vel: 0.42, dest: bus });
    voice(36 + (ci.bass % 12), t0 + b * spb, 'bass', 0.75, spb * 3.6, bus);
  }
  const { notes } = makeLick({
    scale: [...scale.pcs], chord: [...ci.pcs], guides: guideTones(chord), beats, run: true,
    lo: LEAD_LO, hi: LEAD_HI, seed: Math.floor(Math.random() * 1e9),
  });
  scheduleLine(notes, t0, spb, bus);
  const stop = () => {
    bus.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => bus.disconnect(), 200);
    if (stopPreview === stop) stopPreview = null;
  };
  stopPreview = stop;
  setTimeout(() => { if (stopPreview === stop) stopPreview = null; }, (beats * spb + 1) * 1000);
  return stop;
}

export function stopScalePreview() {
  stopPreview?.();
}
