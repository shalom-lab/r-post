# RPost

用仓库文件完成 R 语言短教程的选题与写作；GitHub Pages 只展示已经渲染好的文章。

## 主线

候选选题与大纲 → 人选定 → 写作与推文打磨 → 定稿 QMD → Actions 自动渲染并上站。

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
content/posts/NNN-slug/    # 定稿 QMD（及渲染后的 Markdown）
AGENTS.md                  # 人机共用操作说明
```

- `topics/index.md`、`content/index.json`、`apps/console/public/` 是生成或同步产物，不要当源文件改。
- 分类固定为 `r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。

## 自动化

- **默认**：`render.yml` 在 QMD 变更后渲染、嵌图、更新清单；`pages.yml` 部署只读站。
- **可选**：`topic-generate.yml` / `post-generate.yml` 用 DeepSeek 生成选题或 QMD（可能直推默认分支，日常请先人工定夺）。

网页阅读不需要 Token。可选 BYOK 字段：`gh-repo-rpost`、`gh-token-rpost`。DeepSeek Key 仅作仓库 Secret `DEEPSEEK_API_KEY`。

```bash
npm install
npm run dev
```

站点：https://shalom-lab.github.io/r-post/
