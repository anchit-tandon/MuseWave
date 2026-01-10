#!/usr/bin/env python3
"""
Simple procedural synth to generate a multi-stem synthwave track (stems + final mix).
Generates: drums.wav, bass.wav, pad.wav, lead.wav, master.wav

Dependencies: numpy
Run: python3 synthesize.py
"""
import os
import math
import wave
import struct
import numpy as np

OUT_DIR = os.path.dirname(__file__)
SR = 48000
DURATION = 180.0
BPM = 120
BAR_LEN = 4 * 60.0 / BPM  # 2.0s per bar

# Utility functions
def save_wav(path, data, sr=SR):
    # data: float32 in [-1,1]
    # convert to 24-bit PCM in WAV container using 32-bit samples (we'll write 16-bit for portability)
    int_data = np.int16(np.clip(data, -1.0, 1.0) * 32767)
    with wave.open(path, 'w') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(int_data.tobytes())
    print(f"Wrote {path} ({len(data)/sr:.2f}s)")

# Oscillators
def sine(freq, length, sr=SR):
    t = np.linspace(0, length, int(sr*length), endpoint=False)
    return np.sin(2*np.pi*freq*t)

def saw(freq, length, sr=SR):
    t = np.linspace(0, length, int(sr*length), endpoint=False)
    return 2*(t*freq - np.floor(0.5 + t*freq))

def triangle(freq, length, sr=SR):
    return 2*np.abs(saw(freq, length, sr)) - 1

# Envelope
def adsr(signal, sr, a=0.01, d=0.05, s=0.8, r=0.05):
    n = len(signal)
    A = int(sr*a)
    D = int(sr*d)
    R = int(sr*r)
    env = np.ones(n) * s
    if A>0:
        env[:A] = np.linspace(0,1,A)
    if D>0:
        env[A:A+D] = np.linspace(1,s,D)
    if R>0:
        env[-R:] = np.linspace(s,0,R)
    return signal * env

# Percussion: simple kick + snare + hihat

def generate_drums(duration):
    sr = SR
    out = np.zeros(int(sr*duration))
    # Kick pattern: four-on-the-floor
    beat_len = 60.0/BPM
    total_beats = int(duration/beat_len)
    for b in range(total_beats):
        t0 = int(b*beat_len*sr)
        # kick: sine sweep + exponential decay
        length = int(0.45*sr)
        f0 = 60.0
        kick = np.sin(2*np.pi*f0*np.linspace(0,1,length)) * np.exp(-6*np.linspace(0,1,length))
        out[t0:t0+length] += kick
    # simple snare on beats 2 and 4
    for b in range(total_beats):
        if b%4 in (1,3):
            t0 = int(b*beat_len*sr)
            length = int(0.25*sr)
            noise = np.random.normal(0,1,length) * np.exp(-8*np.linspace(0,1,length))
            out[t0:t0+length] += 0.8*noise
    # hi-hats: 8th notes
    for b in range(total_beats*2):
        t0 = int((b*beat_len/2.0)*sr)
        length = int(0.06*sr)
        hat = (np.random.normal(0,1,length) * np.exp(-40*np.linspace(0,1,length))) * 0.3
        out[t0:t0+length] += hat
    # gentle low-pass to glue
    out = out * 0.9
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out

# Bass: follow chord roots, mono
ROOT_FREQS = {'A':55.0,'B':61.74,'C':65.41,'D':73.42,'E':82.41,'F':87.31,'G':98.0}
CHORD_ROOTS = ['A','F','C','G']

def generate_bass(duration):
    sr = SR
    out = np.zeros(int(sr*duration))
    bar_len = BAR_LEN
    bars = int(duration / bar_len)
    for i in range(bars):
        root = CHORD_ROOTS[i % len(CHORD_ROOTS)]
        f = ROOT_FREQS[root]
        # two-octave variation
        f = f * 1.0
        t0 = int(i*bar_len*sr)
        length = int(bar_len*sr)
        t = np.linspace(0, bar_len, length, endpoint=False)
        saw_wave = 0.6 * saw(f, bar_len)
        # lowpass-ish by softening harmonics (simple moving average)
        kernel = np.ones(5)/5.0
        smooth = np.convolve(saw_wave, kernel, mode='same')
        env = np.ones(length)
        env[:int(0.02*sr)] = np.linspace(0,1,int(0.02*sr))
        env[-int(0.05*sr):] = np.linspace(1,0,int(0.05*sr))
        out[t0:t0+length] += 0.9 * smooth * env
    # make mono, normalize
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out

