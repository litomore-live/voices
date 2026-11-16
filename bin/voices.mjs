#!/usr/bin/env node
import {parseArgs} from 'node:util';
import {getVoices, say, killRunningSay} from '../src/index.js';

try {
  const {values, positionals} = parseArgs({allowPositionals: true, options: {
    voices: {type: 'boolean'}, json: {type: 'boolean'}, help: {type: 'boolean', short: 'h'},
    voice: {type: 'string', short: 'v'}, rate: {type: 'string', short: 'r'},
    output: {type: 'string', short: 'o'}, 'audio-device': {type: 'string', short: 'a'},
    file: {type: 'string', short: 'f'},
  }});
  if (values.help) {
    console.log('Usage: node bin/voices.mjs --voices [--json]\n       node bin/voices.mjs [-v NAME_OR_ID] [-r RATE] [-a DEVICE] [-o FILE] [-f INPUT] [--] TEXT');
  } else if (values.voices) {
    const voices = await getVoices();
    if (values.json) console.log(JSON.stringify(voices, null, 2));
    else console.table(voices.map(({name, languageCode, identifier}) => ({name, languageCode, identifier})));
  } else {
    const options = {skipRunningCheck: true};
    if (values.voice) options.voice = values.voice;
    if (values.rate !== undefined) options.rate = Number(values.rate);
    if (values.output) options.outputFile = values.output;
    if (values['audio-device']) options.audioDevice = values['audio-device'];
    if (values.file) options.inputFile = values.file;
    if (!positionals.length && !values.file) throw new Error('Provide text or -f INPUT; see --help');
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
      void killRunningSay().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143));
    });
    await say(positionals.join(' '), options);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
