// Shared playback transport for the Song and Solo views.
import { infoOf } from '../core/chords';
import { mod12 } from '../core/notes';
import { pianoVoicing } from '../core/voicings';
import { playSequence, type PlaybackOptions } from './audio';
import { chordMidis, instrumentTimbre } from './helpers';
import { app } from './state.svelte';
import type { SongChordItem } from './song';

export type Feel = PlaybackOptions['feel'];

class Transport {
  playing = $state(false);
  index = $state(-1);
  beat = $state(-1);
  loop = $state(true);
  metronome = $state(false);
  feel = $state<Feel>('strum');
  private stopFn: (() => void) | null = null;

  start(items: SongChordItem[], bpm: number, from = 0) {
    this.stop();
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
    this.playing = true;
    this.stopFn = playSequence(chords, {
      bpm, loop: this.loop, metronome: this.metronome, feel: this.feel,
      timbre: pad ? 'pad' : this.feel === 'comp' ? 'keys' : instrumentTimbre(),
      bassLine: app.settings.instrument !== 'bass',
      onChord: i => { this.index = i + from; app.playingId = items[i + from]?.id ?? null; },
      onBeat: (_i, b) => { this.beat = b; },
      onEnd: () => this.stop(),
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