# Pad: sustained chords (simple triad) across four-bar groups
NOTE_FREQS = {'A':440.0,'B':493.88,'C':261.63,'D':293.66,'E':329.63,'F':349.23,'G':392.0}

def note_freq(root, octave=4):
    base = NOTE_FREQS[root]
    return base * (2 ** (octave-4))

CHORDS = [('A','C','E'), ('F','A','C'), ('C','E','G'), ('G','B','D')]

def generate_pad(duration):
    sr = SR
    out = np.zeros(int(sr*duration))
    bar_len = BAR_LEN
    bars = int(duration / bar_len)
    for i in range(bars):
        chord = CHORDS[i % len(CHORDS)]
        t0 = int(i*bar_len*sr)
        length = int(bar_len*sr)
        chord_signal = np.zeros(length)
        for note in chord:
            f = note_freq(note, octave=4)
            chord_signal += 0.33 * triangle(f, bar_len)
        # smoothed attack/release across bar
        env = np.ones(length) * 0.8
        env[:int(0.3*sr)] = np.linspace(0,0.8,int(0.3*sr))
        env[-int(0.3*sr):] = np.linspace(0.8,0,int(0.3*sr))
        out[t0:t0+length] += chord_signal * env * 0.6
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out

# Lead: simple motif repeating every 4 bars
LEAD_MELODY = [ ('A5',0.5), ('C6',0.5), ('E6',1.0), ('G5',1.0), ('E6',1.0) ]
NOTE_FREQ_MAP = {
    'A5': note_freq('A',5), 'C6': note_freq('C',6), 'E6': note_freq('E',6), 'G5': note_freq('G',5)
}

def generate_lead(duration):
    sr = SR
    out = np.zeros(int(sr*duration))
    bar_len = BAR_LEN
    bars = int(duration / bar_len)
    # pattern every 4 bars
    for i in range(bars//4):
        t_start = int(i*4*bar_len*sr)
        # place melody across 4 bars
        cursor = 0
        for note_name, dur_b in LEAD_MELODY:
            f = NOTE_FREQ_MAP[note_name]
            length = int(dur_b * (60.0/BPM) * sr * 4) if False else int(dur_b * sr)  # simpler mapping
            # generate simple saw + sine mix
            s = 0.6 * sine(f, length) + 0.4 * saw(f, length)
            s = adsr(s, sr, a=0.01, d=0.05, s=0.9, r=0.05)
            pos = t_start + int(cursor*sr)
            if pos+length <= len(out):
                out[pos:pos+length] += s
            cursor += (length / sr)
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out

# Mix stems with simple side-chain (duck bass when kick present)
def apply_sidechain(bass, drums, sr=SR):
    # detect kicks as peaks in drums (simple threshold on low band)
    N = len(bass)
    out = bass.copy()
    window = int(0.05*sr)
    threshold = 0.4
    for i in range(0, N, int(sr*(60.0/BPM)/2)):
        # check for local kick presence
        seg = drums[i:i+window]
        if seg.size==0:
            continue
        if np.max(np.abs(seg)) > threshold:
            # apply ducking: multiply bass in short region by envelope
            rlen = int(0.2*sr)
            env = np.concatenate([np.linspace(0.4,1.0,int(rlen*0.3)), np.ones(int(rlen*0.4)), np.linspace(1.0,0.9,int(rlen*0.3))])
            env = env[:rlen]
            out[i:i+len(env)] *= env
    out = out / (np.max(np.abs(out)) + 1e-9)
    return out


def main():
    print('Generating stems...')
    drums = generate_drums(DURATION)
    save_wav(os.path.join(OUT_DIR,'drums.wav'), drums)

    bass = generate_bass(DURATION)
    # apply sidechain
    bass = apply_sidechain(bass, drums)
    save_wav(os.path.join(OUT_DIR,'bass.wav'), bass)

    pad = generate_pad(DURATION)
    save_wav(os.path.join(OUT_DIR,'pad.wav'), pad)

    lead = generate_lead(DURATION)
    save_wav(os.path.join(OUT_DIR,'lead.wav'), lead)

    # simple mix: drums (0.9) + bass (0.9) + pad (0.6) + lead (0.8)
    master = 0.9*drums + 0.9*bass + 0.6*pad + 0.8*lead
    # normalize to -1 dB peak
    peak = np.max(np.abs(master)) + 1e-9
    master = master / peak * 0.9
    save_wav(os.path.join(OUT_DIR,'master.wav'), master)
    print('Done. Files in', OUT_DIR)

if __name__ == '__main__':
    main()
