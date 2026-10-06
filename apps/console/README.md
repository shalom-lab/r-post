# RPost Reader

只读内容站，包含文章列表、选题 Markdown、文章阅读页、公众号排期页，以及用于验证阅读账号的 GitHub 连接页。

文章数据来自 `content/index.json`，正文来自 `content/posts/**/*.md`。公众号排期来自仓库里的 `wechat/queue.json`，由获准账号用 Token 写入。阅读需要有效 Token，且其对应账号必须列入 `src/access-policy.ts`；通过 GitHub `/user` 验证后才加载静态文章，正文请求不附带 Token。空白名单拒绝所有账号。公开静态链接仍可直接访问。

```bash
# 在仓库根目录
npm run dev
npm run build
```

生产 base 为 `/r-post/`，由 `pages.yml` 部署到 GitHub Pages。
