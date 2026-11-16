import { readFile, access } from 'node:fs/promises';

export const root = new URL('../', import.meta.url);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export const SERIES = [{ id: 'siri', label: 'Siri' }];
export const seriesOf = voice => ({ id: voice.id.startsWith('siri-') ? 'siri' : 'other' });
export const REGIONS = [
  { id: 'mainland', label: '大陆' },
  { id: 'hongkong', label: '香港' },
  { id: 'taiwan', label: '台湾' },
];
export const QUALITIES = [
  { id: 'standard', label: '标准版', english: 'Standard', rank: 0 },
  { id: 'enhanced', label: '增强版', english: 'Enhanced', rank: 1 },
  { id: 'premium', label: '高品质版', english: 'Premium', rank: 2 },
];
export const DIALECTS = [
  { id: 'mandarin', label: '普通话' },
  { id: 'northeastern', label: '东北话（辽宁）' },
  { id: 'shaanxi', label: '陕西话' },
  { id: 'sichuan', label: '四川话' },
  { id: 'cantonese', label: '粤语' },
  { id: 'taiwan-mandarin', label: '台湾口音' },
];
export function regionOf(voice) {
  const id = voice.locale === 'zh_TW' ? 'taiwan' : voice.locale === 'zh_HK' ? 'hongkong' : 'mainland';
  return REGIONS.find(region => region.id === id);
}
export const qualityOf = voice => QUALITIES.find(quality => quality.id === voice.quality);
export const dialectOf = voice => DIALECTS.find(dialect => dialect.id === voice.dialect);
const byName = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
export function sortVoices(voices) {
  return [...voices].sort((a, b) =>
    DIALECTS.indexOf(dialectOf(a)) - DIALECTS.indexOf(dialectOf(b)) ||
    Number(seriesOf(b).id === 'siri') - Number(seriesOf(a).id === 'siri') ||
    (seriesOf(a).id === 'siri' && seriesOf(b).id === 'siri'
      ? byName.compare(b.name.split(' (')[0], a.name.split(' (')[0]) : 0) ||
    REGIONS.indexOf(regionOf(a)) - REGIONS.indexOf(regionOf(b)) ||
    byName.compare(a.name.split(' (')[0], b.name.split(' (')[0]) ||
    qualityOf(b).rank - qualityOf(a).rank ||
    byName.compare(a.id, b.id));
}
export async function loadVoices() {
  const source = JSON.parse(await readFile(new URL('voices.json', root), 'utf8'));
  if (!Array.isArray(source) || !source.length) throw new Error('voices.json must contain voices');
  const { excludedVoiceIds } = JSON.parse(await readFile(new URL('excluded-voices.json', root), 'utf8'));
  if (!Array.isArray(excludedVoiceIds) || excludedVoiceIds.some(id => typeof id !== 'string' || !/^[a-z0-9-]+$/.test(id))) {
    throw new Error('excluded-voices.json must contain an excludedVoiceIds array of voice IDs');
  }
  const excluded = new Set(excludedVoiceIds);
  if (excluded.size !== excludedVoiceIds.length) throw new Error('Duplicate IDs in excluded-voices.json');
  const voices = source.filter(voice => !excluded.has(voice.id));
  const ids = new Set();
  for (const voice of voices) {
    for (const key of ['id', 'name', 'displayName', 'locale', 'greeting', 'text', 'audio']) {
      if (typeof voice[key] !== 'string' || !voice[key]) throw new Error(`Missing ${key} in voice ${voice.id}`);
    }
    if (ids.has(voice.id) || !/^[a-z0-9-]+$/.test(voice.id)) throw new Error(`Invalid or duplicate voice ID: ${voice.id}`);
    ids.add(voice.id);
    if (!/^audio\/[a-z0-9-]+\.mp3$/.test(voice.audio)) throw new Error(`Invalid audio path: ${voice.audio}`);
    if (!Number.isFinite(voice.duration) || voice.duration <= 0) throw new Error(`Invalid duration: ${voice.id}`);
    if (!qualityOf(voice)) throw new Error(`Invalid quality: ${voice.id}`);
    if (!dialectOf(voice)) throw new Error(`Invalid dialect: ${voice.id}`);
    await access(new URL(voice.audio, root));
  }
  return sortVoices(voices);
}
