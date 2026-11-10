import { describe, expect, test } from 'vitest';
import { parseChordSymbol, infoOf, type ChordRef } from './chords';
import { SCALES, diatonicChords, identifyScales, parseScale, scaleInfo, si } from './scales';
import { analyzeSong, detectKey, detectPatterns, keyName, romanNumeral, type SongChord } from './analysis';
import { ideasFor, applyIdea } from './ideas';
import { scalesForChord, guideTones } from './chordScales';
import { interpret, suggest } from './lookup';

const song = (s: string, beats = 4): SongChord[] => s.split(/\s+/).map(sym => ({ ref: parseChordSymbol(sym)!, beats }));
const C = (s: string) => parseChordSymbol(s)!;

describe('scales', () => {
  test('every scale is well formed', () => {
    const ids = new Set<string>();
    for (const s of SCALES) {
      expect(ids.has(s.id)).toBe(false);
      ids.add(s.id);
      expect(s.tones[0].label).toBe('1');
      expect(new Set(s.semis.map(x => x % 12)).size).toBe(s.semis.length);
      for (let i = 1; i < s.semis.length; i++) expect(s.semis[i]).toBeGreaterThan(s.semis[i - 1]);
    }
  });
  test('modes really are rotations of their parent', () => {
    for (const s of SCALES.filter(s => s.parent)) {
      const [pid, deg] = s.parent!;
      const p = SCALES[si(pid)];
      const offset = p.semis[deg - 1];
      const rotated = p.semis.map(x => (x - offset + 12) % 12).sort((a, b) => a - b);
      expect(rotated, s.name).toEqual(s.semis);
    }
  });
  test('spelling', () => {
    const notes = (root: number, id: string) => scaleInfo(root, si(id)).notes.map(n => n.note).join(' ');
    expect(notes(2, 'dorian')).toBe('D E F G A B C');
    expect(notes(10, 'ionian')).toBe('Bb C D Eb F G A');
    expect(notes(6, 'ionian')).toBe('F# G# A# B C# D# E#');
    expect(notes(3, 'aeolian')).toBe('Eb F Gb Ab Bb Cb Db');
    expect(notes(4, 'altered')).toBe('E F G G# Bb C D');
    expect(notes(9, 'minor-pentatonic')).toBe('A C D E G');
  });
  test('parse scale names and aliases', () => {
    expect(parseScale('D dorian')).toEqual({ root: 2, id: 'dorian' });
    expect(parseScale('e altered')).toEqual({ root: 4, id: 'altered' });
    expect(parseScale('Bb harmonic minor')).toEqual({ root: 10, id: 'harmonic-minor', pref: 'flat' });
    expect(parseScale('A min pent')?.id).toBe('minor-pentatonic');
    expect(parseScale('G super locrian')?.id).toBe('altered');
    expect(parseScale('C major')?.id).toBe('ionian');
    expect(parseScale('Cmaj7')).toBeNull();
  });
  test('reverse scale search', () => {
    const r = identifyScales(new Set([0, 2, 4, 5, 7, 9, 11]), 0);
    expect(SCALES[r[0].si].id).toBe('ionian');
    expect(r[0].root).toBe(0);
    const top = identifyScales(new Set([9, 0, 2, 4, 7]), 9).slice(0, 3).map(m => SCALES[m.si].id);
    expect(top).toContain('minor-pentatonic');
  });
  test('harmonise C major', () => {
    expect(diatonicChords(0, si('ionian')).map(c => c.symbol)).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7b5']);
    expect(diatonicChords(0, si('ionian')).map(c => c.roman)).toEqual(['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7']);
    expect(diatonicChords(0, si('melodic-minor')).map(c => c.symbol)).toEqual(['Cm(maj7)', 'Dm7', 'Ebmaj7#5', 'F7', 'G7', 'Am7b5', 'Bm7b5']);
  });
});

