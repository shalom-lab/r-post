# 公众号草稿：配置与触发

仓库是公开的。中控地址、调中控的密钥都不要写进 `config.json` 或源码。清单如下。

## 必须藏起来

| 名字 | 放哪 | 是什么 |
|---|---|---|
| `WECHAT_API_KEY` | GitHub Actions secret，以及本机 `wechat/.env` | 中控 `data/apps.json` 里的 `api_key`。调 `GET/POST /access_token/:name` 时放在头 `X-Api-Key`。 |
| `WECHAT_TOKEN_URL` | 同上 | 中控根地址，不要末尾斜杠。本机一般是 `http://127.0.0.1:8795`。公网地址同样只放 secret，不要提交。 |

GitHub：仓库 → Settings → Secrets and variables → Actions。网页上的「上传待发草稿」走 Action 时，这两项都要有。

本机：复制 `wechat/env.example` 为 `wechat/.env`（已 gitignore，不要提交）。中控在自己电脑上时，用这个文件，不要点网页上传。

## 可以进仓库

`wechat/config.json`：

| 字段 | 含义 |
|---|---|
| `appName` | 中控 `apps` 里那条的 `name`，例如 `mp_tumei`。对应请求路径 `/access_token/mp_tumei`。 |
| `author` | 微信草稿署名。空着就不署名。不是 secret。 |
| `articlesPerDraft` | 一期几篇。现在是 `2`，脚本还会卡在最多 2 篇。 |
| `theme` | 正文样式主题名，对应 `mdcss/<主题名>.css`。默认 `前端之巅`。上传时作为 `customCss` 传给 `getWeChatHtml`（与 markmuse 默认样式合并）。 |

`wechat/queue.json` 只是待传排期：文章 id 和顺序。网页主页点「加入排期」写这里。上传成功后会从这里拿掉。

`wechat/wechat_draft.json` 只记 **RPost 自动 `draft/add` 成功** 的稿（`source: "rpost"`、`media_id`、篇目 id、当时标题）。不拉微信草稿箱列表，你在后台手建的草稿不会进这份账。失败不写。不是定时群发记录。

上传前会从已渲染 Markdown 去掉一级标题，以及标题下的 `RPost` / `YYYY-MM-DD` 两行（Quarto 留下的作者与日期）。微信草稿自带署名和日期，正文开头重复会冲突。

## 网页阅读用的 GitHub Token

这不是微信密钥。连在浏览器里，只用来验证你是谁、改排期文件。

- 阅读：能调 GitHub `/user` 即可。
- 加入/移出/排序排期：需要这个仓库的 **Contents 写权限**。
- 点网页「上传待发草稿」：还需要 **Actions 写权限**（`workflow_dispatch`）。中控在本机时不要用这一步。

不要用 `VITE_GH_TOKEN`，不要把 Token 写进仓库。

## 上传草稿怎么触发（不是定时）

选定排期不会自动往微信传。

1. **中控在本机（当前做法）**  
   中控 `docker compose up` 之后：

   ```bash
   npm run wechat:draft
   ```

   读 `wechat/.env`，按排期每两篇建一期微信草稿。成功则追加 `wechat/wechat_draft.json`，并从 `wechat/queue.json` 拿掉这几篇。失败不记账。改完这两个文件后自己提交。

2. **网页按钮**  
   排期页「上传待发草稿」会触发 `wechat-draft.yml`。GitHub 跑在云上，访问不到你电脑的 `127.0.0.1`。只有中控有公网地址、并且 secret 里 `WECHAT_TOKEN_URL` 填的是那个地址时才有用。

没有按点钟自动上传。定时群发仍是你在微信侧另做。

## access_token 怎么拿

中控统一缓存微信 token，AppSecret 只留在中控。RPost 只做：

1. `GET {WECHAT_TOKEN_URL}/access_token/{appName}`，头 `X-Api-Key: {WECHAT_API_KEY}`
2. 返回 `expired: false` → 用 `access_token`
3. 返回 `expired: true` → 再 `POST` 同一地址强制刷新，用新 token
4. 拿去调微信：正文图 `media/uploadimg`、封面 `material/add_material`、草稿 `draft/add`

## 不要放进仓库的东西

- 中控的 `AppSecret`、`api_key`
- `WECHAT_TOKEN_URL`（含本机或内网地址）
- `wechat/.env`
- 微信 `access_token` 本身
- 浏览器 GitHub Token
