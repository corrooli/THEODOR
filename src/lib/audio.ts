// Web Audio engine: plucked guitar/bass, electric-piano keys, strums, arpeggios and a song scheduler.
import { midiToFreq } from '../core/notes';

export type Timbre = 'guitar' | 'bass' | 'keys' | 'pad' | 'lead';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.02);
}

function impulse(c: AudioContext, seconds = 1.6, decay = 3) {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function audio(): AudioContext {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    reverb = ctx.createConvolver();
    reverb.buffer = impulse(ctx);
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    master.connect(comp);
    master.connect(reverb);
    reverb.connect(wet);
    wet.connect(comp);
    comp.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const now = () => audio().currentTime;

/** A gain node routed into the master chain (respects mute + reverb). Disconnect it to silence everything sent to it. */
export function createBus(): GainNode {
  const c = audio();
  const g = c.createGain();
  g.connect(master!);
  return g;
}

/** Schedule one note. Returns nothing; voices clean themselves up. */
export function voice(midi: number, t: number, timbre: Timbre = 'guitar', vel = 0.8, dur?: number, dest?: AudioNode) {
  const c = audio();
  const f = midiToFreq(midi);
  const out = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  const o1 = c.createOscillator(), o2 = c.createOscillator(), g2 = c.createGain();
  let length: number;
  if (timbre === 'guitar' || timbre === 'bass') {
    const isBass = timbre === 'bass';
    o1.type = 'sawtooth';
    o2.type = isBass ? 'sine' : 'triangle';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(isBass ? f : f * 1.001, t);
    lp.Q.setValueAtTime(isBass ? 3 : 1.4, t);
    lp.frequency.setValueAtTime(Math.min(12000, f * (isBass ? 6 : 9)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * (isBass ? 1.2 : 1.4), isBass ? 120 : 220), t + (isBass ? 0.4 : 0.7));
    length = dur ?? (isBass ? 1.6 : 2.6);
    g2.gain.value = isBass ? 1.2 : 0.7;
    const peak = (isBass ? 0.22 : 0.15) * vel;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    out.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.3);
    out.gain.exponentialRampToValueAtTime(0.0001, t + length);
  } else if (timbre === 'lead') {
    // Singing mono lead for demo solo lines: soft attack, short sustain, gentle vibrato
    o1.type = 'sawtooth';
    o2.type = 'triangle';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f, t);
    o2.detune.setValueAtTime(-7, t);
    const lfo = c.createOscillator(), depth = c.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(f * 0.006, t + 0.25);
    lfo.connect(depth);
    depth.connect(o1.frequency);
    depth.connect(o2.frequency);
    lfo.start(t);
    lp.Q.setValueAtTime(2, t);
    lp.frequency.setValueAtTime(Math.min(9000, f * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2.5, 500), t + 0.25);
    length = dur ?? 0.5;
    g2.gain.value = 0.9;
    const peak = 0.13 * vel;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    out.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.12);
    out.gain.setValueAtTime(peak * 0.7, t + Math.max(0.13, length - 0.06));
    out.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.12);
    length += 0.12;
    lfo.stop(t + length + 0.05);
  } else if (timbre === 'pad') {
    o1.type = 'sawtooth';
    o2.type = 'sawtooth';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f, t);
    o2.detune.setValueAtTime(9, t);
    lp.frequency.setValueAtTime(Math.min(4000, f * 3), t);
    length = dur ?? 2;
    g2.gain.value = 0.8;
    const peak = 0.05 * vel;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.12);
    out.gain.setValueAtTime(peak, t + Math.max(0.13, length - 0.2));
    out.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.3);
    length += 0.3;
  } else {
    o1.type = 'triangle';
    o2.type = 'sine';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 2, t);
    lp.frequency.setValueAtTime(Math.min(10000, f * 7), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 2, 300), t + 1.4);
    length = dur ?? 2;
    g2.gain.value = 0.22;
    const peak = 0.2 * vel;
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    out.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.4);
    out.gain.exponentialRampToValueAtTime(0.0001, t + length);
  }
  o1.connect(lp);
  o2.connect(g2);
  g2.connect(lp);
  lp.connect(out);
  out.connect(dest ?? master!);
  o1.start(t);
  o2.start(t);
  o1.stop(t + length + 0.05);
  o2.stop(t + length + 0.05);
}

export function click(t: number, accent = false, dest?: AudioNode) {
  const c = audio();
  const o = c.createOscillator(), g = c.createGain();
  o.frequency.value = accent ? 1600 : 1100;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.25 : 0.12, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g);
  g.connect(dest ?? master!);
  o.start(t);
  o.stop(t + 0.06);
}

export function playNote(midi: number, timbre: Timbre = 'guitar', vel = 0.8) {
  voice(midi, now() + 0.005, timbre, vel);
}

