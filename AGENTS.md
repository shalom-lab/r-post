# RPost content workflow

This repository has two content operations: **topic** and **post**.

## Topic

- Read the active topic prompt from `prompt-rules/index.json`.
- Write candidates to `topics/index.json`.
- Every candidate needs a unique `id`, title, short blurb, category, real R dataset, and 3–5 section outline.
- Avoid duplicate titles. Do not add scheduling or queue fields.
- A topic is a candidate when `articleId` is empty and written when `articleId` points to a post.

## Post

- Accept either a topic ID from `topics/index.json` or a free-form subject.
- Treat the user's explicit title, section names, section count, order, examples, and output format as binding. They override style-pack defaults.
- Write Chinese posts as a natural conversation with the reader. Prefer short, direct sentences and the smallest runnable code that teaches the requested operation.
- When the request is already specific, generate the QMD directly without adding a topic first or asking for redundant confirmation.
- Read the active post prompt from `prompt-rules/index.json`.
- Write the source to `content/drafts/<slug>.qmd`.
- Keep examples reproducible with real data available to R.
- Prefer packages already installed by the post workflow. If the requested operation needs another package, update the workflow dependency list with the QMD.
- Update `content/index.json`; when based on a topic, set that topic's `articleId`.
- GitHub Actions renders QMD to `content/published/<slug>.md` and embeds local images.

## Conversation shortcuts

- “生成选题” means generate candidates and update `topics/index.json`.
- “撰写这个选题” means create its QMD directly; no scheduling step.
- “渲染” means render the specified QMD and update the Markdown/index.
- Never recreate scheduling, ranking, queue, or automatic daily writing logic.
