# RPost

两块能力：**选题（topic）** → **写作（post）**。

## Prompt（`prompt-rules/`）

一个 `index.json` + 扁平 md：

| 套 | 文件名 | 用途 |
|----|--------|------|
| **topic** | `topic_prompt_*.md` | AI 一次出题目+大纲 |
| **post** | `post_prompt_*.md` | 生成 QMD |

## 流水线

1. **选题**：`topic.yml`（ideate 默认带 outline；outline 仅补缺漏）
2. 勾选排期 → **写作**：`post.yml` 按序成稿 → Quarto

## localStorage（flat）

```js
localStorage.setItem("gh-repo-rpost", "your-name/RPost");
localStorage.setItem("gh-token-rpost", "ghp_xxxxxxxx");
```

Workflow 写死：`topic.yml`、`post.yml`。  
Secret：`DEEPSEEK_API_KEY`。
