# 公众号草稿：配置与触发

目前只做到**新建草稿**。群发、发布（sendall / masssend / freepublish / release）还没做，也不配那些地址。

## 需要你填的：只有 Token 中控

拿 `access_token` 走你自己的中控，**不是**微信 `draft/add`。本机 `wechat/.env`（从 `env.example` 复制）或 GitHub Actions secret：

| 名字 | 作用 |
|---|---|
| `TOKEN_CENTER_URL` | 中控根地址，例如 `http://127.0.0.1:8795` |
| `TOKEN_CENTER_API_KEY` | 中控 `data/apps.json` 的 `api_key`，头 `X-Api-Key` |

`appName` 在 `wechat/config.json`（现在是 `mp_r`）。拼出来：

`GET/POST {TOKEN_CENTER_URL}/access_token/mp_r`

`expired: false` 用返回的 token；`true` 再 POST 同一地址。

## 新建草稿：不用再配 URL

脚本用刚拿到的 token，直接调微信固定接口（写死在代码里，不必进 `.env`）：

- `https://api.weixin.qq.com/cgi-bin/media/uploadimg`
- `https://api.weixin.qq.com/cgi-bin/material/add_material`
- `https://api.weixin.qq.com/cgi-bin/draft/add`

这和中控地址不是一回事。发布、群发还没接。

## 三套角色（不要混名）

| 角色 | 建议变量名 | 现在干什么 |
|---|---|---|
| Token 中控 | `TOKEN_CENTER_URL` / `TOKEN_CENTER_API_KEY` | 只要 token。草稿流程会用。 |
| 微信官方 | 不用配 URL | `draft/add` 等写死 `api.weixin.qq.com`。 |
| 发布中转 wechat-release-server | `RELAY_URL` / `RELAY_API_KEY` | **以后**才用：`POST {RELAY_URL}/v1/freepublish`、`/v1/mass/sendall`。头是 `Authorization: Bearer`。 |

不要叫 `RELAY_CENTER_URL`：CENTER 已经留给中控，中转不是中控。InfoFlow 里若已用 `WECHAT_RELEASE_BASE_URL` / `WECHAT_RELEASE_RELAY_KEY`，和这里的 `RELAY_*` 是同一类，以后对齐即可。中转自己会再去问中控拿 token，RPost 调中转时不必再传 access_token。

## 可以进仓库

`wechat/config.json`：`appName`、`author`、`articlesPerDraft`（现在 2）、`theme`（对应 `wechat/custom-md-css/<theme>.css`；`all` 则每个主题各传一期）。空 `theme` 用 markmuse 默认样式。主题中文名在 `wechat/custom-md-css/themes.json`，会加到草稿标题前。

上传用已渲染 Markdown。标题下的 `RPost` 和 `YYYY-MM-DD` 两行会剥掉，避免和微信草稿自带的作者、日期叠在一起。代码块的三点窗口和横滑会改成真实节点写进去：微信吃掉 `::before`，`pre-wrap` 也会把长行折掉。

`wechat/queue.json`：待传排期。成功后从这里拿掉。

`wechat/wechat_draft.json`：只记本流水线 `draft/add` 成功的稿。不拉草稿箱，后台手建的不进账。

## 网页 GitHub Token

只验证阅读身份，不是中控钥匙，也不是微信密钥。排期改 `wechat/queue.json`，上传用 `npm run wechat:draft`（或 Actions），不走网页。

## 不要放进仓库

中控 AppSecret、`TOKEN_CENTER_API_KEY`、`TOKEN_CENTER_URL`、`RELAY_API_KEY`、`RELAY_URL`、`wechat/.env`、微信 `access_token`、浏览器 GitHub Token。
