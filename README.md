# RPost

通过日常对话完成选题和写作，GitHub Pages 只负责展示已经渲染的 R 教程。

## 日常使用

```text
围绕 R 语言正则表达式和字符串处理，生成 5 个候选选题及内容大纲。

把选题 003 写成公众号推文。

写一篇 R 语言保存数据的 5 种方法，二级标题依次是……
```

AI 按照 `AGENTS.md` 执行，并共用 `prompt-rules/` 中的选题与写作风格。

## 文件结构

```text
topics/
├── index.json                         # 选题数据源
└── index.md                           # 自动生成的阅读视图

content/
├── index.json                         # 自动生成
└── posts/
    ├── 001-mtcars-scatter/
    │   ├── 001-用mtcars看一眼相关与散点.qmd
    │   └── 001-用mtcars看一眼相关与散点.md
    └── 002-r-save-five-methods/
        └── 002-R语言保存数据的5种常见方法.qmd
```

- 所有候选选题和大纲由 `topics/index.json` 结构化保存，`topics/index.md` 自动生成供人阅读。
- 每篇文章使用独立编号目录，QMD 与 Markdown 同名。
- 不保存独立图片目录；渲染工作流把图片嵌入 Markdown。
- `content/index.json` 是构建产物，不手工维护。
- 分类固定为 `r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`，由生成流程自动选择。

## 自动化

- `render.yml`：QMD 变化后使用 Quarto 渲染、嵌入图片并更新文章清单。
- `topic-generate.yml`：使用 DeepSeek 生成结构化选题与大纲，并刷新选题 Markdown。
- `post-generate.yml`：从选题编号或自由主题生成 QMD、渲染 Markdown。
- `pages.yml`：构建并部署只读文章站。

网页阅读文章和选题不需要 Token。可选 BYOK 连接使用浏览器本地字段
`gh-repo-rpost` 和 `gh-token-rpost`；DeepSeek Key 只配置为仓库 Secret
`DEEPSEEK_API_KEY`。

本地预览：

```bash
npm install
npm run dev
```

站点：https://shalom-lab.github.io/r-post/
