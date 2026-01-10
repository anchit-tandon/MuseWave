Composition Plan — Auto mode

Project metadata
- Total duration: 180 seconds (3:00)
- Video: disabled (audio-only)
- Genres: synthwave, chillwave
- Vocal mode: none (instrumental)
- Output: Master WAV (48 kHz / 24-bit), MP3, stems (WAV), MIDI (not generated in this run)

High level brief
An instrumental synthwave piece: late-night neon city drive — reflective and hopeful. Warm analog pads, steady four-on-the-floor kick, mono bass with light side-chain ducking, a memorable lead hook, and tasteful risers/impacts at section changes. Energy curve: Intro (low) -> Build -> Peak at final chorus -> Controlled outro.

Global settings
- Tempo (BPM): 120
- Time signature: 4/4
- Key: A minor (notes: A, B, C, D, E, F, G)
- Sample rate: 48000 Hz
- Bit depth: 24-bit (export as 32-bit float then convert to 24-bit PCM)

Structure & exact timings (bar-based)
- Bar length: 2.0 s (4 beats @ 120 BPM)
- Total bars: 90 (90 * 2s = 180s)

Sections (bars / seconds / start-end)
1) Intro — 8 bars — 16 s — 0:00–0:16
   - Sparse pad, soft pulse, filtered arpeggio, simple hat pattern.
2) Verse A — 16 bars — 32 s — 0:16–0:48
   - Add kick, bass sketch (sub), chord stabs, light lead motif.
3) Build / Pre-Chorus — 8 bars — 16 s — 0:48–1:04
   - Rising filter, riser FX, snare roll, energy rising.
4) Chorus / Drop — 24 bars — 48 s — 1:04–1:52
   - Full drums, bass side-chained, main lead hook, wider pads.
5) Verse B (variation) — 12 bars — 24 s — 1:52–2:16
   - Variation of Verse A (different melody, added counter-rhythm).
6) Final Chorus / Peak — 18 bars — 36 s — 2:16–2:52
   - Highest density, extra lead harmony layer, impact on first bar.
7) Outro — 4 bars — 8 s — 2:52–3:00
   - Gradual filter down, remove percussion, pad tail.

Chord progression (4-bar loop)
- Primary: Am | F | C | G  (repeat) — suits synthwave; plays across sections; lead melody uses A minor pentatonic.

Instrumentation & roles
- Drums: electronic kick (4/4), clap/snare on 2/4, closed hi-hat 8th notes, open hat + percussion fills in chorus. Snare rolls in builds.
- Bass: mono sub-saw/sine with envelope; side-chain ducking relative to kick (simulated in stems by ducking envelope).
- Harmonic layer: warm pad (slow attack), electric piano/synth keys for chords, light arpeggio in intro and builds.
- Lead: single dominant melodic hook (sine/saw hybrid) with slight vibrato and saturation.
- FX: risers before chorus, impact at chorus start, short reverse cymbal transitions.

Mix guidance
- Keep headroom (peak <= -1 dBFS). Apply light compression on drum bus. Side-chain bass to kick (duck by ~6 dB at attack). Stereo spread on pads; keep bass mono.
- Loudness target (deliverable): -9 LUFS integrated (modern, dynamic) — approximate; produced audio will be normalized by peak and RMS.

Deliverables created in this run
- `composition/plan.md` (this file)
- `composition/synthesize.py` — Python script that programmatically synthesizes stems and a master WAV (48kHz).
- Stems output (after running script): `composition/drums.wav`, `composition/bass.wav`, `composition/pad.wav`, `composition/lead.wav`, `composition/master.wav`.

Next steps (automated)
- Run `synthesize.py` to generate stems and master.
- Verify files, present metadata (section timestamps, per-section loudness peaks), and mark tasks complete.

Notes & assumptions
- This run assumes no vocals and no video. If video is required, request again and I will generate a synchronized visual plan or a simple abstract visualizer.
- MIDI export is not produced in this automated audio synthesis pass; if MIDI files are required, I can add a MIDI export step.
