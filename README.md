# THEO·DOR

**Think outside the box, mate!**

THEODOR (THEOry + DORian) is a music theory workbench for guitarists, bassists and bands who want to take songs apart, name what they hear, and break out of pentatonic monotony. It covers blues and pop basics through to jazz and fusion harmony, and you set how deep it goes.

👉 **Live app: https://corrooli.github.io/THEODOR/**

## What it does

- **Identify** (reverse chord & scale search): tap notes on the fretboard or piano, type a tab (`x32010`) or note names (`C E G Bb`), or play a MIDI keyboard. You get the chord name, other ways to name it, and every scale that contains those notes.
- **Lookup** (`⌘K` or `/` from anywhere): one box for forward and reverse search. Type a chord (`F#m7b5`), a scale (`E altered`), notes, a tab or a whole progression (`Dm7 G7 Cmaj7`).
- **Song**: build songs out of sections, with automatic key detection, Roman numerals and harmonic function colours. Each chord gets a plain-English note on why it works (secondary dominants, tritone subs, borrowed chords…), plus recognised patterns. Tap a chord for reharmonisation ideas you can **hear before you use**.
- **Explore**: a harmony board for any key. Diatonic chords, secondary dominants, related iis, tritone subs, passing diminished chords, modal interchange and fusion colours, all in one grid. Sketch a progression and send it to a song.
- **Solo**: loop the song and see which notes to play over each chord on the neck. Chord tones and guide tones are highlighted, and you can lock the view to one position. Hit *Break the box* to get a different colour on every chord.
- **Depth levels**: *Blues Lawyer* (essentials in plain words), *Jazz Cat* (modes, extensions, subs) and *Fusion Wizard* (melodic/harmonic minor modes, altered and symmetric scales).
- **Guitar & bass first**: many tunings (drop, open, 7-string, 4/5/6-string bass), left-handed mode, playable voicing finder. Piano too.
- **Your data stays yours**: no account and no server. Songs live in your browser. You can share them as links (the whole song is packed into the URL) or as JSON files.

## Development

```bash
npm install
npm run dev        # http://localhost:5173/THEODOR/
npm test           # unit tests (theory engine, song format)
npm run check      # svelte-check / TypeScript
npm run test:e2e   # Playwright (set CHROMIUM_PATH to use a local Chromium)
npm run build      # static build in dist/
```

Stack: Svelte 5 + TypeScript + Vite. The theory engine (`src/core/`) is plain TypeScript with no dependencies. Pushes to `main` are tested and deployed to GitHub Pages by GitHub Actions.

Share links are versioned (`#/song?s=1.<data>`). A link created today has to keep working, so `src/lib/song.ts` migrates old formats and a frozen v1 link is covered by tests.

## License

Code: [GNU AGPL-3.0](LICENSE). You may use, study, modify and share it. If you run a modified version as a service, you must publish your source too.

**Trademark note:** the name "THEODOR" and the THEO·DOR logo are not licensed under the AGPL. Forks are welcome, but please give yours a different name and logo.

If THEODOR helps your band, you can [buy me a coffee ☕](https://ko-fi.com/olivercorrodi).
