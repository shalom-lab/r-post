# RPost 工作流

人和 Bot 走同一条主线，只是谁动手可以互换。网页只读；真相在仓库文件里。

## 主线

1. **选题**：把候选与大纲写入 `topics/index.json`，再运行 `node scripts/update-topics-md.mjs`（不要手改 `topics/index.md`）。
2. **定夺**：人选定写哪一条（或自由主题）。未点头前不写正文。
3. **写作**：按 `prompt-rules/` 写正文；默认可直接写入 `content/posts/`。不必先建 `.drafts/` 或另开「预览过闸」步骤；用户说改就直接改线上文。
4. **Post-content 检查（必做，不可删）**：按 `prompt-rules/post-content-check.md` 逐项过（去 AI 味（按 qu-ai-wei）、人话标题、白话用词、无必要不建中间变量、场景是否常用等）。未通过先改到过，再推；通过后写入 `content/posts/YYYYMMDD-ascii-slug/YYYYMMDD-中文标题.qmd`。
5. **自动化**：QMD 落盘并合入后，由 `render.yml` 渲染 Markdown、嵌图、更新 `content/index.json`；Pages 负责上站。

卡点在前面：选题、大纲、成稿、**Post-content 检查**、QMD 能否定稿落盘。落盘之后不要再人工重复渲染流程。

## 文件约定

- 选题源：`topics/index.json`；阅读视图：`topics/index.md`（生成物）。
- 文章：`content/posts/` 下按 `YYYYMMDD-ascii-slug` 目录；QMD/MD 文件名为 `YYYYMMDD-中文标题`；清单里的 `id` 为完整文件夹名。
- 风格：`prompt-rules/index.json` 指向当前选题/写作 prompt；场景带入见 `writing-style.md`；落盘前检查见 `post-content-check.md`（必做）。
- 分类只能是：`r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。
- 不建永久图片目录；不添加调度、队列、排名、自动日更字段。
- 从候选写成文时，回写该条的 `article` 元数据，再刷新选题 Markdown。

## 对话快捷语

- 「生成选题」→ 追加候选与大纲到 `topics/index.json`，再刷新 Markdown。
- 「写选题 …」→ 直接写当日 `YYYYMMDD-slug` QMD（边写边做 Post-content 检查），并更新该选题的 `article`。
- 「写一篇……」→ 同上：检查过了就推；用户说改就直接改线上文。
- 「渲染」→ 仅在需要本地核验时；默认依赖 `render.yml`。

## 可选入口（非默认）

- 对话或直接改仓库文件：默认路径。
- `node scripts/rpost.mjs`：本地脚本入口，同样写上述文件。
- `topic-generate.yml` / `post-generate.yml`：DeepSeek 可选自动化，**可能跳过 Post-content 检查就推默认分支**；日常协同不要当作默认。人机主线必须先检查再落盘。

## 提交前依赖检查

成稿若引入新的 R 包，提交前对照 `.github/workflows/render.yml`（`setup-r-dependencies` 的 `packages` 列表）。CI 里没有的包先补上再推，避免 Render 失败。