/** Strum (or arpeggiate) a set of notes. Returns the per-note start offsets in seconds. */
export function strum(midis: number[], timbre: Timbre = 'guitar', opts: { arp?: boolean; down?: boolean; at?: number; vel?: number; dest?: AudioNode } = {}): number[] {
  const sorted = [...midis].sort((a, b) => (opts.down === false ? b - a : a - b));
  const step = opts.arp ? 0.16 : timbre === 'keys' || timbre === 'pad' ? 0.004 : 0.028;
  const t0 = opts.at ?? now() + 0.02;
  return sorted.map((m, i) => {
    voice(m, t0 + i * step, timbre, opts.vel ?? (opts.arp ? 0.8 : 0.72), undefined, opts.dest);
    return t0 + i * step - now();
  });
}

/** Play a scale up (and back down). */
export function playScale(midis: number[], timbre: Timbre = 'guitar', bpm = 160) {
  const step = 60 / bpm / 2;
  const seq = [...midis, midis[0] + 12, ...[...midis].reverse()];
  const t0 = now() + 0.03;
  seq.forEach((m, i) => voice(m, t0 + i * step, timbre, 0.7, 0.9));
  return seq.length * step;
}

// ---------- Song scheduler ----------
export interface ScheduledChord {
  /** notes to strum (guitar or keys voicing) */
  notes: number[];
  bass: number;
  beats: number;
}

export interface PlaybackOptions {
  bpm: number;
  loop: boolean;
  timbre: Timbre;
  /** 'strum' = strum on beat 1 and 3, 'pad' = sustained keys, 'comp' = jazz comping on 2 and 4 */
  feel: 'strum' | 'pad' | 'comp';
  metronome: boolean;
  bassLine: boolean;
  onChord?: (index: number) => void;
  onBeat?: (index: number, beat: number) => void;
  onEnd?: () => void;
  /** extra voice (e.g. a demo solo line) scheduled with each chord: start time, seconds per beat, output bus */
  lead?: (index: number, start: number, spb: number, bus: AudioNode) => void;
}

/** Plays a chord sequence with a lookahead scheduler. Returns a stop function. */
export function playSequence(chords: ScheduledChord[], opts: PlaybackOptions): () => void {
  const c = audio();
  const bus = c.createGain();
  bus.connect(master!);
  let stopped = false;
  const spb = 60 / opts.bpm;
  let t = c.currentTime + 0.1;
  let idx = 0;
  const timers: number[] = [];

  const at = (time: number, fn: () => void) => {
    const ms = Math.max(0, (time - c.currentTime) * 1000);
    timers.push(window.setTimeout(() => { if (!stopped) fn(); }, ms));
  };

  const scheduleChord = (i: number, start: number) => {
    const ch = chords[i];
    at(start, () => opts.onChord?.(i));
    opts.lead?.(i, start, spb, bus);
    for (let b = 0; b < ch.beats; b++) {
      const bt = start + b * spb;
      at(bt, () => opts.onBeat?.(i, b));
      if (opts.metronome) click(bt, b === 0, bus);
      if (opts.feel === 'strum') {
        if (b % 2 === 0) strum(ch.notes, opts.timbre, { at: bt, vel: b === 0 ? 0.8 : 0.6, dest: bus });
        else strum(ch.notes.slice(-3), opts.timbre, { at: bt + spb * 0.5, down: false, vel: 0.4, dest: bus });
      } else if (opts.feel === 'comp') {
        if (b % 2 === 1 || ch.beats === 1) strum(ch.notes, 'keys', { at: bt, vel: 0.55, dest: bus });
      }
      if (opts.bassLine) {
        const bassNote = ch.bass >= 40 ? ch.bass - 12 : ch.bass;
        if (b === 0) voice(bassNote, bt, 'bass', 0.9, spb * 1.8, bus);
        else if (opts.feel === 'comp') {
          // simple walking: root, chord tone, 5th, chromatic approach to the next root
          const next = chords[(i + 1) % chords.length];
          const nextBass = next.bass >= 40 ? next.bass - 12 : next.bass;
          const options = [bassNote + 7, bassNote + 12 > 52 ? bassNote + 4 : bassNote + 12, nextBass + (nextBass > bassNote ? -1 : 1)];
          voice(b === ch.beats - 1 ? options[2] : options[(b - 1) % 2], bt, 'bass', 0.75, spb * 0.95, bus);
        }
      }
    }
    if (opts.feel === 'pad') for (const m of ch.notes) voice(m, start, 'pad', 0.9, ch.beats * spb, bus);
  };

  // Lookahead loop: schedule chords ~1.5s ahead
  const tick = () => {
    if (stopped) return;
    while (t < c.currentTime + 1.5) {
      if (idx >= chords.length) {
        if (!opts.loop) {
          at(t, () => opts.onEnd?.());
          return;
        }
        idx = 0;
      }
      scheduleChord(idx, t);
      t += chords[idx].beats * spb;
      idx++;
    }
    timers.push(window.setTimeout(tick, 250));
  };
  if (chords.length) tick();
  else opts.onEnd?.();

  return () => {
    stopped = true;
    timers.forEach(clearTimeout);
    // Fade this sequence's bus and cut it, which also silences notes scheduled in the future
    bus.gain.setTargetAtTime(0, c.currentTime, 0.03);
    window.setTimeout(() => bus.disconnect(), 200);
  };
}
