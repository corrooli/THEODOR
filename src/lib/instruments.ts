// Instruments and tunings. Tuning arrays are MIDI numbers, index 0 = highest string.

export type InstrumentId = 'guitar' | 'bass';

export interface Tuning {
  name: string;
  group: string;
  notes: number[];
}

export const GUITAR_TUNINGS: Tuning[] = [
  { name: 'Standard E', group: 'Standard & downtuned', notes: [64, 59, 55, 50, 45, 40] },
  { name: 'Eb Standard', group: 'Standard & downtuned', notes: [63, 58, 54, 49, 44, 39] },
  { name: 'D Standard', group: 'Standard & downtuned', notes: [62, 57, 53, 48, 43, 38] },
  { name: 'C Standard', group: 'Standard & downtuned', notes: [60, 55, 51, 46, 41, 36] },
  { name: 'B Standard (Baritone)', group: 'Standard & downtuned', notes: [59, 54, 50, 45, 40, 35] },
  { name: 'Drop D', group: 'Drop', notes: [64, 59, 55, 50, 45, 38] },
  { name: 'Drop C#', group: 'Drop', notes: [63, 58, 54, 49, 44, 37] },
  { name: 'Drop C', group: 'Drop', notes: [62, 57, 53, 48, 43, 36] },
  { name: 'Drop B', group: 'Drop', notes: [61, 56, 52, 47, 42, 35] },
  { name: 'Drop A', group: 'Drop', notes: [59, 54, 50, 45, 40, 33] },
  { name: 'Open E', group: 'Open', notes: [64, 59, 56, 52, 47, 40] },
  { name: 'Open D', group: 'Open', notes: [62, 57, 54, 50, 45, 38] },
  { name: 'Open G', group: 'Open', notes: [62, 59, 55, 50, 43, 38] },
  { name: 'Open A', group: 'Open', notes: [64, 61, 57, 52, 45, 40] },
  { name: 'Open C', group: 'Open', notes: [64, 60, 55, 48, 43, 36] },
  { name: 'DADGAD', group: 'Alternative', notes: [62, 57, 55, 50, 45, 38] },
  { name: 'Double Drop D', group: 'Alternative', notes: [62, 59, 55, 50, 45, 38] },
  { name: 'FACGCE (Midwest Emo)', group: 'Alternative', notes: [64, 60, 55, 48, 45, 41] },
  { name: 'All Fourths', group: 'Alternative', notes: [65, 60, 55, 50, 45, 40] },
  { name: '7-String Standard', group: 'Extended range', notes: [64, 59, 55, 50, 45, 40, 35] },
  { name: '7-String Drop A', group: 'Extended range', notes: [64, 59, 55, 50, 45, 40, 33] },
];

export const BASS_TUNINGS: Tuning[] = [
  { name: '4-String Standard', group: '4-string', notes: [43, 38, 33, 28] },
  { name: '4-String Drop D', group: '4-string', notes: [43, 38, 33, 26] },
  { name: '4-String D Standard', group: '4-string', notes: [41, 36, 31, 26] },
  { name: '5-String Standard (B)', group: '5-string', notes: [43, 38, 33, 28, 23] },
  { name: '5-String High C', group: '5-string', notes: [48, 43, 38, 33, 28] },
  { name: '6-String Standard', group: '6-string', notes: [48, 43, 38, 33, 28, 23] },
];

export const tuningsFor = (inst: InstrumentId) => (inst === 'bass' ? BASS_TUNINGS : GUITAR_TUNINGS);
export function findTuning(inst: InstrumentId, name: string): Tuning {
  const list = tuningsFor(inst);
  return list.find(t => t.name === name) ?? list[0];
}
