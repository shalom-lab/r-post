# RPost conversation workflow

RPost is maintained through conversation. The website is a read-only article library.

## Generate topics

- Read the active topic style from `prompt-rules/index.json`.
- Store every candidate in `topics/index.json`, the machine-readable source of truth.
- Run `node scripts/update-topics-md.mjs` after changing topic data; never edit the generated `topics/index.md` by hand.
- Topic numbers shown in Markdown follow JSON array order.
- Treat the user's theme, count, audience, and required concepts as binding.
- Use real datasets for data analysis. Built-in character vectors or minimal literal examples are valid for regex, string, and syntax lessons.
- Avoid duplicate topics. Status is either `候选` or `已成稿`.
- Assign exactly one category automatically: `r-plot` (R 作图), `r-stats` (R 统计), `r-base` (R 基础), `r-tidyverse` (R tidyverse), or `r-code-management` (R 代码管理).

## Write an article

- Accept either a displayed topic number, a JSON topic id, or a free-form request.
- Preserve explicit titles, heading order, examples, and output requirements.
- Read the active post style from `prompt-rules/index.json`.
- Find the largest directory number under `content/posts/` and use the next three-digit number.
- Create `content/posts/NNN-ascii-slug/NNN-中文标题.qmd`.
- Do not create an images directory. Quarto may create temporary figures; the render workflow embeds them into Markdown as data URIs.
- Use conversational Chinese and the smallest runnable R code that teaches the operation.
- Add title, description, author, date, category, category-slug, tags, and `format: gfm` to QMD frontmatter.
- When writing from a candidate, add its article metadata in `topics/index.json`, then regenerate `topics/index.md`.

## Render and publish

- `.github/workflows/render.yml` renders every QMD to a same-named Markdown file in its article directory.
- `scripts/embed-images.mjs` embeds generated images into Markdown.
- `scripts/update-index.mjs` scans article folders and generates `content/index.json`; never maintain the manifest by hand.
- The React site reads only the generated manifest and rendered Markdown.

## Conversation shortcuts

- “生成选题” means append structured candidates and outlines to `topics/index.json`, then regenerate `topics/index.md`.
- “写选题 003” means create the next numbered QMD and update topic 003.
- “写一篇……” means create the next numbered QMD directly.
- “渲染” means render QMD, embed images, and regenerate the manifest.
