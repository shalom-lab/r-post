# RPost Console

GitHub Pages 操作台：选题（topic）∥ 写作（post）。

## 本地

```bash
# 仓库根目录
npm install
npm run dev
```

开发时打开 Vite 提示的地址；生产 base 为 `/r-post/`（project Pages）。

## 要点

- **路由**：`BrowserRouter`，地址如 `/r-post/topics`，旧 `#/topics` 链接自动迁移。构建为固定页面生成独立入口，支持 Pages 直接访问和刷新；动态文章地址由 `404.html` 加载应用（Pages 初次请求仍返回 HTTP 404）。
- **数据**：`npm run build` 会先 `sync-public`，把 `content/`、`prompt-rules/`、`topics/` 拷进 `public/`
- **设置**：本机 `localStorage` 的 `gh-repo-rpost` / `gh-token-rpost`（不要用 `VITE_GH_TOKEN`）
- **构建产物**：根目录 `dist/`（供 `pages.yml` artifact 上传）

## Pages

仓库 Settings → Pages → Source → **GitHub Actions**。  
站点：https://shalom-lab.github.io/r-post/
