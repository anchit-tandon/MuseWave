This folder contains a small programmatic synth which generates simple stems and a master WAV for a synthwave instrumental.

How to run:

1. Ensure Python 3.8+ and numpy are available.
2. From the project root run:

    python3 composition/generate.py

Outputs:
- drums.wav
- bass.wav
- pad.wav
- lead.wav
- master.wav
- metadata.json

Notes:
- This is a simple algorithmic synth for quick prototyping. For production, import stems into a DAW and replace synths with higher-quality instruments.
