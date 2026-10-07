# 公众号封面制作

本目录负责文章封面。作图规范见 `rules.md`。无封面不挡写作 / 渲染 / 排期；微信草稿只用 `active: true` 且文件存在的条目。

---

## 1. 目标任务

给文章做出可用的公众号**大图**（最终 2.35:1 / 900×383；不管小图），并推到 `origin/master`。

| 谁 | 目标 |
|----|------|
| 定时 Automation | 只补缺：尚无可用封面的条目；**一律豆包 Seedream** 出图 |
| 人工对话 | 按用户说的：做 / 重做 / 改某篇，或只同步清单；同样走豆包 |

出图工具固定为**豆包**（账号「迷城」、新对话 + 图像生成）。禁止用 `GenerateImage` 顶替。

**完工标准**

- 成图在 `origin/master` 的 `cover/images/`
- 对应条目：`active: true`，`prompt` 非空，`image` 指向真实文件
- 只推 feature 分支或未合并 PR → 未完工

---

## 2. 背景信息

### 文件

| 路径 | 作用 |
|------|------|
| `cover.json` | 源数据 |
| `cover.md` | 预览；禁止手改，脚本生成 |
| `images/` | 成图（成品须 900×383） |
| `templates/ref-16x9-black235-white-margins.jpg` | **已停用**（旧 16:9 蒙版，仅保留） |
| `rules.md` | 作图规范 |
| `content/index.json` | 文章清单；sync 据此挂 `id` / `title` |

### 相关脚本

| 命令 | 功能 |
|------|------|
| `node scripts/sync-cover-list.mjs` | 对照 `content/index.json` 同步封面清单；末尾刷新 `cover.md` |
| `node scripts/update-cover-md.mjs` | 从 `cover.json` 生成 `cover.md`（勿手改 md） |
| `node scripts/crop-cover-235.mjs [图…]` | **sharp** 居中裁成 2.35:1 → 900×383，原地覆盖；无参则处理 `cover/images/` 全部 |
| `node scripts/make-cover-ref-templates.mjs` | **历史**：旧 16:9 蒙版；新流程勿用 |

```bash
node scripts/sync-cover-list.mjs
node scripts/update-cover-md.mjs
node scripts/crop-cover-235.mjs cover/images/<id>.jpg
npm run crop-cover
```

### `cover.json` 字段

| 字段 | 含义 |
|------|------|
| `id` / `title` | 对照文章；`id` 由 sync 写入，勿手编 |
| `image` | 相对本目录路径；未出图为 `null`（成品 `images/<id>.jpg`，须为 900×383） |
| `active` | `true` 可用（Automation 跳过）；`false` 可补 |
| `prompt` | 实际用过的出图说明；未出图为 `null`；勿整段抄 `rules.md` |
| `note` | 流水备注，不是 prompt |

- 新条目：`active: false`，`prompt: null`；禁止无图标 `true`
- 文件丢失：改回 `false`、`image: null`，`note` 写原因，保留原 `prompt`

### 人工触发

| 说法 | 含义 |
|------|------|
| 做封面 \<id 或标题\> | 做一张；已有图也重做 |
| 重做封面 \<…\> | 新出一版，覆盖图与 prompt |
| 改封面：… | 在现有 prompt 上改，勿换题 |
| 同步封面清单 | 只 sync，不出图 |

---

## 3. 工作要求

- 只在最新 `master` 操作，直接 `git push origin master`；不开分支、不开 PR
- 只动 `cover/`（及必要时的 sync / update 脚本）；不动正文与排期主线
- 禁止手改 `cover.md`
- 出图前必须先单独构思 prompt；画面细则遵守 `rules.md`；用豆包直出 2.35:1，不用 GenerateImage 蒙版流程
- 写回：`image` 正确、`active: true`、`prompt` 必填
- Automation：不覆盖已有可用封面；不接风格偏好；一次约 1～3 篇
- 有变更则自己 commit + push；无 diff 说明无需推送；不提交密钥与无关文件；push 失败写明报错，不改开 PR 充数

---

## 4. 工作流程

共用一套步骤；入口不同只影响「选哪条、prompt 新建还是沿用」。

### Step 1 — 拉最新 master

```bash
git fetch origin master && git checkout master && git pull origin master
```

### Step 2 — 同步清单（需要时）

```bash
node scripts/sync-cover-list.mjs
```

- 按 `content/index.json` 追加新条目（默认 `active: false`）
- 可更新已有 `title`
- 除非图片文件不存在，否则不把 `active: true` 改成 `false`
- 仅「同步封面清单」：有 diff → 跳到 Step 6；无 diff → 结束

### Step 3 — 选定条目

| 入口 | 选哪些 |
|------|--------|
| Automation | `active` 非 true 或 `image` 空；已有可用封面则跳过 |
| 做 / 重做 / 改封面 | 用户点名的那篇 |
| 同步封面清单 | 不选 |

### Step 4 — 构思出图 prompt

不要只看标题就出图。规范见 `rules.md`（尤其「作图 prompt 怎么写」）。

1. 读 `rules.md`（通用 + 本项目风格）
2. **必读正文**：`content/posts/<id>/` 下 `.qmd`（或 `.md`）——痛点、场景、解法，不只看 `title`
3. 按 `rules.md` 写出**具体** prompt（钩子、冲突两边、主色、道具均来自本篇）：
   - 补缺且已有非空 `prompt` → 优先沿用，可微调尺寸
   - 新建 / 重做 → 重新读正文再构思
   - 改封面 → 在现有 prompt 上改，勿换题；仍须符合正文
4. 确认风格与通用项过关后，再出图

### Step 5 — 出图、落盘、写回

1. 按 Step 4 的 prompt，用**豆包 Seedream**「新对话」出图（细则见 `rules.md`）：提示词写死 **2.35:1 / 900×383**，只出 1 张终稿
2. 高清下载（点开大图，或控制台 `EXPECT: 1` 打包脚本）到本机，再拷到 `cover/images/<id>.jpg`
3. 若原图不是 900×383，跑 sharp 压/裁覆盖：
   ```bash
   node scripts/crop-cover-235.mjs cover/images/<id>.jpg
   ```
4. 按 `rules.md`「出图后核验」过一眼（尺寸、钩子/专名、水印可接受）
5. 更新条目：`image`、`active: true`、实际所用 `prompt`、`note` 可选
6. 跑 `node scripts/update-cover-md.mjs`

禁止再用 `GenerateImage` + 16:9 蒙版出封面。

### Step 6 — 提交并推送

1. 确认只改封面相关，且 `cover.md` 由脚本生成
2. 暂存 `cover.json`、`cover.md`、`images/*`（及改过的脚本）
3. 提交说明如：`cover: add <id>` / `cover: redo <id>`
4. `git push origin master`

### 入口接法

| 入口 | 步骤 |
|------|------|
| 定时 Automation | Step 1 → Step 2 → Step 3（补缺）→ Step 4 → Step 5 → Step 6 |
| 做封面 / 重做封面 | Step 1 → Step 3 → Step 4 → Step 5 → Step 6（需要时加 Step 2） |
| 改封面 | Step 1 → Step 3 → Step 4（微调）→ Step 5 → Step 6 |
| 同步封面清单 | Step 1 → Step 2 →（有 diff）Step 6 |
