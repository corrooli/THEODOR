import { describe, expect, test } from 'vitest';
import { Q, chordInfo, identify, infoOf, parseChordSymbol, qi } from './chords';
import { findVoicings, parseTab, pianoVoicing, tabString } from './voicings';
import { parseNoteList } from './lookup';
import { nameToPc } from './notes';

const STANDARD = [64, 59, 55, 50, 45, 40];
const DROP_D = [64, 59, 55, 50, 45, 38];
const pc = nameToPc;

function best(notes: string[]) {
  const r = identify(new Set(notes.map(pc)), pc(notes[0]))[0];
  return { ...r, symbol: chordInfo(r.root, r.qi, r.bass).symbol };
}
const symbols = (notes: string[], n = 6) =>
  identify(new Set(notes.map(pc)), pc(notes[0])).slice(0, n).map(r => chordInfo(r.root, r.qi, r.bass).symbol);
const voicings = (s: string, tuning = STANDARD, frets = 12) => {
  const c = parseChordSymbol(s)!;
  return findVoicings(c.root, qi(c.q), c.bass ?? c.root, tuning, frets);
};

describe('dictionary', () => {
  test('well formed and unique', () => {
    const seen = new Map<string, string>();
    for (const q of Q) {
      expect(q.tones[0].label).toBe('1');
      const pcs = q.tones.map(t => t.semi % 12);
      expect(new Set(pcs).size).toBe(pcs.length);
      const key = q.tones.map(t => `${t.semi % 12}${t.opt ? '?' : ''}`).sort().join(',');
      expect(seen.has(key), `${q.sym} duplicates ${seen.get(key)}`).toBe(false);
      seen.set(key, q.sym);
    }
  });
});

describe('identify', () => {
  test.each([
    [['C', 'E', 'G'], 'C'], [['A', 'C', 'E'], 'Am'], [['B', 'D', 'F'], 'Bdim'], [['C', 'E', 'G#'], 'Caug'],
    [['D', 'E', 'A'], 'Dsus2'], [['D', 'G', 'A'], 'Dsus4'], [['E', 'B'], 'E5'], [['G', 'B', 'D', 'F'], 'G7'],
    [['C', 'E', 'G', 'B'], 'Cmaj7'], [['A', 'C', 'E', 'G'], 'Am7'], [['B', 'D', 'F', 'A'], 'Bm7b5'],
    [['C', 'Eb', 'Gb', 'A'], 'Cdim7'], [['C', 'Eb', 'G', 'B'], 'Cm(maj7)'], [['C', 'E', 'G', 'A'], 'C6'],
    [['C', 'E', 'G', 'D'], 'Cadd9'], [['C', 'E', 'G', 'B', 'D'], 'Cmaj9'], [['G', 'B', 'D', 'F', 'A#'], 'G7#9'],
    [['E', 'G#', 'B', 'D', 'F'], 'E7b9'], [['F#', 'A#', 'C#', 'E', 'G#', 'D#'], 'F#13'], [['C', 'E', 'G', 'A', 'D'], 'C6/9'],
    [['C', 'E', 'Bb'], 'C7'], [['F', 'A', 'E'], 'Fmaj7'],
  ])('%j -> %s', (notes, want) => {
    const b = best(notes);
    expect(b.symbol).toBe(want);
    expect(b.type).toBe('exact');
  });

  test('bass decides', () => {
    expect(best(['C', 'E', 'G', 'A']).symbol).toBe('C6');
    expect(best(['A', 'C', 'E', 'G']).symbol).toBe('Am7');
    expect(best(['E', 'G', 'C']).symbol).toBe('C/E');
    expect(best(['F#', 'D', 'A']).symbol).toBe('D/F#');
  });

  test('slash chords and partials', () => {
    expect(symbols(['D', 'C', 'E', 'G'])).toContain('C/D');
    const p = best(['C', 'E']);
    expect(p.type).toBe('partial');
    expect(p.missReq).toEqual(['5']);
  });

  test('fuzz: every played note accounted for', () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 300; i++) {
      const pcs = new Set<number>();
      const n = 2 + Math.floor(rnd() * 4);
      while (pcs.size < n) pcs.add(Math.floor(rnd() * 12));
      const bass = [...pcs][0];
      for (const r of identify(pcs, bass)) {
        const info = chordInfo(r.root, r.qi, r.bass);
        for (const p of pcs) expect(info.pcs.has(p)).toBe(true);
      }
    }
  });
});

