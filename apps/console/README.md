# RPost Reader

只读内容站，包含文章列表、选题 Markdown、文章阅读页，以及可选的 BYOK GitHub 连接页。

文章数据来自 `content/index.json`，正文来自 `content/posts/**/*.md`，选题页来自自动生成的 `topics/index.md`。阅读不需要 Token。

```bash
# 在仓库根目录
npm run dev
npm run build
```

生产 base 为 `/r-post/`，由 `pages.yml` 部署到 GitHub Pages。
