import assert from 'node:assert/strict';
import test from 'node:test';
import {createSpeechBackend, mergeVoices} from '../src/index.js';

const modern = [
  {name: 'Tingting (Chinese (China mainland))', legacyName: 'Tingting (Chinese (China mainland))', identifier: 'tingting-id', language: 'zh-CN', quality: 'standard', isSiri: false},
  {name: 'Siri Voice 2 (zh-CN)', identifier: 'siri-id', language: 'zh-CN', quality: 'enhanced', isSiri: true},
  {name: 'Siri Voice 2 (yue-HK)', identifier: 'siri-hk-id', language: 'yue-HK', quality: 'enhanced', isSiri: true},
];

test('keeps renamed short names as aliases only when their language is unambiguous', () => {
  const voices = mergeVoices([{name: 'Sinji (Chinese (Hong Kong))'}], [
    {name: 'Sinji (Chinese (Hong Kong))', legacyName: 'Sinji (Chinese (Hong Kong))', shortName: 'Sinji', identifier: 'sinji', language: 'yue-HK'},
    {name: 'Eddy (zh-CN)', shortName: 'Eddy', identifier: 'eddy-cn', language: 'zh-CN'},
    {name: 'Eddy (en-US)', shortName: 'Eddy', identifier: 'eddy-us', language: 'en-US'},
  ]);
  assert.deepEqual(voices[0].aliases, ['Sinji']);
  assert.equal(voices[1].aliases, undefined);
  assert.equal(voices[2].aliases, undefined);
});
function fixture(overrides = {}) {
  const calls = [];
  const native = {
    getVoices: async () => [{name: modern[0].name, languageCode: 'zh_CN', example: '你好'}],
    say: async (...args) => { calls.push(['native', ...args]); },
    killRunningSay: async () => { calls.push(['kill-native']); },
    checkIfSayIsRunning: async () => undefined,
  };
  const backend = createSpeechBackend({native, helper: async () => ({command: '/helper', args: []}), platform: 'darwin',
    run: async (path, args, options) => {
      calls.push([path, args, options]);
      return args[0] === '--voices' ? JSON.stringify(modern) : '';
    }, ...overrides});
  return {backend, calls};
}

test('adds distinguishable Siri voices while retaining native-say fields and existing names', async () => {
  const {backend} = fixture();
  const voices = await backend.getVoices();
  assert.equal(voices.length, 3);
  const {legacyName, ...expected} = modern[0];
  assert.deepEqual(voices[0], {...expected, languageCode: 'zh_CN', example: '你好', engine: 'native-say'});
});

test('routes existing names to native-say with options and Siri names/IDs to the same helper voice', async () => {
  const {backend, calls} = fixture();
  const options = {voice: modern[0].name, rate: 180, audioDevice: 'device', skipRunningCheck: true};
  await backend.say('旧音色', options);
  assert.deepEqual(calls.find(call => call[0] === 'native'), ['native', '旧音色', options]);
  for (const voice of ['Siri Voice 2 (zh-CN)', 'siri-id']) {
    await backend.say('-你好 [[rate 900]]', {voice, rate: 200, outputFile: '/tmp/sample.caf', skipRunningCheck: true});
  }
  const requests = calls.filter(call => call[1]?.[0] === '--speak').map(call => JSON.parse(call[2].input));
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0], requests[1]);
  assert.equal(requests[0].text, '-你好 [[rate 900]]');
  assert.equal(requests[0].identifier, 'siri-id');
  assert.equal(calls.filter(call => call[1]?.[0] === '--voices').length, 1, 'cache voice enumeration across utterances');
  await assert.rejects(backend.say('你好', {voice: 'Missing', skipRunningCheck: true}), /not available/);
  await assert.rejects(backend.say('你好', {voice: 'siri-id', rate: NaN}), /positive/);
});

test('stop during asynchronous voice enumeration prevents speech from starting later', async () => {
  let release;
  const {backend, calls} = fixture({helper: () => new Promise(resolve => { release = resolve; })});
  const speaking = backend.say('不应该朗读', {voice: 'siri-id', skipRunningCheck: true});
  await backend.killRunningSay();
  release({command: '/helper', args: []});
  await speaking;
  assert.ok(!calls.some(call => call[1]?.[0] === '--speak'));
  assert.ok(!calls.some(call => call[0] === 'kill-native'), 'does not kill unrelated native speech');
});

test('Windows delegates listing, speech and cancellation to native-say without building Swift', async () => {
  const {backend, calls} = fixture({platform: 'win32', helper: () => { throw new Error('must not build'); }});
  assert.equal((await backend.getVoices())[0].name, modern[0].name);
  await backend.say('你好', {voice: 'Windows voice', volume: 50});
  await backend.killRunningSay();
  assert.deepEqual(calls, [['native', '你好', {voice: 'Windows voice', volume: 50}], ['kill-native']]);
});
