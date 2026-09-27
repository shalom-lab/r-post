# RPost 工作流

人和 Bot 走同一条主线，只是谁动手可以互换。网页只读；真相在仓库文件里。

## 主线

1. **选题**：把候选与大纲写入 `topics/index.json`，再运行 `node scripts/update-topics-md.mjs`（不要手改 `topics/index.md`）。
2. **定夺**：人选定写哪一条（或自由主题）。未点头前不落成稿。
3. **写作**：按 `prompt-rules/` 打磨推文向正文，定稿为 `content/posts/NNN-ascii-slug/NNN-中文标题.qmd`。
4. **自动化**：QMD 定稿并合入后，由 `render.yml` 渲染 Markdown、嵌图、更新 `content/index.json`；Pages 负责上站。

卡点只在前面：选题是否值得做、大纲切口、成稿质量、QMD 能否定稿。定稿之后不要再人工重复渲染流程。

## 文件约定

- 选题源：`topics/index.json`；阅读视图：`topics/index.md`（生成物）。
- 文章：`content/posts/` 下按编号目录；QMD 与渲染后的 Markdown 同名。
- 风格：`prompt-rules/index.json` 指向当前选题/写作 prompt；场景带入与篇章切分见 `prompt-rules/writing-style.md`。
- 分类只能是：`r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。
- 不建永久图片目录；不添加调度、队列、排名、自动日更字段。
- 从候选写成文时，回写该条的 `article` 元数据，再刷新选题 Markdown。

## 对话快捷语

- 「生成选题」→ 追加候选与大纲到 `topics/index.json`，再刷新 Markdown。
- 「写选题 003」→ 按显示编号或 id 写下一号 QMD，并更新该选题的 `article`。
- 「写一篇……」→ 直接写下一号 QMD。
- 「渲染」→ 仅在需要本地核验时；默认依赖 `render.yml`。

## 可选入口（非默认）

- 对话或直接改仓库文件：默认路径。
- `node scripts/rpost.mjs`：本地脚本入口，同样写上述文件。
- `topic-generate.yml` / `post-generate.yml`：DeepSeek 可选自动化，可能未审就推到默认分支；日常协同不要当作默认。

## 提交前依赖检查

成稿若引入新的 R 包，提交前对照 `.github/workflows/render.yml`（`setup-r-dependencies` 的 `packages` 列表）。CI 里没有的包先补上再推，避免 Render 失败。
