"""
Simple programmatic synth + arranger to generate stems and a mastered WAV.
- Uses only numpy and Python stdlib (wave) to avoid heavy audio deps.
- Target: 180s, synthwave instrumental, sections aligned to 100 BPM.

Run:
    python3 composition/generate.py

Outputs in the same folder:
- drums.wav
- bass.wav
- pad.wav
- lead.wav
- master.wav
- metadata.json

This is intentionally simple and designed for quick iteration, not a production DAW-quality render.
"""
import json
import math
import os
import struct
import wave
from typing import List, Tuple

import numpy as np

SR = 48000
DURATION = 180.0
BPM = 100
BEAT = 60.0 / BPM
BAR = BEAT * 4

# Section plan (bars)
SECTIONS = [
    ("Intro", 8),
    ("Verse A", 16),
    ("Build", 8),
    ("Chorus", 12),
    ("Verse B", 12),
    ("Final Chorus", 16),
    ("Outro", 3),
]

# Key / chords (C minor-ish feel)
CHORDS = [
    ("Cm", [40, 47, 52]),  # C2 G2 C3? midi numbers used for simplicity
    ("Ab", [36, 44, 48]),
    ("Eb", [39, 46, 51]),
    ("Bb", [35, 46, 58]),
]

OUT_DIR = os.path.dirname(__file__)

# Utilities

def midi_to_freq(m):
    return 440.0 * (2 ** ((m - 69) / 12.0))


def write_wav(path: str, data: np.ndarray, sr: int = SR):
    # data is float32 in -1..1
    scaled = np.clip(data, -1.0, 1.0)
    int_data = (scaled * 32767).astype(np.int16)

    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int_data.tobytes())


# Simple oscillator

def sine(f, t):
    return np.sin(2 * math.pi * f * t)


def saw(f, t, harmonics=16):
    out = np.zeros_like(t)
    nyq = SR / 2
    max_h = min(harmonics, int(nyq / f))
    for k in range(1, max_h + 1):
        out += (1.0 / k) * np.sin(2 * math.pi * f * k * t)
    return out * (2 / math.pi)


def adsr(a, d, s, r, length, sr=SR):
    n = int(length * sr)
    out = np.zeros(n)
    a_n = int(a * sr)
    d_n = int(d * sr)
    r_n = int(r * sr)
    sustain_n = max(0, n - (a_n + d_n + r_n))

    if a_n > 0:
        out[:a_n] = np.linspace(0, 1, a_n)
    if d_n > 0:
        start = a_n
        out[start:start + d_n] = np.linspace(1, s, d_n)
    if sustain_n > 0:
        start = a_n + d_n
        out[start:start + sustain_n] = s
    if r_n > 0:
        start = a_n + d_n + sustain_n
        out[start:start + r_n] = np.linspace(s, 0, r_n)
    return out


# Kick synth: sine frequency sweep + window

def make_kick(length=0.5):
    t = np.linspace(0, length, int(SR * length), endpoint=False)
    # pitch sweep from 100Hz -> 50Hz
    f0 = 120.0
    f1 = 40.0
    freqs = f0 + (f1 - f0) * (t / length)
    sig = np.sin(2 * math.pi * freqs * t)
    env = np.exp(-8 * t)  # fast decay
    return sig * env


# Hi-hat: filtered noise

def make_hat(length=0.06):
    n = int(length * SR)
    noise = np.random.randn(n) * 0.5
    # simple highpass-ish by diff
    hp = noise - np.concatenate(([0.0], noise[:-1]))
    env = np.exp(-40 * np.linspace(0, length, n))
    return hp * env


# Simple one-pole lowpass

def lowpass(sig, cutoff=1000):
    a = math.exp(-2 * math.pi * cutoff / SR)
    out = np.zeros_like(sig)
    prev = 0.0
    for i, s in enumerate(sig):
        prev = (1 - a) * s + a * prev
        out[i] = prev
    return out


# Build timeline in samples

