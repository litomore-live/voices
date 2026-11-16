import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadVoices, regionOf, qualityOf, dialectOf, root } from './voices.mjs';

export async function generateReadme(voices) {
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const rows = voices.map(v => `| ${cell(v.displayName)} | ${regionOf(v).label} | ${dialectOf(v).label} | ${qualityOf(v).label}（${qualityOf(v).english}） | ${cell(v.name)} | [▶ 试听](${v.audio}) |`).join('\n');
  await writeFile(new URL('README.md', root), `# Voices ♡\n\n给直播间挑一个喜欢的声音。\n\n**[打开声音选择页 ↗](https://litomore-live.github.io/voices/)**\n\n共 ${voices.length} 个音色，点击试听，选好后告诉主播名字就好。\n\n音质档位：标准版 → 增强版（Enhanced）→ 高品质版（Premium）。\n\n| 名字 | 地区 | 方言 | 音质 | 音色名称 | 试听 |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const voices = await loadVoices();
  await generateReadme(voices);
  console.log(`Generated README.md for ${voices.length} voices`);
}
