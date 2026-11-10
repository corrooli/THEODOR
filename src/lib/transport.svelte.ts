// Shared playback transport for the Song and Solo views.
import { infoOf } from '../core/chords';
import { mod12 } from '../core/notes';
import { pianoVoicing } from '../core/voicings';
import { playSequence, type PlaybackOptions } from './audio';
import { chordMidis, instrumentTimbre } from './helpers';
import { app } from './state.svelte';
import type { SongChordItem } from './song';
import { makeLick } from '../core/licks';
import { LEAD_HI, LEAD_LO, scheduleLine, stopScalePreview } from './soloDemo';

/** What the demo solo line should play over chord i. */
export type LeadSpec = (i: number) => { scale: number[]; chord: number[]; guides: number[]; target?: number[] } | null;

export type Feel = PlaybackOptions['feel'];

class Transport {
  playing = $state(false);
  index = $state(-1);
  beat = $state(-1);
  loop = $state(true);
  metronome = $state(false);
  feel = $state<Feel>('strum');
  private stopFn: (() => void) | null = null;

  start(items: SongChordItem[], bpm: number, from = 0, lead?: LeadSpec) {
    this.stop();
    stopScalePreview();
    if (!items.length) return;
    const seq = items.slice(from);
    const pad = this.feel === 'pad';
    const chords = seq.map(it => {
      const ci = infoOf(it.ref);
      return {
        notes: pad ? pianoVoicing(ci.root, ci.qi, ci.bass, 48) : chordMidis(it.ref),
        bass: 36 + mod12(ci.bass),
        beats: it.beats,
      };
    });
    let lastNote: number | undefined;
    let seed = Math.floor(Math.random() * 1000);
    this.playing = true;
    this.stopFn = playSequence(chords, {
      bpm, loop: this.loop, metronome: this.metronome, feel: this.feel,
      timbre: pad ? 'pad' : this.feel === 'comp' ? 'keys' : instrumentTimbre(),
      bassLine: app.settings.instrument !== 'bass',
      onChord: i => { this.index = i + from; app.playingId = items[i + from]?.id ?? null; },
      onBeat: (_i, b) => { this.beat = b; },
      onEnd: () => this.stop(),
      lead: lead ? (i, start, spb, bus) => {
        const spec = lead(i + from);
        if (!spec) return;
        const { notes, last } = makeLick({ ...spec, beats: seq[i].beats, from: lastNote, lo: LEAD_LO, hi: LEAD_HI, seed: ++seed * 7919 });
        lastNote = last;
        scheduleLine(notes, start, spb, bus);
      } : undefined,
    });
  }

  stop() {
    this.stopFn?.();
    this.stopFn = null;
    this.playing = false;
    this.index = -1;
    this.beat = -1;
    app.playingId = null;
  }
}

export const transport = new Transport();
