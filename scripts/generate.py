#!/usr/bin/env python3
"""Regenerate MP3 samples using the shared TTS CLI (requires Node, Swift and ffmpeg)."""
import argparse
import json
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='+', help='Regenerate only these catalog IDs')
    args = parser.parse_args()
    voices = json.loads((ROOT / 'voices.json').read_text())
    with tempfile.TemporaryDirectory(prefix='voices-') as directory:
        for voice in voices:
            if args.only and voice['id'] not in args.only:
                continue
            print(f"Generating {voice['name']}", flush=True)
            source = Path(directory) / 'sample.caf'
            target = ROOT / voice['audio']
            target.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(['node', str(ROOT / 'bin/voices.mjs'), '-v', voice.get('identifier', voice['name']), '-o', str(source), '--', voice['text']], check=True)
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source), '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '96k', str(target)], check=True)
            voice['duration'] = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(target)], text=True))
    (ROOT / 'voices.json').write_text(json.dumps(voices, ensure_ascii=False, indent=2) + '\n')
    subprocess.run(['node', 'scripts/generate-readme.mjs'], cwd=ROOT, check=True)

if __name__ == '__main__':
    main()
