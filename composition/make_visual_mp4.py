"""
Build and run an ffmpeg command to produce a spectrum visualizer MP4 from master_320.mp3
This script expects `ffmpeg` to be available on PATH. It reads `metadata.json` to overlay section labels.

Usage:
  python3 composition/make_visual_mp4.py

If ffmpeg is not installed, install on macOS with:
  brew install ffmpeg

The script creates `composition/visualizer_spectrum.mp4` next to the audio.
"""
import json
import os
import shlex
import shutil
import subprocess

ROOT = os.path.dirname(__file__)
AUDIO = os.path.join(ROOT, 'master_320.mp3')
META = os.path.join(ROOT, 'metadata.json')
OUT = os.path.join(ROOT, 'visualizer_spectrum.mp4')

if not os.path.exists(AUDIO):
    print('Error: audio file not found:', AUDIO)
    raise SystemExit(1)
if not os.path.exists(META):
    print('Error: metadata.json not found:', META)
    raise SystemExit(1)

if not shutil.which('ffmpeg'):
    print('ffmpeg not found on PATH. Please install it (macOS: brew install ffmpeg)')
    raise SystemExit(1)

with open(META, 'r') as f:
    meta = json.load(f)

# Base showspectrum filter
s = '1920x1080'
fps = 30
spec = f"showspectrum=s={s}:mode=separate:color=fiery:scale=log:slide=scroll:fps={fps}" 

# Build drawtext filters for sections
draws = []
# fontfile left out to use system font; if you want a custom font, set fontfile=/path/to/font.ttf
for idx, sec in enumerate(meta.get('sections', [])):
    start = sec['start']
    end = start + sec['dur']
    text = sec['name'].replace(':', '\\:')
    # position top-left with padding
    draw = (f"drawtext=text='{text}':x=20:y={40 + idx*40}:fontsize=30:fontcolor=white:" 
            f"enable='between(t,{start},{end})':box=1:boxcolor=black@0.25')")
    draws.append(draw)

filter_chain = spec
if draws:
    filter_chain = '[' + '0:a]' + spec + '[v];[v]'
    # append drawtext chain
    filter_chain = spec
    for d in draws:
        filter_chain += (',' + d)

# Build ffmpeg command
cmd = [
    'ffmpeg', '-y', '-i', AUDIO,
    '-filter_complex', spec + ((',' + ','.join(draws)) if draws else ''),
    '-map', '0', # include audio
    '-map', '0:a',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-preset', 'medium', '-crf', '18',
    '-c:a', 'aac', '-b:a', '320k',
    OUT
]

print('Running ffmpeg with the following command:')
print(' '.join(shlex.quote(p) for p in cmd))
print('\nThis may take a while. Video will be created at:', OUT)

subprocess.check_call(cmd)
print('Done:', OUT)
