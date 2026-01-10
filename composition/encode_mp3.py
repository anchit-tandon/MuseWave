"""
Encode master.wav -> master_320.mp3 using lameenc (pure-python encoder wrapper).
"""
import wave
import os
from lameenc import Encoder

OUT_DIR = os.path.dirname(__file__)
IN_FILE = os.path.join(OUT_DIR, 'master.wav')
OUT_FILE = os.path.join(OUT_DIR, 'master_320.mp3')

if not os.path.exists(IN_FILE):
    print('master.wav not found. Run generate.py first.')
    raise SystemExit(1)

with wave.open(IN_FILE, 'rb') as wf:
    channels = wf.getnchannels()
    sr = wf.getframerate()
    sampwidth = wf.getsampwidth()
    nframes = wf.getnframes()
    raw = wf.readframes(nframes)

enc = Encoder()
enc.set_bit_rate(320)
enc.set_in_sample_rate(sr)
enc.set_channels(channels)
enc.set_quality(2)

mp3_data = enc.encode(raw)
mp3_data += enc.flush()

with open(OUT_FILE, 'wb') as f:
    f.write(mp3_data)

print('Wrote', OUT_FILE)
