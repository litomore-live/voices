import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import * as nativeSay from 'native-say';
import {ensureHelper} from './helper.js';

export {getAudioDevices, getDataFormats, getFileFormats} from 'native-say';

// Public fields from native-say are preserved; identifiers allow unambiguous Siri selection.
export function mergeVoices(legacy, modern) {
  const used = new Set();
  const result = legacy.map(voice => {
    const candidates = modern.filter(item => item.legacyName === voice.name);
    const match = candidates.find(item => !used.has(item.identifier)) ?? candidates[0];
    if (!match) return {...voice, engine: 'native-say'};
    used.add(match.identifier);
    return {...voice, identifier: match.identifier, language: match.language, quality: match.quality, isSiri: match.isSiri, engine: 'native-say'};
  });
  for (const voice of modern) {
    if (used.has(voice.identifier)) continue;
    result.push({name: voice.name, identifier: voice.identifier, language: voice.language,
      languageCode: voice.language.replaceAll('-', '_'), example: '', quality: voice.quality,
      isSiri: voice.isSiri, engine: 'avfoundation'});
  }
  // System downloads can rename Sinji to Sinji (Chinese (Hong Kong)).
  // Preserve unique short names without confusing names across languages.
  for (const voice of result) {
    const match = modern.find(item => item.identifier === voice.identifier);
    if (!match?.shortName || match.shortName === voice.name) continue;
    const languages = new Set(modern.filter(item => item.shortName === match.shortName).map(item => item.language));
    if (languages.size === 1) voice.aliases = [match.shortName];
  }
  return result;
}

export function createSpeechBackend({native = nativeSay, helper = ensureHelper, platform = process.platform,
  run = runProcess} = {}) {
  let catalog;
  let generation = 0;
  let legacyActive = 0;
  const speechChildren = new Set();
  const enumerate = async () => {
    if (platform !== 'darwin') return native.getVoices();
    const [legacy, modern] = await Promise.all([
      native.getVoices(),
      helper().then(({command, args}) => run(command, [...args, '--voices'])).then(JSON.parse),
    ]);
    return mergeVoices(legacy, modern);
  };
  const cachedVoices = () => catalog ??= enumerate().catch(error => { catalog = undefined; throw error; });
  return {
    async getVoices() {
      catalog = undefined;
      return cachedVoices();
    },
    async say(text, options = {}) {
      if (platform !== 'darwin') return native.say(text, options);
      if (typeof text !== 'string') throw new TypeError('Text must be a string');
      if (!text.trim() && !options.inputFile) throw new Error('Text must not be empty');
      if (!options.skipRunningCheck) await this.killRunningSay();
      const epoch = generation;
      const available = options.voice ? await cachedVoices() : [];
      const voice = available.find(item => item.identifier === options.voice)
        ?? available.find(item => item.name === options.voice)
        ?? available.find(item => item.aliases?.includes(options.voice));
      if (options.voice && !voice) throw new Error(`Voice is not available: ${options.voice}`);
      if (generation !== epoch) return;
      // Existing names retain native-say's rate, device and file-format behavior.
      if (!voice || (voice.engine === 'native-say' && options.voice === voice.name)) {
        legacyActive++;
        try { return await native.say(text, {...options, skipRunningCheck: true}); }
        finally { legacyActive--; }
      }
      for (const key of ['quality', 'networkSend', 'channels', 'volume']) {
        if (options[key] !== undefined) throw new Error(`${key} is not supported by AVFoundation voices`);
      }
      if (options.rate !== undefined && (!Number.isFinite(options.rate) || options.rate <= 0)) throw new Error('rate must be positive');
      const {command, args} = await helper();
      const input = options.inputFile ? await readFile(options.inputFile, 'utf8') : text;
      if (generation !== epoch) return;
      await run(command, [...args, '--speak'], {children: speechChildren, input: JSON.stringify({
        text: input, identifier: voice.identifier, rate: options.rate,
        audioDevice: options.audioDevice || undefined, outputFile: options.outputFile || undefined,
      })});
    },
    async killRunningSay() {
      generation++;
      const waiting = [];
      for (const child of speechChildren) {
        // xcrun/Swift can have compiler descendants during startup.
        if (child.pid) {
          try { process.kill(-child.pid, 'SIGTERM'); }
          catch (error) { if (error.code !== 'ESRCH') throw error; }
        }
        waiting.push(child.completion.catch(() => {}));
      }
      if (platform !== 'darwin' || legacyActive) waiting.push(native.killRunningSay());
      await Promise.all(waiting);
    },
    async checkIfSayIsRunning() {
      const child = [...speechChildren][0];
      if (child) return {platform: 'darwin', pid: child.pid, name: 'voices-native', command: child.spawnargs.join(' ')};
      return native.checkIfSayIsRunning();
    },
  };
}

function runProcess(path, args, {children = new Set(), input} = {}) {
  const child = spawn(path, args, {stdio: ['pipe', 'pipe', 'pipe'], detached: true});
  children.add(child);
  let stdout = '';
  let stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.stdin.on('error', () => {});
  child.stdin.end(input);
  child.completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code, signal) => {
      if (code === 0 || signal === 'SIGTERM' || signal === 'SIGKILL') resolve(stdout);
      else reject(new Error(stderr.trim() || `voices-native exited with code ${code}`));
    });
  }).finally(() => { children.delete(child); });
  return child.completion;
}

const backend = createSpeechBackend();
export const say = (text, options) => backend.say(text, options);
export const getVoices = () => backend.getVoices();
export const killRunningSay = () => backend.killRunningSay();
export const checkIfSayIsRunning = () => backend.checkIfSayIsRunning();