def build_timeline():
    timeline = []  # tuples: (name, start_s, dur_s, bars)
    t = 0.0
    for name, bars in SECTIONS:
        dur = bars * BAR
        timeline.append((name, t, dur, bars))
        t += dur
    return timeline


# Generate drum track for full duration

def render_drums(total_len_s):
    n = int(total_len_s * SR)
    drums = np.zeros(n)
    # Kick on beats 1 and occasionally 3; hat 8th notes
    beat_samples = int(BEAT * SR)
    hat_interval = int((BEAT / 2) * SR)

    for i in range(0, n, beat_samples):
        k = make_kick(0.6)
        pos = i
        end = min(n, pos + len(k))
        drums[pos:end] += k[: end - pos] * 1.0

    for i in range(0, n, hat_interval):
        h = make_hat(0.06)
        pos = i
        end = min(n, pos + len(h))
        drums[pos:end] += h[: end - pos] * 0.25

    # light clap on 2 and 4 every bar
    bar_samples = int(BAR * SR)
    for i in range(0, n, bar_samples):
        clap_pos = i + int(1.5 * BEAT * SR)  # beat 2
        if clap_pos < n:
            c = np.random.randn(int(0.08 * SR)) * 0.4
            drums[clap_pos:clap_pos + len(c)] += c * np.exp(-30 * np.linspace(0, 0.08, len(c)))

    drums = lowpass(drums, 12000)
    # normalize
    drums /= max(1e-6, np.max(np.abs(drums)))
    return drums * 0.8


# Bass: simple saw + envelope patterns tied to chord roots

