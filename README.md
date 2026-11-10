<p align="center">
  <a href="https://corrooli.github.io/THEODOR/"><img src="docs/banner.png" alt="THEODOR: Think outside the box, mate!" width="100%"></a>
</p>

<p align="center">
  <a href="https://corrooli.github.io/THEODOR/"><img src="docs/open-button.png" alt="Open THEODOR, it's free" height="64"></a>
</p>

<p align="center">
  <a href="https://github.com/corrooli/THEODOR/actions/workflows/ci.yml"><img src="https://github.com/corrooli/THEODOR/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/license-AGPL--3.0-9b6bff" alt="AGPL-3.0">
  <img src="https://img.shields.io/badge/no%20account-no%20tracking-ff5e7e" alt="No account, no tracking">
  <img src="https://img.shields.io/badge/works%20on-desktop%20%26%20phone-ffb347" alt="Desktop and phone">
</p>

<p align="center"><b>THEO</b>ry + <b>DOR</b>ian. A music theory workbench for guitarists, bassists and bands.<br>
Name what you hear, take songs apart, and break out of pentatonic monotony.</p>

---

## 🎸 What you can do

| | |
|---|---|
| <img src="docs/screenshots/identify.png" alt="Identify view"> | ### 🎯 Identify<br>Tap the fretboard or piano, type a tab (`x32010`) or notes (`C E G Bb`), play your **MIDI keyboard** or use your computer keyboard. You get the chord name, other ways to name it, and **every scale** those notes fit in.<br><br>Open the **chord inspector** to change the bass note (inversions), step through playable voicings and **transpose** by a semitone. |
| ### 🧱 Song<br>Build songs out of sections. THEODOR **finds the key**, writes the **Roman numerals**, colours each chord by its job (home, away, tension) and explains in plain English **why it works**: secondary dominants, tritone subs, borrowed chords…<br><br>Tap any chord for **reharm ideas** you can **hear before you use them**. | <img src="docs/screenshots/song.png" alt="Song view"> |
| <img src="docs/screenshots/explore.png" alt="Explore view"> | ### ✨ Explore<br>A **harmony board** for any key: diatonic chords, secondary dominants, related iis, tritone subs, passing diminished chords, borrowed chords and fusion colours, all in one grid. After a dominant, the chord it resolves to **lights up**. Sketch a progression, then send it to a song. |
| ### 〰️ Solo<br>Loop the song and see **what to play over each chord** on the neck. Chord tones and guide tones are highlighted, and you can lock it to one position.<br><br>Press ▶ on any scale to **hear it over the chord**, or turn on the **demo solo line**. *Break the box* gives every chord its own colour. | <img src="docs/screenshots/solo.png" alt="Solo view"> |

<p align="center">
  <img src="docs/screenshots/lookup.png" alt="Universal lookup" width="68%">
  &nbsp;
  <img src="docs/screenshots/mobile.png" alt="THEODOR on a phone" width="24%">
</p>
<p align="center"><sub><b>⌘K</b> or <b>/</b> anywhere: one box for forward <i>and</i> reverse chord &amp; scale search. And it all works on your phone too.</sub></p>

## 🔁 How it fits together

```mermaid
flowchart LR
    A["🎯 <b>Identify</b><br/>play or type notes"] -->|add to song| B["🧱 <b>Song</b><br/>key · numerals · why"]
    B -->|tap a chord| C["💡 <b>Ideas</b><br/>hear & apply reharms"]
    C --> B
    B --> D["✨ <b>Explore</b><br/>harmony board"]
    D -->|sketch| B
    B --> E["〰️ <b>Solo</b><br/>scales · guide tones · demo lines"]
    L["🔎 <b>⌘K Lookup</b><br/>chords · scales · notes · tabs"] -.-> A & B & D
    B <-->|share link · JSON| F["🎸 your band"]

    classDef core fill:#1a1b26,stroke:#ff5e7e,color:#eceef6,stroke-width:2px
    classDef side fill:#1a1b26,stroke:#9b6bff,color:#eceef6
    class A,B,D,E core
    class C,L,F side
```