describe('key detection', () => {
  test.each([
    ['C G Am F', 'C major'],
    ['Am F C G', 'C major'],
    ['Am Dm E7 Am', 'A minor'],
    ['Dm7 G7 Cmaj7', 'C major'],
    ['Em C G D', 'G major'],
    ['Bm G D A', 'D major'],
    ['Cm Ab Bb Cm', 'C minor'],
    ['F#m D A E', 'A major'],
    ['Dm Bb C Dm', 'D minor'],
    ['G7 C7 G7 D7 C7 G7', 'G major'],
  ])('%s -> %s', (prog, want) => {
    expect(keyName(detectKey(song(prog))[0].key)).toBe(want);
  });
});

describe('roman numerals and roles', () => {
  test('numerals', () => {
    expect(romanNumeral(C('Dm7'), 0)).toBe('ii7');
    expect(romanNumeral(C('G7'), 0)).toBe('V7');
    expect(romanNumeral(C('Bm7b5'), 0)).toBe('viiø7');
    expect(romanNumeral(C('Bb'), 0)).toBe('♭VII');
    expect(romanNumeral(C('Fm6'), 0)).toBe('iv6');
  });
  test('roles in context', () => {
    const a = analyzeSong(song('C A7 Dm7 G7 C'), { tonic: 0, mode: 'major' });
    expect(a.map(x => x.role)).toEqual(['diatonic', 'secondary-dominant', 'diatonic', 'diatonic', 'diatonic']);
    expect(a[1].roman).toBe('V7/ii');
    expect(a[3].fn).toBe('D');
    const t = analyzeSong(song('Dm7 Db7 Cmaj7'), { tonic: 0, mode: 'major' });
    expect(t[1].role).toBe('tritone-sub');
    const b = analyzeSong(song('C Fm C'), { tonic: 0, mode: 'major' });
    expect(b[1].role).toBe('borrowed');
    const p = analyzeSong(song('C C#dim7 Dm7'), { tonic: 0, mode: 'major' });
    expect(p[1].role).toBe('passing-dim');
  });
  test('named patterns', () => {
    const names = (prog: string, tonic = 0, mode: 'major' | 'minor' = 'major') =>
      detectPatterns(song(prog), { tonic, mode }).map(h => h.name);
    expect(names('Dm7 G7 Cmaj7')).toContain('ii–V–I');
    expect(names('C G Am F')).toContain('Pop axis');
    expect(names('C Am F G')).toContain('50s / Doo-wop');
    expect(names('Am G F E', 9, 'minor')).toContain('Andalusian cadence');
    expect(names('Fm7 Bb7 Cmaj7')).toContain('Backdoor ii–V');
    expect(names('Em7 A7 Dm7 G7 Cmaj7')).toContain('Circle of fifths');
    expect(names('C7 F7 C7 G7 F7 C7')).toContain('Blues');
    expect(names('Dm G Dm G', 2, 'minor')).toContain('Dorian vamp');
  });
});

