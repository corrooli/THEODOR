// Interval labels, names and harmonic function colours.

/** label -> [semitones above root, scale degree] */
export const DEG: Record<string, [number, number]> = {
  '1': [0, 1], 'b2': [1, 2], '2': [2, 2], '#2': [3, 2], 'b3': [3, 3], '3': [4, 3], 'b4': [4, 4], '4': [5, 4], '#4': [6, 4],
  'b5': [6, 5], '5': [7, 5], '#5': [8, 5], 'b6': [8, 6], '6': [9, 6],
  'bb7': [9, 7], 'b7': [10, 7], '7': [11, 7],
  'b9': [13, 9], '9': [14, 9], '#9': [15, 9], '11': [17, 11], '#11': [18, 11],
  'b13': [20, 13], '13': [21, 13],
};

export const INTERVAL_NAME: Record<string, string> = {
  '1': 'Root', 'b2': 'Minor 2nd', '2': 'Major 2nd', '#2': 'Augmented 2nd', 'b3': 'Minor 3rd', '3': 'Major 3rd',
  'b4': 'Diminished 4th', '4': 'Perfect 4th', '#4': 'Augmented 4th', 'b5': 'Diminished 5th', '5': 'Perfect 5th', '#5': 'Augmented 5th',
  'b6': 'Minor 6th', '6': 'Major 6th', 'bb7': 'Diminished 7th', 'b7': 'Minor 7th', '7': 'Major 7th',
  'b9': 'Minor 9th', '9': 'Major 9th', '#9': 'Augmented 9th', '11': 'Perfect 11th', '#11': 'Augmented 11th',
  'b13': 'Minor 13th', '13': 'Major 13th',
};

export const SIMPLE_INTERVALS = ['Unison', 'Minor 2nd', 'Major 2nd', 'Minor 3rd', 'Major 3rd', 'Perfect 4th',
  'Tritone', 'Perfect 5th', 'Minor 6th', 'Major 6th', 'Minor 7th', 'Major 7th'];

/** How deep the app goes. Everything is tagged with the level where it starts to matter. */
export type Level = 'basic' | 'jazz' | 'fusion';
export const LEVELS: { id: Level; name: string; blurb: string }[] = [
  { id: 'basic', name: 'Blues Lawyer', blurb: 'The essentials, in plain words.' },
  { id: 'jazz', name: 'Jazz Cat', blurb: 'Modes, extensions, ii–V–Is and substitutions.' },
  { id: 'fusion', name: 'Fusion Wizard', blurb: 'Melodic & harmonic minor modes, altered sounds, symmetric scales.' },
];
export const levelRank = (l: Level) => (l === 'basic' ? 0 : l === 'jazz' ? 1 : 2);
export const withinLevel = (item: Level, setting: Level) => levelRank(item) <= levelRank(setting);

/** Colour family of a tone within a chord. */
export type Fn = 'root' | 'third' | 'fifth' | 'seventh' | 'ext' | 'bass' | 'none';

export function fnOf(label: string): Fn {
  if (label === '1') return 'root';
  if (label === '3' || label === 'b3') return 'third';
  if (/^[b#]?5$/.test(label)) return 'fifth';
  if (/^(bb|b)?7$/.test(label)) return 'seventh';
  return 'ext';
}

export interface Tone {
  label: string;
  semi: number;
  deg: number;
  opt: boolean;
}

/** Parse "1 3 (5) b7" into tones; parenthesised tones are optional. */
export function parseFormula(formula: string): Tone[] {
  return formula.split(/\s+/).filter(Boolean).map(tok => {
    const opt = tok.startsWith('(');
    const label = tok.replace(/[()]/g, '');
    const d = DEG[label];
    if (!d) throw new Error(`Unknown interval label "${label}" in "${formula}"`);
    return { label, semi: d[0], deg: d[1], opt };
  });
}
