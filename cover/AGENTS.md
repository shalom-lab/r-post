# cover/ — 公众号封面（专责）

本目录只负责文章封面。正文写作 / 渲染 / 排期仍走仓库根目录 `AGENTS.md`。

面向两类执行者：

1. **定时 Automation**（Cursor Automation Agent）：只补缺，不打扰已有封面。
2. **人工对话**：改风格、重做、点名某篇——由人触发。

---

## 文件

| 路径 | 作用 |
|------|------|
| `cover.json` | 源数据：`id` ↔ `image`、`active` |
| `cover.md` | 预览一览；**生成物，禁止手改**（含 Agent 直接编辑） |
| `images/` | 成图文件 |
| `AGENTS.md` | 本说明 |

**`cover.md` 只能由脚本生成。** 要改内容就改 `cover.json`（或跑 sync），再执行：

```bash
node scripts/update-cover-md.mjs
```

同步文章清单（对照 `content/index.json`，脚本末尾会顺带刷新 `cover.md`）：

```bash
node scripts/sync-cover-list.mjs
```

---

## 状态

| `active` | 含义 | Automation 行为 |
|----------|------|-----------------|
| `true` | 已有可用封面，`image` 指向真实文件 | **跳过，一律不做** |
| `false` | 无图或作废待补，`image` 可为 `null` | 可以制作 |

- 新文章入库后先登记为 **`active: false`**，禁止无图却标 `true`。
- 若 `active: true` 但文件丢失：改回 `false`，`image: null`，`note` 写明原因，下次补做。

---

## 定时 Automation 固定流程（按顺序，勿跳）

适用：计划任务 / 定时 Agent「补全封面」。**不要**在定时任务里改已有封面或做风格实验。

### 1. 先同步清单

```bash
node scripts/sync-cover-list.mjs
```

- 以 `content/index.json` 为准：有新文章就追加条目（默认 `active: false`）。
- 已有条目：可更新 `title`；**不得**把已是 `active: true` 的改成 false，除非发现图片文件不存在。
- 同步后跑 `node scripts/update-cover-md.mjs`。

### 2. 再只补缺

1. 读 `cover/cover.json`，筛出 `active !== true` 或 `image` 为空的条目。
2. **已有封面（active + 文件在）→ 跳过。**
3. 对每条待补：读对应文章标题 / 简介 / 分类（`content/index.json` 或 post 正文），按下方「制作要求」出一张横图。
4. 保存到 `cover/images/<id>.jpg`（或 `.png` / `.webp`），路径写入 `image`（相对 `cover/`，如 `images/20261006-dpqr-distributions.jpg`）。
5. 将该条设为 `active: true`，`note` 可写 `automation <日期>`。
6. 全部处理完后：`node scripts/update-cover-md.mjs`。
7. 一次任务可限制篇数（如最多 1～3 篇），避免超时；剩下的下次再跑。
8. **收工必做：按下方「提交、推送与合入 master」落地**。没有改动则不必空提交。
9. 开工前先 `git fetch origin master`，以 **最新 `master` 上的 `cover/`** 为准；若已有未合并的封面 PR，先复用/更新那条，**禁止**对同一批缺图再开重复 PR。

### 3. Automation 禁止事项

- 不重做、不覆盖 `active: true` 的图。
- 不响应用户风格偏好（那是人工对话）。
- 不改 `content/posts/`、不跑写作 / 排期主线。
- **禁止手改 `cover.md`**；只改 `cover.json` / `images/`，再用脚本生成 md。
- **做完活却不 commit / push / 不开合入 `master` 的 PR**（有变更时）。
- 把「只推到 feature 分支、Draft 挂着」当成完工——**图不在 `master` 上等于没做完**。

---

## 提交、推送与合入 master（每次干完必做）

无论是定时补缺，还是人触发的做 / 改 / 重做封面：**有文件变更就必须由 Agent 自己提交并推送**，不要等用户再说「commit and push」。

### 完工标准

