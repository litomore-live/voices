import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { loadVoices, escapeHtml, seriesOf, regionOf, qualityOf, dialectOf, SERIES, REGIONS, QUALITIES, DIALECTS } from './voices.mjs';
import { generateReadme } from './generate-readme.mjs';

const root = new URL('../', import.meta.url);
const voices = await loadVoices();
await generateReadme(voices);
const cards = voices.map((voice, index) => {
  const e = escapeHtml;
  const region = regionOf(voice);
  const quality = qualityOf(voice);
  const dialect = dialectOf(voice);
  return `<article class="voice-card" data-series="${seriesOf(voice).id}" data-region="${region.id}" data-quality="${quality.id}" data-dialect="${dialect.id}" data-search="${e(`${voice.displayName} ${voice.name} ${region.label} ${quality.label} ${quality.english} ${dialect.label}`.toLowerCase())}" id="${e(voice.id)}">
    <div class="card-top"><span class="voice-number">VOICE / ${String(index + 1).padStart(2, '0')}</span><span class="region-dot">${region.label}</span></div>
    <div class="voice-heading"><h3>${e(voice.displayName)}</h3><span class="sparkle" aria-hidden="true">✦</span></div>
    <div class="voice-meta"><span>${e(voice.name.split(' (')[0])}</span></div>
    <div class="voice-tags"><span class="edition quality-${quality.id}">${quality.label}<small>${quality.english}</small></span><span class="dialect">${dialect.label}</span></div>
    <p class="greeting">“${e(voice.greeting)}”</p>
    <div class="card-player">
      <audio preload="none" src="${e(voice.audio)}"></audio>
      <button class="play-button" type="button" aria-label="播放 ${e(voice.displayName)}，${region.label}，${dialect.label}，${quality.label}" aria-pressed="false"><span class="play-icon" aria-hidden="true">▶</span><span class="play-label">点击播放</span><span class="mini-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>
      <p class="audio-error" role="status" hidden>暂时播放不了，<a href="${e(voice.audio)}" download>下载试听 ↗</a></p>
    </div>
  </article>`;
}).join('\n');
let page = await readFile(new URL('site/template.html', root), 'utf8');
page = page.replaceAll('{{COUNT}}', String(voices.length)).replace('<!-- VOICE_CARDS -->', cards);
for (const [dimension, options, metadata] of [['series', SERIES, seriesOf], ['region', REGIONS, regionOf], ['quality', QUALITIES, qualityOf], ['dialect', DIALECTS, dialectOf]]) {
  const all = { id: 'all', label: dimension === 'series' ? '全部声音' : '全部' };
  const buttons = [all, ...options].map(option => {
    const count = option.id === 'all' ? voices.length : voices.filter(voice => metadata(voice).id === option.id).length;
    return `<button type="button" class="filter${option.id === 'all' ? ' active' : ''}" data-dimension="${dimension}" data-value="${option.id}" aria-pressed="${option.id === 'all'}">${option.label} <span data-count>${count}</span></button>`;
  }).join('');
  page = page.replace(`<!-- FILTER_${dimension.toUpperCase()} -->`, buttons);
}
await rm(new URL('dist/', root), { recursive: true, force: true });
await mkdir(new URL('dist/audio/', root), { recursive: true });
await writeFile(new URL('dist/index.html', root), page);
await Promise.all([
  ...voices.map(voice => cp(new URL(voice.audio, root), new URL(`dist/${voice.audio}`, root))),
  cp(new URL('site/styles.css', root), new URL('dist/styles.css', root)),
  cp(new URL('site/player.js', root), new URL('dist/player.js', root)),
  writeFile(new URL('dist/voices.json', root), JSON.stringify(voices, null, 2) + '\n'),
  writeFile(new URL('dist/.nojekyll', root), ''),
]);
console.log(`Built ${voices.length} voice cards and README.md from voices.json`);