describe('ideas', () => {
  const key = { tonic: 0, mode: 'major' as const };
  test('dominant gets tritone sub and alterations', () => {
    const ideas = ideasFor(C('G7'), key, C('Cmaj7'));
    const titles = ideas.map(i => i.title);
    expect(titles).toContain('Tritone sub');
    expect(ideas.find(i => i.title === 'Tritone sub')!.chords.map(c => infoOf(c).symbol)).toEqual(['Db7']);
    expect(titles).toContain('Backdoor ii–V');
  });
  test('approach ideas target the next chord', () => {
    const ideas = ideasFor(C('C'), key, C('Am7'));
    const sec = ideas.find(i => i.title.startsWith('Secondary dominant'))!;
    expect(infoOf(sec.chords[0]).symbol).toBe('E7');
    const iiV = ideas.find(i => i.title.startsWith('ii–V'))!;
    expect(iiV.chords.map(c => infoOf(c).symbol)).toEqual(['Bm7b5', 'E7b9']);
  });
  test('level filters jazz/fusion ideas for blues lawyers', () => {
    const basic = ideasFor(C('G7'), key, C('C'), 'basic');
    expect(basic.every(i => i.level === 'basic')).toBe(true);
    expect(basic.length).toBeGreaterThan(0);
    expect(ideasFor(C('G7'), key, C('C'), 'fusion').length).toBeGreaterThan(basic.length);
  });
  test('ideas never suggest the same chord', () => {
    for (const s of ['C', 'Am', 'G7', 'Fmaj7', 'Dm7', 'E7', 'Bm7b5', 'C5']) {
      for (const i of ideasFor(C(s), key, C('C'))) {
        if (i.kind === 'replace' && i.chords.length === 1) expect(infoOf(i.chords[0]).symbol).not.toBe(infoOf(C(s)).symbol);
      }
    }
  });
  test('applyIdea keeps total length for replacements and inserts approach chords', () => {
    const chords = song('C Am7');
    const idea = ideasFor(C('C'), key, C('Am7')).find(i => i.title.startsWith('Secondary dominant'))!;
    const out = applyIdea(chords, 0, idea, (ref, beats) => ({ ref, beats }));
    expect(out.map(c => infoOf(c.ref).symbol)).toEqual(['C', 'E7', 'Am7']);
    expect(out.reduce((n, c) => n + c.beats, 0)).toBe(8);
  });
});

describe('chord scales', () => {
  const key = { tonic: 0, mode: 'major' as const };
  const names = (s: string, next?: string) => scalesForChord(C(s), key, next ? C(next) : undefined).map(x => x.name);
  test('key mode first', () => {
    expect(names('Dm7')[0]).toBe('D Dorian');
    expect(names('Em7')[0]).toBe('E Phrygian');
    expect(names('Fmaj7')[0]).toBe('F Lydian');
    expect(names('G7')[0]).toBe('G Mixolydian');
  });
  test('altered dominants and minor resolution', () => {
    expect(names('G7#5#9')[0]).toBe('G Altered (Super Locrian)');
    expect(names('E7', 'Am7').slice(0, 2)).toEqual(['E Phrygian Dominant', 'E Altered (Super Locrian)']);
    expect(names('Bm7b5')).toContain('B Locrian');
  });
  test('every suggested scale contains all chord tones', () => {
    for (const s of ['C', 'Am7', 'G13', 'E7b9', 'F#m7b5', 'Bbmaj7#11', 'Ddim7', 'Caug', 'A7sus4', 'Cm(maj7)']) {
      const ci = infoOf(C(s));
      for (const choice of scalesForChord(C(s))) {
        const pcs = scaleInfo(choice.ref.root, si(choice.ref.id)).pcs;
        for (const t of ci.tones.filter(t => !t.opt)) expect(pcs.has(t.pc), `${s} / ${choice.name}`).toBe(true);
      }
    }
  });
  test('guide tones', () => {
    expect(guideTones(C('G7')).sort((a, b) => a - b)).toEqual([5, 11]);
    expect(guideTones(C('C6')).sort((a, b) => a - b)).toEqual([4, 9]);
  });
});

describe('lookup', () => {
  const kinds = (q: string) => interpret(q).map(i => i.kind);
  test('interprets input', () => {
    expect(kinds('Cmaj7')).toEqual(['chord']);
    expect(kinds('D dorian')).toEqual(['scale']);
    expect(kinds('x32010')).toEqual(['tab']);
    expect(kinds('C E G Bb')).toEqual(['notes', 'progression']);
    expect(kinds('Dm7 G7 Cmaj7')).toEqual(['progression']);
    expect(kinds('nonsense')).toEqual([]);
  });
  test('suggestions while typing', () => {
    expect(suggest('dor')[0].label).toBe('C Dorian');
    expect(suggest('E alt').map(s => s.label)).toContain('E Altered (Super Locrian)');
    expect(suggest('Bb m7')[0].label).toBe('Bbm7');
    expect(suggest('F# maj7').map(s => s.label)).toContain('F#maj7');
    expect(suggest('altered', 'basic')).toEqual([]);
  });
});

void (null as unknown as ChordRef);
