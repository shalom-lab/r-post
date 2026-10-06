# RPost

用仓库文件完成 R 语言短教程的选题与写作；GitHub Pages 只展示已经渲染好的文章。

## 主线

候选选题与大纲 → 人选定 → 写作与推文润色 → Post-content 检查（必做）→ 通过后定稿 QMD → Actions 自动渲染并上站。

人和 AI 共用同一套步骤与文件，见 `AGENTS.md`。风格在 `prompt-rules/`。

```text
生成 5 个候选选题及大纲
把选题 003 写成公众号推文
写一篇 R 语言保存数据的 5 种方法，二级标题依次是……
```

## 仓库里看什么

```text
topics/index.json          # 选题真相
prompt-rules/              # 选题与写作风格
content/posts/YYYYMMDD-slug/  # 定稿 QMD（及渲染后的 Markdown）
wechat/queue.json          # 公众号推文排期
AGENTS.md                  # 人机共用操作说明
```

- `topics/index.md`、`content/index.json`、`apps/console/public/` 是生成或同步产物，不要当源文件改。
- 分类固定为 `r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。

## 自动化

- **默认**：`render.yml` 在 QMD 变更后渲染、嵌图、更新清单；`pages.yml` 部署只读站。
- 选题和写作通过对话或本地脚本完成，不提供生成 Actions。
- 公众号：主页选定后写入 `wechat/queue.json`。上传草稿用 `npm run wechat:draft`，或配置 `WECHAT_API_KEY` 后跑 `wechat-draft.yml`。中控若只在本机，用本地脚本。账号名和作者在 `wechat/config.json`，不是 secret。

网页阅读需要 Token，并验证其对应账号是否在 `apps/console/src/access-policy.ts` 白名单内。通过后读取静态文章。此门槛不保护公开仓库或静态文件直链。浏览器配置字段：`gh-repo-rpost`、`gh-token-rpost`。可选本地生成脚本使用环境变量 `DEEPSEEK_API_KEY`，不进入网页。

```bash
npm install
npm run dev
```

站点：https://shalom-lab.github.io/r-post/
