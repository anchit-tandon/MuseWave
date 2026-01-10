"""
Zip the composition folder into composition_release.zip
"""
import zipfile
import os

ROOT = os.path.dirname(__file__)
OUT = os.path.join(ROOT, '..', 'composition_release.zip')

with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(ROOT):
        for f in filenames:
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, os.path.dirname(ROOT))
            zf.write(full, rel)

print('Wrote', OUT)