- **封面文件出现在 `origin/master` 的 `cover/images/` 下**，且对应条目在 `master` 的 `cover.json` 里为 `active: true`。
- 只停在 Agent 自己的 feature 分支、或只开了未合并 Draft PR → **未完工**。

### 为什么不能直推 `master`

Cursor Cloud / Automation Agent **默认在 feature 分支工作**，工作区里的 GitHub token 通常也**没有**直接 push / merge `master` 的权限。因此落地路径是：

1. Agent：commit → push 到封面专用分支 → 开 **指向 `master`** 的 PR（尽量非 Draft / ready）。
2. 仓库：`.github/workflows/cover-auto-merge.yml` 在 PR **只改封面相关路径**且作者为 `cursor[bot]` 时自动 squash 合入 `master`。
3. 若自动合入未触发或失败：结果里写明 PR 链接，并说明需人工点 Merge；**不要**声称已进仓库主分支。

### 操作步骤

1. 先确认：只改过 `cover.json` / `images/`（或 sync 脚本），且已跑 `update-cover-md.mjs` 生成最新 `cover.md`——**没有直接编辑过 `cover.md`**。
2. 只暂存封面相关路径，例如：
   - `cover/cover.json`
   - `cover/cover.md`（脚本生成结果，允许提交，但仍禁止手改）
   - `cover/images/*`
   - 若改了脚本：`scripts/sync-cover-list.mjs`、`scripts/update-cover-md.mjs`
3. 提交说明写清楚做了什么，例如：
   - `cover: add 20261006-dpqr-distributions`
   - `cover: sync list and fill 2 missing covers`
   - `cover: redo 20260927-wide-to-long`
4. `git push` 到当前远程分支；再开/更新 **base = `master`** 的 PR。PR 里不要夹带 `cover/` 与上述脚本以外的文件，否则自动合入会拒绝。
5. 若工具允许：把 Draft 标成 ready，便于 `cover-auto-merge` 合入。
6. 若工作区干净（同步后无新图、无 diff）→ 跳过 commit，在结果里说明「无需推送」。
7. 不要提交 `.env`、密钥、`node_modules/`、无关改动。

---

## 人工对话（改 / 重做 —— 一般由人触发）

定时任务**不要**走这里。仅当用户明确说时执行：

| 用户说法 | 行为 |
|----------|------|
| 「做封面 \<id 或标题\>」 | 该篇无论是否已有图：按要求做（无则新建；有则等同重做，需覆盖或换文件） |
| 「重做封面 \<…\>」 | 强制新出一版，更新 `image` / `active` |
| 「改封面：…」（如更冷色、少字） | 在现主题上改，勿换题 |
| 「同步封面清单」 | 只跑 sync，不自动出图 |

人工对话同样：**改完 JSON/图片 → 跑脚本生成 `cover.md`（勿手改 md）→ 自己 commit and push**。

---

## 制作要求（微信图文）

以后台实际上传为准；默认做**一张头条横图**即可。

1. **尺寸**
   - 比例约 **2.35:1**，常用 **900×383**（可等比放大，比例不变）。
   - 主标题与主视觉放在画面**中央约正方形安全区**，防止列表裁成方图时左右被切没。
2. **内容**
   - 贴合该篇主题与分类，一眼能猜到讲什么。
   - 字少：短标题或关键词；清楚，勿堆满。
   - 可用简单图形 / 色块 / 表格或终端示意；不要无关风景。
3. **去 AI 味**
   - 忌紫粉霓虹、玻璃拟态、乱粒子、假 3D 按钮条。
   - 一两主色 + 中性底，留白，像人工信息图。
   - 不要假水印、假二维码、假头像墙。
4. **格式**
   - `jpg` / `png` / `webp`；体积适中，便于公众号上传。
   - `image` 用相对本目录路径。

---

## 与主线

- 无封面**不挡**写作、渲染、排期。
- 微信草稿若要用封面，只取本目录 `active: true` 且文件存在的条目。