def render_bass(total_len_s, timeline):
    n = int(total_len_s * SR)
    bass = np.zeros(n)
    idx = 0
    chord_cycle = [ch for (_, ch) in CHORDS]
    # create a repeating pattern aligning to bars
    pos = 0
    for name, start, dur, bars in timeline:
        # choose chord index by position in timeline
        chord_idx = (idx) % len(chord_cycle)
        root_midi = chord_cycle[chord_idx][0]
        root_freq = midi_to_freq(root_midi + 12)  # one octave up for audibility
        # simple 1/2 note rhythm (two per bar)
        bar_samps = int(BAR * SR)
        for b in range(bars):
            for i_note in range(2):
                off = start * SR + b * bar_samps + i_note * (bar_samps // 2)
                off = int(off)
                length = int(0.9 * (bar_samps // 2))
                t = np.arange(length) / SR
                sig = saw(root_freq, t, harmonics=8) * adsr(0.005, 0.05, 0.7, 0.05, length / SR)
                end = min(n, off + len(sig))
                if off < n:
                    bass[off:end] += sig[: end - off]
        idx += 1
    # lowpass to fatten and mono-compat
    bass = lowpass(bass, 800)
    bass /= max(1e-6, np.max(np.abs(bass)))
    return bass * 0.9


# Pad: sustained chords through sections

def render_pad(total_len_s, timeline):
    n = int(total_len_s * SR)
    pad = np.zeros(n)
    chord_idx = 0
    for name, start, dur, bars in timeline:
        # choose chord progression position
        chord = CHORDS[chord_idx % len(CHORDS)][1]
        start_i = int(start * SR)
        l = int(dur * SR)
        t = np.arange(l) / SR
        sig = np.zeros_like(t)
        for m in chord:
            freq = midi_to_freq(m + 24)  # higher octave for pads
            # detuned saws
            sig += 0.6 * saw(freq * 0.995, t, harmonics=12)
            sig += 0.6 * saw(freq * 1.005, t, harmonics=12)
        # gentle amplitude envelope
        env = np.minimum(1.0, 3 * (t / max(0.001, l / SR)))
        sig *= env * 0.4
        end = min(n, start_i + l)
        pad[start_i:end] += sig[: end - start_i]
        chord_idx += 1
    pad = lowpass(pad, 2000)
    pad /= max(1e-6, np.max(np.abs(pad)))
    return pad * 0.6


# Lead melody (a short hook repeated and varied over timeline)

def render_lead(total_len_s, timeline):
    n = int(total_len_s * SR)
    lead = np.zeros(n)
    # define a motif in C natural minor (C D Eb F G Ab Bb)
    motif = [64, 67, 63, 60, 64, 67, 71]  # midi notes forming a catchy line
    motif_durations = [0.6, 0.4, 0.6, 0.6, 0.6, 0.6, 0.8]

    # Start lead at Verse A
    # find verse A start
    verse_start = None
    for name, start, dur, bars in timeline:
        if name == "Verse A":
            verse_start = start
            break
    if verse_start is None:
        verse_start = 8 * BAR

    pos = int(verse_start * SR)
    i = 0
    while pos < n - SR and i < 1000:
        note = motif[i % len(motif)]
        dur = motif_durations[i % len(motif)]
        length = int(dur * SR)
        t = np.arange(length) / SR
        f = midi_to_freq(note + 12)  # up an octave
        sig = 0.8 * saw(f, t, harmonics=10) * adsr(0.01, 0.08, 0.8, 0.06, dur)
        # small tasteful vibrato
        vib = 1.0 + 0.004 * np.sin(2 * math.pi * 5 * t)
        sig *= vib
        end = min(n, pos + len(sig))
        lead[pos:end] += sig[: end - pos]
        pos += length
        # add short gap
        pos += int(0.1 * SR)
        i += 1
    lead = lowpass(lead, 9000)
    lead /= max(1e-6, np.max(np.abs(lead)))
    return lead * 0.9


def sidechain(master_sig, gate_sig, threshold=0.02, amount=0.6):
    # Very simple sidechain: when gate_sig > threshold, reduce master_sig by amount
    out = master_sig.copy()
    n = len(master_sig)
    window = int(0.05 * SR)
    gate_env = np.convolve(np.abs(gate_sig), np.ones(window) / window, mode='same')
    sc = 1.0 - amount * (gate_env / (np.max(gate_env) + 1e-9))
    return out * sc


def main():
    timeline = build_timeline()
    # Save metadata
    meta = {"bpm": BPM, "sr": SR, "duration": DURATION, "sections": []}
    for name, start, dur, bars in timeline:
        meta["sections"].append({"name": name, "start": round(start, 3), "dur": round(dur, 3), "bars": bars})

    total_len = DURATION
    print("Rendering drums...")
    drums = render_drums(total_len)
    print("Rendering bass...")
    bass = render_bass(total_len, timeline)
    print("Rendering pad...")
    pad = render_pad(total_len, timeline)
    print("Rendering lead...")
    lead = render_lead(total_len, timeline)

    # Simulate sidechain: duck bass on kick
    side_bass = sidechain(bass, drums, threshold=0.01, amount=0.7)

    # write stems
    print("Writing stems...")
    write_wav(os.path.join(OUT_DIR, 'drums.wav'), drums)
    write_wav(os.path.join(OUT_DIR, 'bass.wav'), side_bass)
    write_wav(os.path.join(OUT_DIR, 'pad.wav'), pad)
    write_wav(os.path.join(OUT_DIR, 'lead.wav'), lead)

    # mix: simple balancing
    mix = (drums * 0.9) + (side_bass * 0.9) + (pad * 0.6) + (lead * 0.9)
    # gentle limiter / normalize
    peak = np.max(np.abs(mix))
    if peak > 0:
        mix = mix / peak * 0.98

    print("Writing master...")
    write_wav(os.path.join(OUT_DIR, 'master.wav'), mix)

    with open(os.path.join(OUT_DIR, 'metadata.json'), 'w') as f:
        json.dump(meta, f, indent=2)

    print("Done. Files written to:")
    print(os.path.join(OUT_DIR, 'drums.wav'))
    print(os.path.join(OUT_DIR, 'bass.wav'))
    print(os.path.join(OUT_DIR, 'pad.wav'))
    print(os.path.join(OUT_DIR, 'lead.wav'))
    print(os.path.join(OUT_DIR, 'master.wav'))


if __name__ == '__main__':
    main()
