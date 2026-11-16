#!/usr/bin/env python3
"""Regenerate MP3 samples from voices.json on macOS (requires say and ffmpeg)."""
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    voices = json.loads((ROOT / 'voices.json').read_text())
    with tempfile.TemporaryDirectory(prefix='voices-') as directory:
        for voice in voices:
            print(f"Generating {voice['name']}", flush=True)
            source = Path(directory) / 'sample.aiff'
            target = ROOT / voice['audio']
            target.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['say', '-v', voice['name'], '-o', str(source), voice['text']], check=True)
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '96k', str(target)], check=True)
            voice['duration'] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(target)], text=True))
    (ROOT / 'voices.json').write_text(json.dumps(voices, ensure_ascii=False, indent=2) + '\n')
    subprocess.run(['node', 'scripts/generate-readme.mjs'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
