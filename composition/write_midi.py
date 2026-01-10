"""
Write simple MIDI representations of the generated stems.
Creates: drums.mid, bass.mid, pad.mid, lead.mid

This uses `mido` for MIDI file creation.
"""
from mido import Message, MidiFile, MidiTrack, MetaMessage
import json
import os

OUT_DIR = os.path.dirname(__file__)

# Load metadata to get BPM and sections
with open(os.path.join(OUT_DIR, 'metadata.json')) as f:
    meta = json.load(f)
BPM = meta.get('bpm', 100)
TICKS_PER_BEAT = 480

# Simple helper to convert seconds to ticks

def s_to_ticks(seconds):
    beats = seconds / 60.0 * BPM
    return int(beats * TICKS_PER_BEAT)


# Write a simple lead MIDI: repeat motif starting at Verse A
lead_mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
track = MidiTrack()
lead_mid.tracks.append(track)
track.append(MetaMessage('set_tempo', tempo=int(60_000_000 / BPM)))
track.append(MetaMessage('track_name', name='Lead'))

# motif (same as generator)
motif = [64, 67, 63, 60, 64, 67, 71]
motif_durations = [0.6, 0.4, 0.6, 0.6, 0.6, 0.6, 0.8]

# find Verse A
verse_start = 0
for sec in meta.get('sections', []):
    if sec.get('name') == 'Verse A':
        verse_start = sec.get('start', 0)
        break

# move to start
track.append(Message('note_off', note=0, velocity=0, time=s_to_ticks(verse_start)))

pos_time = 0
i = 0
while pos_time < meta['duration'] - 1 and i < 2000:
    note = motif[i % len(motif)]
    dur = motif_durations[i % len(motif)]
    ticks = s_to_ticks(dur)
    # note_on
    track.append(Message('note_on', note=note + 12, velocity=90, time=0))
    track.append(Message('note_off', note=note + 12, velocity=64, time=ticks))
    pos_time += dur + 0.1
    # add small gap
    track.append(MetaMessage('marker', text='gap', time=s_to_ticks(0.1)))
    i += 1

lead_mid.save(os.path.join(OUT_DIR, 'lead.mid'))
print('Wrote lead.mid')

# Bass: root notes per bar
bass_mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
track = MidiTrack()
bass_mid.tracks.append(track)
track.append(MetaMessage('set_tempo', tempo=int(60_000_000 / BPM)))
track.append(MetaMessage('track_name', name='Bass'))

chords = [[40,47,52],[36,44,48],[39,46,51],[35,46,58]]
sec_idx = 0
for sec in meta.get('sections', []):
    bars = sec.get('bars', 4)
    dur = sec.get('dur', 0)
    start = sec.get('start', 0)
    for b in range(bars):
        root = chords[sec_idx % len(chords)][0]
        # note length: half-note
        ticks = s_to_ticks(BAR / 2) if 'BAR' in globals() else s_to_ticks(60 / BPM * 2)
        track.append(Message('note_on', note=root + 12, velocity=100, time=0))
        track.append(Message('note_off', note=root + 12, velocity=64, time=ticks))
    sec_idx += 1

bass_mid.save(os.path.join(OUT_DIR, 'bass.mid'))
print('Wrote bass.mid')

# Pad: sustained chords per section
pad_mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
track = MidiTrack()
pad_mid.tracks.append(track)
track.append(MetaMessage('set_tempo', tempo=int(60_000_000 / BPM)))
track.append(MetaMessage('track_name', name='Pad'))

sec_idx = 0
for sec in meta.get('sections', []):
    chord = chords[sec_idx % len(chords)]
    start = sec.get('start', 0)
    dur = sec.get('dur', 0)
    ticks = s_to_ticks(dur)
    # note on all chord notes
    for n in chord:
        track.append(Message('note_on', note=n + 36, velocity=80, time=0))
    track.append(Message('note_off', note=chord[0] + 36, velocity=64, time=ticks))
    sec_idx += 1

pad_mid.save(os.path.join(OUT_DIR, 'pad.mid'))
print('Wrote pad.mid')

# Drums: basic kick/hihat pattern on channel 9 (MIDI channel 10)
from mido import MidiFile, MidiTrack

drum_mid = MidiFile(ticks_per_beat=TICKS_PER_BEAT)
track = MidiTrack()
drum_mid.tracks.append(track)
track.append(MetaMessage('set_tempo', tempo=int(60_000_000 / BPM)))
track.append(MetaMessage('track_name', name='Drums'))

# generate 8th-note ticks across duration
step = s_to_ticks(60.0 / BPM / 2)
elapsed = 0
while elapsed < s_to_ticks(meta['duration']):
    # kick on downbeats (every 2 steps)
    if (elapsed // step) % 2 == 0:
        track.append(Message('note_on', note=36, velocity=100, time=0))
        track.append(Message('note_off', note=36, velocity=64, time=step))
    else:
        # hihat
        track.append(Message('note_on', note=42, velocity=70, time=0))
        track.append(Message('note_off', note=42, velocity=64, time=step))
    elapsed += step

drum_mid.save(os.path.join(OUT_DIR, 'drums.mid'))
print('Wrote drums.mid')
