import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { loadVoices, regionOf, qualityOf, dialectOf, root } from './voices.mjs';

export async function generateReadme(voices) {
  const cell = value => String(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const rows = voices.map(v => `| ${cell(v.displayName)} | ${regionOf(v).label} | ${dialectOf(v).label} | ${qualityOf(v).label}（${qualityOf(v).english}） | ${cell(v.name)} |`).join('\n');
  await writeFile(new URL('README.md', root), `# Voices ♡\n\n给直播间挑一个喜欢的声音。\n\n**[打开声音选择页 ↗](https://litomore-live.github.io/voices/)**\n\n共 ${voices.length} 个音色，前往声音选择页试听，选好后告诉主播名字就好。包含 Siri 普通话、台湾口音和粤语声音。\n\n音质档位：标准版 → 增强版（Enhanced）→ 高品质版（Premium）。\n\n| 名字 | 地区 | 方言 | 音质 | 音色名称 |\n| --- | --- | --- | --- | --- |\n${rows}\n\n工具使用和维护说明见 [CONTRIBUTING.md](CONTRIBUTING.md)。\n\n## License\n\nMIT\n`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const voices = await loadVoices();
  await generateReadme(voices);
  console.log(`Generated README.md for ${voices.length} voices`);
}
