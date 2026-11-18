// Hear a scale over a chord: backing chord + the scale played up and down.
import { infoOf, type ChordRef } from '../core/chords';
import type { LickNote } from '../core/licks';
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

/** Plain scale, root up one octave and back down. No randomness, so you hear the scale itself. */
export function scaleUpDown(scale: ScaleInfo, beats: number): LickNote[] {
  const semis = scale.scale.tones.map(t => t.semi);
  let root = LEAD_LO + ((scale.root - LEAD_LO) % 12 + 12) % 12;
  if (root + 12 > LEAD_HI) root -= 12;
  const up = [...semis, 12].map(x => root + x);
  const line = [...up, ...up.slice(0, -1).reverse()];
  const step = Math.min(0.5, beats / line.length);
  return line.map((midi, i) => ({ midi, at: i * step, dur: step * 0.95, vel: i === 0 || i === up.length - 1 ? 0.85 : 0.7 }));
}

let stopPreview: (() => void) | null = null;

/** Two bars: chord held underneath, scale played up and down over it. */
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
  scheduleLine(scaleUpDown(scale, beats), t0, spb, bus);
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
