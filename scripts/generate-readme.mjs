import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadVoices, regionOf, qualityOf, dialectOf, root } from './voices.mjs';

export async function generateReadme(voices) {
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const rows = voices.map(v => `| ${cell(v.displayName)} | ${regionOf(v).label} | ${dialectOf(v).label} | ${qualityOf(v).label}（${qualityOf(v).english}） | ${cell(v.name)} |`).join('\n');
  await writeFile(new URL('README.md', root), `[![Voices ♡：你的弹幕，你来选声音。粉紫色像素 anime 角色与声波播放器。](site/assets/readme-cover.webp)](https://litomore-live.github.io/voices/)

<h1 align="center">Voices ♡</h1>

<p align="center">给你发的弹幕挑个喜欢的声音。</p>

<p align="center"><strong><a href="https://voices.litomore.me">打开声音选择页 ↗</a></strong></p>

共 ${voices.length} 个音色，前往声音选择页试听，选好后把音色名字告诉主播，主播会用这个音色读出你发的弹幕。包含 Siri 普通话、台湾口音和粤语声音。

音质档位：标准版 → 增强版（Enhanced）→ 高品质版（Premium）。

| 名字 | 地区 | 方言 | 音质 | 音色名称 |
| --- | --- | --- | --- | --- |
${rows}

工具使用和维护说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。

<h2 align="center">License</h2>

<p align="center">MIT</p>
`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const voices = await loadVoices();
  await generateReadme(voices);
  console.log(`Generated README.md for ${voices.length} voices`);
}
