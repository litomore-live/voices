#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
import {generateReadme} from './generate-readme.mjs';
import {loadVoices, root} from './voices.mjs';

try {
  const {values, positionals} = parseArgs({allowPositionals: true, options: {
    only: {type: 'boolean'}, help: {type: 'boolean', short: 'h'},
  }});
  if (values.help) {
    console.log('Usage: npm run generate:audio -- [--only ID [ID ...]]');
  } else {
    if (values.only ? !positionals.length : positionals.length) {
      throw new Error('Use --only followed by one or more catalog IDs; see --help');
    }
    const voices = JSON.parse(await readFile(new URL('voices.json', root), 'utf8'));
    const only = new Set(positionals);
    for (const id of only) {
      if (!voices.some(voice => voice.id === id)) throw new Error(`Unknown catalog ID: ${id}`);
    }
    const directory = await mkdtemp(join(tmpdir(), 'voices-'));
    try {
      for (const voice of voices) {
        if (values.only && !only.has(voice.id)) continue;
        console.log(`Generating ${voice.name}`);
        const source = join(directory, 'sample.caf');
        const target = fileURLToPath(new URL(voice.audio, root));
        await mkdir(new URL('./', new URL(voice.audio, root)), {recursive: true});
        execFileSync(process.execPath, [fileURLToPath(new URL('bin/voices.mjs', root)), '-v', voice.identifier ?? voice.name, '-o', source, '--', voice.text], {stdio: 'inherit'});
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', source, '-ac', '1', '-ar', '24000', '-codec:a', 'libmp3lame', '-b:a', '96k', target], {stdio: 'inherit'});
        const duration = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', target], {encoding: 'utf8'}).trim());
        if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Invalid duration: ${voice.id}`);
        voice.duration = duration;
      }
    } finally {
      await rm(directory, {recursive: true, force: true});
    }
    await writeFile(new URL('voices.json', root), JSON.stringify(voices, null, 2) + '\n');
    await generateReadme(await loadVoices());
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
