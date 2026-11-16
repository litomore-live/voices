# 维护声音目录

## 本地 TTS 工具

此项目同时封装 `native-say` 与 macOS 的 `AVSpeechSynthesizer`，不发布到 npm。运行 `npm ci` 安装依赖后直接执行代码即可，不需要 `npm link`：

```sh
node ~/Git/voices/bin/voices.mjs --voices
node ~/Git/voices/bin/voices.mjs --voices --json
node ~/Git/voices/bin/voices.mjs -v 'Siri Voice 2 (zh-CN)' '你好，欢迎来到直播间。'
node ~/Git/voices/bin/voices.mjs -v 'Siri Voice 2 (yue-HK)' -o /tmp/demo.caf '你好，歡迎嚟到直播間。'
```

CLI 支持 `-v/--voice`、`-r/--rate`、`-a/--audio-device`、`-o/--output`、`-f/--file`。以 `-` 开头的朗读文本放在 `--` 后。可选地运行 `npm link` 后用 `voices` 命令。

Node API 保留 `native-say` 的函数名与调用方式：

```js
import {say, getVoices, killRunningSay} from '../voices/src/index.js';

const voices = await getVoices();
await say('你好', {voice: 'Siri Voice 2 (zh-CN)', skipRunningCheck: true});
await killRunningSay();
```

`say(text, options)`、`getVoices()`、`killRunningSay()`、`checkIfSayIsRunning()`、`getAudioDevices()`、`getDataFormats()`、`getFileFormats()` 均可使用。原有音色名和选项仍交给 `native-say`；Windows 始终使用 `native-say`。macOS 中新加入的声音或通过系统 ID 指定的声音走 Swift。未知音色会报错，不会静默换成其他声音。

`getVoices()` 保留 `name`、`languageCode`、`example` 字段，并补充 `identifier`、`language`、`quality`、`isSiri`、`engine`。新增 Siri 声音的名称包含语言代码，例如 `Siri Voice 2 (zh-CN)` 与 `Siri Voice 2 (yue-HK)`；Natural 版本单独标记。`voice` 可填完整 `name` 或精确的 `identifier`。列表会在 `getVoices()` 调用时刷新，朗读复用缓存。

macOS 需要 Xcode Command Line Tools 提供的 Swift（`xcode-select --install`）。本机实测，同一份 Swift 代码编译成独立二进制后会丢失部分 Siri 声音，因此通过 Swift 解释器执行源码；每次 Siri 朗读有解释器启动开销。声音需事先在系统设置中下载，程序只枚举当前可用的声音。

Swift 后端支持朗读、输入文件、输出文件、语速和输出设备。`rate` 沿用 WPM 输入，以 175 为基准换算到 AVFoundation 的归一化语速并限制到系统范围，实际速度与 `say` 不完全相同。输出文件推荐 `.caf`，也支持系统能写入的 PCM 格式（如 `.wav`、`.aiff`）；MP3 通过 FFmpeg 转换。`getFileFormats()` / `getDataFormats()` 保留原生 `say` 的格式列表，并不承诺所有格式都可用于 Swift 后端。Swift 声音不支持 `networkSend`、`channels`、`quality`、`volume`，指定时会明确报错。自定义输出设备按设备 ID、UID 或名称前缀选择，先生成音频再播放。

封装只终止自身启动的 Swift 朗读；有本模块发起的原生朗读时，仍调用 `native-say` 的停止方法。`skipRunningCheck: true` 适合已有串行队列的直播调用。

`~/Git/blivechat-say` 通过相邻目录的源码路径导入此 API；保持两个目录相邻，并分别安装依赖。用户音色映射同时接受名称与 ID，队列和热更新方式保持不变。`user-voices.json` 不由此工具改写。

```sh
npm test
cd ../blivechat-say
npm test
npm run voices
npm run check
```

`voices.json` 是试听目录的数据源。每项包含网页显示名 `displayName`、调用名 `name`、精确的系统音色 ID `identifier`、地区代码 `locale`、试听文本 `text`、音频路径 `audio` 和秒数 `duration`。运行时 API 的完整本机音色列表由系统动态枚举，不受网页展示名单限制。

## 调整展示名单

`excluded-voices.json` 中的 `excludedVoiceIds` 数组维护不展示的音色，填写 `voices.json` 中对应条目的 `id`：

```json
{
  "excludedVoiceIds": [
    "eddy-chinese-china-mainland",
    "yu-shu"
  ]
}
```

目前排除了 17 个“标准版且显示名为英文”的音色。把 ID 加入名单即可排除，删除 ID 即可恢复；不同地区、不同音质版本有各自的 ID，可以单独调整。未来调整音色列表时，暂时不存在的 ID 仍可保留在排除名单中。

修改后运行 `npm run build`，网页、README、筛选计数会同步更新。发布目录只包含保留的音色 JSON 和音频；原始 `voices.json` 和 `audio/` 保留完整数据，方便恢复。

## 音色信息与排序

音质保存在 `quality`（`standard` / `enhanced` / `premium`），方言保存在 `dialect`。页面和 README 共用排序：大陆 → 台湾 → 香港；地区内按音色的英文名称排列，同名优先 Premium → Enhanced → Standard。

方言按采集到的系统语言代码标注：`zh_CN` 为普通话，`zh_TW` 为台湾口音，`zh_HK` 为粤语；`cnln`、`cnsn`、`cnsc` 分别标为东北话（辽宁）、陕西话、四川话。地区细分来自本机 `say -v '?'` 的 locale；参考 [Apple 的语音语言列表](https://support.apple.com/en-asia/111748) 和 [功能可用性](https://www.apple.com/macos/feature-availability/)。质量分级保留系统名称中的 Enhanced / Premium 信息，未带后缀的条目在本目录中标为标准版。

```sh
npm ci
npm run build
npm run preview
```

打开 http://localhost:8766 预览。构建会从 JSON 生成网页和 README 表格，输出目录为 `dist/`。仅生成 README 时运行 `npm run generate`。

所有维护脚本统一使用 Node.js 24+，无需 Python。本地预览只需要 Node；生成音频还需要 FFmpeg（含 `ffprobe`）和 Swift。

在安装了对应语音的 Mac 上运行 `npm run generate:audio`，可以通过本项目的 CLI 重新生成 MP3、更新时长及 README。只生成部分样本时可运行 `npm run generate:audio -- --only siri-zh-cn-2 siri-yue-hk-2`。现有与新加入的音色均优先通过精确系统 ID 生成，保证网页试听与配置指定同一个声音。

页面样式和交互位于 `site/`。网站使用原生 HTML、CSS 和 JavaScript，无第三方运行时依赖。

分享封面位于 `site/assets/og-image.png`，尺寸为 1200 × 630；OpenGraph 和 Twitter 分享卡片使用 PNG，README 使用无损压缩的 `site/assets/readme-cover.webp`。生成提示词保存在 `site/og-image.prompt.txt`。构建会将 `site/assets/` 复制到 `dist/assets/`。OpenGraph、Twitter 分享卡片和 canonical 地址在 `site/template.html` 中维护；更换域名时需同步更新其中的绝对 URL。

首屏角色使用从分享封面提取的透明背景图片 `site/assets/hero-character.webp`，尺寸为 800 × 800；编辑提示词保存在 `site/hero-character.prompt.txt`。角色、播放器与贴纸的布局由 `site/styles.css` 维护。

`.github/workflows/pages.yml` 会在推送 `main` 后构建并部署到 GitHub Pages，也支持手动触发。仓库 Pages 的 Source 需设为 GitHub Actions。所有站内资源均使用相对路径，支持 `/voices/` 项目路径。
