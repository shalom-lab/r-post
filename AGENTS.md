# RPost 工作流

- 网站阅读须验证 Token 与允许的 GitHub 账号，验证通过后才加载静态内容。文章清单与正文仍是静态文件；公众号待传排期写在 `wechat/queue.json`，已上传草稿写在 `wechat/wechat_draft.json`。

## 主线

1. **选题**：把候选与大纲写入 `topics/index.json`，再运行 `node scripts/update-topics-md.mjs`（不要手改 `topics/index.md`）。
2. **定夺**：人选定写哪一条（或自由主题）。未点头前不写正文。
3. **写作**：按 `prompt-rules/` 写正文；默认可直接写入 `content/posts/`。不必先建 `.drafts/` 或另开「预览过闸」步骤；用户说改就直接改线上文。
4. **Post-content 检查（必做，不可删）**：按 `prompt-rules/post-content-check.md` 逐项过（去 AI 味（按 qu-ai-wei）、人话标题、白话用词、无必要不建中间变量、场景是否常用等）。未通过先改到过，再推；通过后写入 `content/posts/YYYYMMDD-ascii-slug/YYYYMMDD-中文标题.qmd`。
5. **自动化**：QMD 写入仓库并合入后，由 `render.yml` 渲染 Markdown、嵌图、更新 `content/index.json`；Pages 负责上站。
6. **公众号排期（可选）**：直接改 `wechat/queue.json` 定待传顺序，再 `npm run wechat:draft`（或 Actions）上传草稿。网页只读展示，不写排期。不写进选题或文章清单。

卡点在前面：选题、大纲、成稿、**Post-content 检查**、QMD 能否定稿入库。入库之后不要再人工重复渲染流程。

## 文件约定

- 选题源：`topics/index.json`；阅读视图：`topics/index.md`（生成物）。
- 文章：`content/posts/` 下按 `YYYYMMDD-ascii-slug` 目录；QMD/MD 文件名为 `YYYYMMDD-中文标题`；清单里的 `id` 为完整文件夹名。
- 风格：`prompt-rules/index.json` 指向当前选题/写作 prompt；场景带入见 `writing-style.md`；入库前检查见 `post-content-check.md`（必做）。
- 分类只能是：`r-plot`、`r-stats`、`r-base`、`r-tidyverse`、`r-code-management`。
- 不建永久图片目录；写作主线不添加调度、排名、自动日更字段。待传顺序在 `wechat/queue.json`，已上传草稿在 `wechat/wechat_draft.json`。
- 从候选写成文时，回写该条的 `article` 元数据，再刷新选题 Markdown。

## 对话快捷语

- 「生成选题」→ 追加候选与大纲到 `topics/index.json`，再刷新 Markdown。
- 「写选题 …」→ 直接写当日 `YYYYMMDD-slug` QMD（边写边做 Post-content 检查），并更新该选题的 `article`。
- 「写一篇……」→ 同上：检查过了就推；用户说改就直接改线上文。
- 「渲染」→ 仅在需要本地核验时；默认依赖 `render.yml`。

## 可选入口（非默认）

- 对话或直接改仓库文件：默认路径。选题、写作不再走 DeepSeek 本地脚本。
- Actions 默认保留 `render.yml`（渲染）与 `pages.yml`（部署）。公众号草稿由 `wechat-draft.yml` 或 `npm run wechat:draft` 处理。

## 提交前依赖检查

成稿若引入新的 R 包，提交前对照 `.github/workflows/render.yml`（`setup-r-dependencies` 的 `packages` 列表）。CI 里没有的包先补上再推，避免 Render 失败。

## 开发与验证

- 前端位于 `apps/console/`，使用 React、TypeScript、Vite 和 npm workspace；Node.js 与 CI 对齐使用 22。
- 在仓库根目录运行 `npm ci` 安装依赖，`npm run dev` 启动本地站点。
- `npm run dev`、`npm run build`、`npm run sync` 都会先更新文章索引、选题 Markdown，再同步公开数据；这些命令可能改变生成文件，提交前检查 diff。
- 前端改动运行 `npm run build` 和 `npm run lint -w apps/console`；纯文档改动核对内容与路径即可，阅读权限改动还需运行 `npm run test:access`，排期改动还需运行 `npm run test:queue`。
- 构建产物位于根目录 `dist/`，生产 base 为 `/r-post/`；修改路由时同步检查 `vite.config.ts` 中供 Pages 直接访问的静态入口。
- 不直接维护 `apps/console/public/` 的同步副本，不提交真实凭据或 `.env`，不使用会将 Token 打进浏览器包的 `VITE_GH_TOKEN`。
- 开始工作先查看 git status，保留已有改动；完成后说明验证结果。

## 网页阅读权限

- 允许的个人账号在 `apps/console/src/access-policy.ts` 配置，空列表拒绝所有账号；访问者不能通过连接页修改白名单。
- 使用 Token 调用 GitHub `/user` 验证身份，不以公开仓库可读作为账号授权依据。
- 未验证时不挂载文章页面、不请求文章清单或正文；验证失败保持关闭，清除或更换 Token 后重新验证。
- 正文继续读取静态文件，不携带 Token，不通过 GitHub Contents API 动态读取或改写仓库内容。
- 此机制控制网页显示；公开仓库和静态文件的直接链接仍可访问，不提供内容保密。

## 公众号排期

- 源文件：`wechat/queue.json` 只记待传 `id` 和顺序；`wechat/wechat_draft.json` 只追加本流水线 `draft/add` 成功的稿，不收录后台手建草稿。失败不写。
- 排期在仓库里直接改 `wechat/queue.json`（网页不再提供加入/移出/排序/上传）。
- 上传草稿读已渲染 Markdown（不重新跑 Quarto），经 `markmuse-wechat` 转 HTML；正文会去掉标题下的 `RPost` 和日期行。主题 CSS 在 `wechat/custom-md-css/`，由 `wechat/config.json` 的 `theme` 选用（`all` 则每个主题各传一期，标题前加主题名）。再向 token 中控取 `access_token`，按顺序每两篇调用一次微信 `draft/add`。末尾剩一篇则单独一期。
- 中控账号名、作者写在 `wechat/config.json`。只要 `TOKEN_CENTER_URL` / `TOKEN_CENTER_API_KEY`（`.env` 或 Actions secret）去中控拿 token。新建草稿走微信固定 `draft/add`，不必再配 URL。群发/发布尚未做。见 `wechat/tips.md`。
- 本地：复制 `wechat/env.example` 为 `wechat/.env`，中控可跑在本机，然后 `npm run wechat:draft`。
- 定时群发不在本仓库处理。不把微信密钥放进前端或 `VITE_*`。