describe('spelling and parsing', () => {
  const spell = (s: string) => infoOf(parseChordSymbol(s)!).tones.map(t => t.note).join(' ');
  test('letter-correct', () => {
    expect(spell('Ebm')).toBe('Eb Gb Bb');
    expect(spell('Cdim7')).toBe('C Eb Gb Bbb');
    expect(spell('Gbmaj7')).toBe('Gb Bb Db F');
    expect(spell('E7b9b13')).toBe('E G# B D F C');
  });
  test('slash bass readable', () => {
    expect(chordInfo(3, qi('dim7'), 0).symbol).toBe('Ebdim7/C');
  });
  test.each(Object.entries({
    'CM7': 'Cmaj7', 'CΔ7': 'Cmaj7', 'C-7': 'Cm7', 'Cø': 'Cm7b5', 'C°7': 'Cdim7', 'C+': 'Caug', 'Csus': 'Csus4',
    'C69': 'C6/9', 'CmM7': 'Cm(maj7)', 'G7(b9)': 'G7b9', 'Fadd2': 'Fadd9', 'D/F#': 'D/F#', 'F♯m7♭5': 'F#m7b5',
  }))('%s -> %s', (input, want) => {
    expect(infoOf(parseChordSymbol(input)!).symbol).toBe(want);
  });
  test('rejects nonsense', () => {
    for (const bad of ['xyz', 'Cfoo', 'H7', '']) expect(parseChordSymbol(bad)).toBeNull();
  });
  test('note lists and tabs', () => {
    expect(parseNoteList('C E G Bb')).toEqual([48, 52, 55, 58]);
    expect(parseNoteList('C4, E4, G4')).toEqual([60, 64, 67]);
    expect(parseTab('x32010')).toEqual([0, 1, 0, 2, 3, -1]);
    expect(parseTab('8 10 10 9 8 8')).toEqual([8, 8, 9, 10, 10, 8]);
    expect(parseTab('E A D G', 4)).toBeNull();
    expect(parseTab('x355', 4)).toEqual([5, 5, 3, -1]);
  });
});

describe('voicings', () => {
  test('valid and playable', () => {
    for (const s of ['C', 'G', 'Am', 'F', 'Bm', 'D/F#', 'Cmaj7', 'E7#9', 'F#m7b5', 'G13', 'Bb', 'C/D', 'A5']) {
      const info = infoOf(parseChordSymbol(s)!);
      const list = voicings(s);
      expect(list.length, s).toBeGreaterThan(0);
      const required = info.tones.filter(t => !t.opt).map(t => t.pc);
      for (const v of list) {
        const sounding = v.frets.map((f, i) => (f >= 0 ? STANDARD[i] + f : null)).filter((x): x is number => x !== null);
        expect(Math.min(...sounding) % 12).toBe(info.bass);
        const hit = new Set(sounding.map(m => m % 12));
        for (const p of hit) expect(info.pcs.has(p)).toBe(true);
        for (const p of required) expect(hit.has(p)).toBe(true);
      }
    }
  });
  test.each([
    ['C', 'x32010', 1], ['G', '320003', 1], ['Am', 'x02210', 1], ['E', '022100', 1], ['D', 'xx0232', 1],
    ['F', '133211', 1], ['Am7', 'x02010', 1], ['Bm', 'x24432', 3], ['C', 'x35553', 5], ['E7#9', 'x7678x', 25],
  ] as const)('%s: %s in top %i', (sym, shape, n) => {
    const rank = voicings(sym).map(v => tabString(v.frets)).indexOf(shape);
    expect(rank).toBeGreaterThanOrEqual(0);
    expect(rank).toBeLessThan(n);
  });
  test('drop D uses low D; 4-string bass works', () => {
    expect(tabString(voicings('D', DROP_D)[0].frets)[0]).toBe('0');
    const bass = [43, 38, 33, 28];
    expect(voicings('A5', bass, 12).length).toBeGreaterThan(0);
  });
  test('piano voicing', () => {
    const c = parseChordSymbol('C9/E')!;
    const notes = pianoVoicing(c.root, qi(c.q), c.bass!);
    expect(notes[0] % 12).toBe(4);
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThan(notes[i - 1]);
  });
});