## 🎚️ Pick your depth

The same app works for a beginner and for a jazz nerd. Depth decides which scales, chords and ideas THEODOR suggests. You can always look up anything.

```mermaid
flowchart LR
    subgraph L1["⚖️ Blues Lawyer"]
      direction TB
      a1["Major / minor / pentatonic / blues"]
      a2["Secondary dominants, borrowed chords"]
      a3["Plain-English explanations"]
    end
    subgraph L2["🐈‍⬛ Jazz Cat"]
      direction TB
      b1["Modes & 7th-chord harmony"]
      b2["ii–V–I, tritone subs, related iis"]
      b3["Extensions, bebop scales"]
    end
    subgraph L3["🧙 Fusion Wizard"]
      direction TB
      c1["Melodic & harmonic minor modes"]
      c2["Altered, diminished, whole-tone"]
      c3["Modal colours, outside sounds"]
    end
    L1 ==> L2 ==> L3
    style L1 fill:#2a1f14,stroke:#ffb347,color:#eceef6
    style L2 fill:#2a1420,stroke:#ff5e7e,color:#eceef6
    style L3 fill:#1d1630,stroke:#9b6bff,color:#eceef6
```

## 📦 What's inside

<table>
<tr>
<td align="center"><h3>59</h3>chord types<br><sub>triads → 13♯11</sub></td>
<td align="center"><h3>47</h3>scales &amp; modes<br><sub>with plain-English vibes</sub></td>
<td align="center"><h3>20+</h3>named progressions<br><sub>ii–V–I, Axis, Andalusian…</sub></td>
<td align="center"><h3>27</h3>tunings<br><sub>drop, open, 7-string, bass 4/5/6</sub></td>
<td align="center"><h3>0</h3>accounts<br><sub>everything stays in your browser</sub></td>
</tr>
</table>

- **Guitar & bass first.** Real fret spacing, left-handed mode and a voicing finder that checks fingers, barres and string skips. Piano too.
- **Voicing-aware sound.** Strum, jazz comping or pads, with a bass line and a click. Hear every idea in context before you commit to it.
- **Share with your band.** The whole song is packed into the link (`#/song?s=1.…`). JSON export and import also work. Links are versioned and old ones will keep working.
- **Private by design.** No backend, no tracking. Install it to your home screen like an app.

## 🛠️ Development

```bash
npm install
npm run dev        # http://localhost:5173/THEODOR/
npm test           # unit tests: theory engine, song format, lick generator
npm run check      # svelte-check / TypeScript
npm run test:e2e   # Playwright, desktop + phone (CHROMIUM_PATH=… to use a local Chromium)
npm run build      # static site in dist/
```

```mermaid
flowchart LR
    core["<b>src/core</b><br/>pure TypeScript theory engine<br/>chords · scales · voicings · analysis · ideas · licks"]
    lib["<b>src/lib</b><br/>state · audio · songs · share links"]
    ui["<b>src/ui + src/views</b><br/>Svelte 5 components"]
    core --> lib --> ui
    ui --> pages["GitHub Pages<br/>(static, deployed by Actions)"]
```

Stack: **Svelte 5 + TypeScript + Vite**. The theory engine in `src/core/` has no dependencies and is fully unit-tested. Every push to `main` is checked, tested in a real browser and deployed to GitHub Pages.

## ⚖️ License

The code is licensed under the [GNU AGPL-3.0](LICENSE). You may use, study, change and share it. If you run a modified version as a public service, you must publish your source code too.

**Trademark note:** the name **THEODOR** and the THEO·DOR logo are *not* licensed under the AGPL. Forks are welcome, but please give yours its own name and logo.

<p align="center">
  <br>
  <a href="https://corrooli.github.io/THEODOR/"><img src="public/icons/icon-192.png" width="72" alt="THEODOR icon"></a><br>
  <b>Think outside the box, mate!</b><br>
  <sub>If THEODOR helps your band, <a href="https://ko-fi.com/olivercorrodi">buy me a coffee ☕</a></sub>
</p>
