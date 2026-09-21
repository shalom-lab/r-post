# RPost

用共享 Prompt 完成两件事：**生成候选选题（topic）**和**撰写 R 教程（post）**。

## 对话式使用

在项目对话中可以直接说：

- “使用默认规则生成 5 个 R 可视化候选选题。”
- “根据选题 `topic-xxx` 生成 QMD，使用微信短文风格。”
- “以 R 语言保存数据的 5 种方法写一篇推文，按 RDS、Excel、CSV、save()、save.image() 设置二级标题。”
- “把刚生成的 QMD 渲染为 Markdown。”

项目执行约定见 `AGENTS.md`。候选选题保存在 `topics/index.json`；QMD 和渲染后的 Markdown 分别保存在 `content/drafts/`、`content/published/`。

## Prompt

`prompt-rules/index.json` 管理多套共享规则：

- `topic_prompt_*.md`：一次生成题目、真实数据与大纲
- `post_prompt_*.md`：根据选题或自由主题生成 QMD

对话、Node 脚本和 GitHub Actions 共用这些文件。

## 命令

```bash
npm run topic -- --quota 5
npm run outline -- --topicId topic-xxx
npm run post -- --topicId topic-xxx --promptId wechat-short
npm run post -- --topic "用 iris 学会分组比较"
npm run list
```

需要配置环境变量 `DEEPSEEK_API_KEY`。

## GitHub Actions

- `topic-generate.yml`：手动生成候选选题，或为指定选题补大纲
- `post-generate.yml`：按选题 ID 或自由主题生成 QMD，并用 Quarto 渲染 Markdown
- `pages.yml`：部署操作台

仓库 Secret：`DEEPSEEK_API_KEY`。

## 操作台

GitHub Pages 操作台保留用于浏览与管理选题、稿件和 Prompt。候选选题详情中可以直接触发撰写。

浏览器连接信息只保存在本机：

```js
localStorage.setItem("gh-repo-rpost", "your-name/r-post");
localStorage.setItem("gh-token-rpost", "github_pat_xxx");
```

站点：https://shalom-lab.github.io/r-post/
