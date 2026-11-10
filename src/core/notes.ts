// Pitch classes, note names and letter-correct spelling.

export const LETTERS = 'CDEFGAB';
export const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];
export const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Conventional root spellings for major-ish chords/keys */
export const ROOT_MAJ = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/** Conventional root spellings for minor-ish chords/keys */
export const ROOT_MIN = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];
export const BLACK_KEYS = [1, 3, 6, 8, 10];

export type SpellPref = 'flat' | 'sharp' | undefined;

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function nameToPc(name: string): number {
  let pc = LETTER_PC[LETTERS.indexOf(name[0].toUpperCase())];
  for (const c of name.slice(1)) {
    if (c === '#' || c === '♯') pc++;
    else if (c === 'b' || c === '♭') pc--;
  }
  return mod12(pc);
}

export function pcOf(letter: string, acc = ''): number {
  return nameToPc(letter + acc);
}

/** Is this a valid note name like C, F#, Bb, Ebb? */
export const isNoteName = (s: string) => /^[A-Ga-g](#{1,2}|b{1,2}|♯|♭)?$/.test(s);

/**
 * Spell the note `semi` semitones above `rootName`, as scale degree `deg` (1-based).
 * Example: spell('Eb', 3, 3) = 'Gb', spell('C', 9, 7) = 'Bbb'.
 */
export function spell(rootName: string, semi: number, deg: number): string {
  const L = (LETTERS.indexOf(rootName[0].toUpperCase()) + deg - 1) % 7;
  const target = mod12(nameToPc(rootName) + semi);
  let acc = mod12(target - LETTER_PC[L]);
  if (acc > 6) acc -= 12;
  if (Math.abs(acc) > 2) return SHARP[target];
  return LETTERS[L] + (acc > 0 ? '#'.repeat(acc) : 'b'.repeat(-acc));
}

/** Count accidentals in a list of note names (double accidentals count double). */
export const accidentalCount = (names: string[]) =>
  names.reduce((n, s) => n + (s.slice(1).match(/[#b]/g)?.length ?? 0), 0);

export function pcName(pc: number, pref?: SpellPref): string {
  return (pref === 'flat' ? FLAT : SHARP)[mod12(pc)];
}

export function midiName(midi: number, pref?: SpellPref): string {
  return pcName(midi, pref) + (Math.floor(midi / 12) - 1);
}

export const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Display form with real accidentals: Bb -> B♭, F# -> F♯, m7b5 -> m7♭5 */
export function pretty(s: string): string {
  return String(s)
    .replace(/([A-G])(b+)/g, (_m, l: string, bs: string) => l + '♭'.repeat(bs.length))
    .replace(/#/g, '♯')
    .replace(/b(\d)/g, '♭$1');
}

/** Normalize user-typed accidentals to ASCII. */
export const asciiAcc = (s: string) => s.replace(/♯/g, '#').replace(/♭/g, 'b');
