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
cover/                     # 公众号封面（见 cover/AGENTS.md、cover/rules.md）
wechat/queue.json          # 公众号待传排期
wechat/wechat_draft.json   # 已成功上传的微信草稿
AGENTS.md                  # 人机共用操作说明
```

- `topics/index.md`、`content/index.json`、`apps/console/public/` 是生成或同步产物，不要当源文件改。
- 分类固定为 `r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。

## 封面（公众号大图）

- 成品只要 **900×383** 大图；出图用 16:9 + 两色参考蒙版（白=裁空、黑=作画，黑带内留 margin），再 `npm run crop-cover` 裁成 2.35:1。
- 清单与预览：`cover/cover.json`（源）、`cover/cover.md`（生成，勿手改）；成图在 `cover/images/`。网页「封面」页（`/covers`）读同步后的 `public/cover/`。
- 作图规范：`cover/rules.md`；流程：`cover/AGENTS.md`。蒙版丢失时可 `npm run make-cover-ref` 重生成。

## 自动化

- **默认**：`render.yml` 在 QMD 变更后渲染、嵌图、更新清单；`pages.yml` 部署只读站。
- **封面**：Cursor Automation `RPost-cover` 在 `master` push 或定时跑；先同步清单，再只给未启用封面补图；有变更时**直接 commit/push 到 `master`**（不要开 PR）。细则见 `cover/AGENTS.md`。
- 选题和写作通过对话完成，直接改仓库文件。
- 公众号：主页选定后写入 `wechat/queue.json`。目前只上传草稿（`npm run wechat:draft`），不涉及群发/发布。中控变量见 `wechat/env.example`。

网页阅读需要 Token，并验证其对应账号是否在 `apps/console/src/access-policy.ts` 白名单内。通过后读取静态文章。此门槛不保护公开仓库或静态文件直链。浏览器配置字段：`gh-repo-rpost`、`gh-token-rpost`。

```bash
npm install
npm run dev
```

站点：https://shalom-lab.github.io/r-post/
