# 维护声音目录

`voices.json` 是唯一的音色数据源。每项包含网页显示名 `displayName`、系统音色名 `name`、地区代码 `locale`、试听文本 `text`、音频路径 `audio` 和秒数 `duration`。

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

方言按采集到的系统语言代码标注：`zh_CN` 为普通话，`zh_TW` 为台湾国语，`zh_HK` 为粤语；`cnln`、`cnsn`、`cnsc` 分别标为东北话（辽宁）、陕西话、四川话。地区细分来自本机 `say -v '?'` 的 locale；参考 [Apple 的语音语言列表](https://support.apple.com/en-asia/111748) 和 [功能可用性](https://www.apple.com/macos/feature-availability/)。质量分级保留系统名称中的 Enhanced / Premium 信息，未带后缀的条目在本目录中标为标准版。

```sh
npm ci
npm run build
npm run preview
```

打开 http://localhost:8766 预览。构建会从 JSON 生成网页和 README 表格，输出目录为 `dist/`。仅生成 README 时运行 `npm run generate`。

在安装了对应语音的 Mac 上运行 `python3 scripts/generate.py`，可以重新生成 MP3、更新时长及 README；需要 Python 3、FFmpeg 和系统 `say` 命令。

页面样式和交互位于 `site/`。网站使用原生 HTML、CSS 和 JavaScript，无第三方运行时依赖。

`.github/workflows/pages.yml` 会在推送 `main` 后构建并部署到 GitHub Pages，也支持手动触发。仓库 Pages 的 Source 需设为 GitHub Actions。所有站内资源均使用相对路径，支持 `/voices/` 项目路径。
