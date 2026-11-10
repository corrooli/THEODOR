import { describe, expect, it } from 'vitest';
import { makeLick } from './licks';

const D_DORIAN = [2, 4, 5, 7, 9, 11, 0];
const DM7 = [2, 5, 9, 0];

describe('makeLick', () => {
  it('only uses scale notes inside the register and fills the bar', () => {
    const { notes } = makeLick({ scale: D_DORIAN, chord: DM7, guides: [5, 0], beats: 4, lo: 55, hi: 79, seed: 3 });
    expect(notes.length).toBeGreaterThan(2);
    for (const n of notes) {
      expect(D_DORIAN).toContain(n.midi % 12);
      expect(n.midi).toBeGreaterThanOrEqual(55);
      expect(n.midi).toBeLessThanOrEqual(79);
      expect(n.at).toBeLessThan(4);
    }
    expect(notes.map(n => n.at)).toEqual([...notes.map(n => n.at)].sort((a, b) => a - b));
  });

  it('is deterministic per seed', () => {
    const a = makeLick({ scale: D_DORIAN, chord: DM7, beats: 8, seed: 42 });
    const b = makeLick({ scale: D_DORIAN, chord: DM7, beats: 8, seed: 42 });
    expect(a).toEqual(b);
  });

  it('preview run plays every scale note', () => {
    const { notes } = makeLick({ scale: D_DORIAN, chord: DM7, beats: 8, run: true, seed: 1 });
    const pcs = new Set(notes.map(n => n.midi % 12));
    for (const pc of D_DORIAN) expect(pcs.has(pc)).toBe(true);
  });

  it('ends a step away from a guide tone of the next chord', () => {
    // Dm7 -> G7: guide tones B (11) and F (5)
    for (let seed = 1; seed < 20; seed++) {
      const { notes } = makeLick({ scale: D_DORIAN, chord: DM7, beats: 4, target: [11, 5], seed });
      const last = notes[notes.length - 1].midi % 12;
      const dist = Math.min(...[11, 5].map(t => Math.min((last - t + 12) % 12, (t - last + 12) % 12)));
      expect(dist).toBeGreaterThanOrEqual(1);
      expect(dist).toBeLessThanOrEqual(2);
    }
  });

  it('continues near the previous note', () => {
    const { notes } = makeLick({ scale: D_DORIAN, chord: DM7, beats: 4, from: 72, seed: 9 });
    expect(Math.abs(notes[0].midi - 72)).toBeLessThanOrEqual(4);
  });
});
