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

- **路由**：`HashRouter`，子路径可直接打开，如 `/#/topics`
- **数据**：`npm run build` 会先 `sync-public`，把 `content/`、`prompt-rules/`、`topics/` 拷进 `public/`
- **设置**：本机 `localStorage` 的 `gh-repo-rpost` / `gh-token-rpost`（不要用 `VITE_GH_TOKEN`）
- **构建产物**：根目录 `dist/`（供 `pages.yml` artifact 上传）

## Pages

仓库 Settings → Pages → Source → **GitHub Actions**。  
站点：https://shalom-lab.github.io/r-post/
