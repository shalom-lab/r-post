# 封面作图要点

出图前读本文件。流程见 `cover/AGENTS.md`。

一 `id` 出**一张大图**。不管小图。最终入库必须是 **900×383**（比例 900/383）。

**出图强制**：`GenerateImage`，`aspect_ratio: "16:9"`，并带上参考蒙版（见下）。  
出完后必须跑 `crop-cover-235.mjs`（sharp）居中裁切并覆盖。

---

## 一、通用要求（尺寸 / 安全区 / 底线）

### 成品

- **唯一合格尺寸**：**900×383**。
- 流程：**16:9 + 参考蒙版出图** → `node scripts/crop-cover-235.mjs …` 覆盖。

### 参考蒙版（必用，只此一张，两色）

路径：`cover/templates/ref-16x9-black235-white-margins.jpg`  
丢失或比例改了：跑 `npm run make-cover-ref`（或 `node scripts/make-cover-ref-templates.mjs`）重生成。

| 颜色 | 高度带 | 含义 |
|------|--------|------|
| **白** | 上下各约 **12.17%** | 裁掉区：必须空，什么都不画 |
| **黑** | 中间约 **75.65%**（未来 2.35:1 裁切窗） | 唯一作画区 |

- 画布 **16:9**。出图时 `reference_image_paths` 必须指向这张。
- **黑带内不要撑满**：钩子与主视觉四周留一点 margin（约黑带高度的 8%～12%），勿贴黑带四边。呼吸感靠黑带内 margin，**不要**再加灰带第三色。
- 脚本裁掉白带（上下各 **12.17%**）→ 成品 900×383。

1920×1080 时约：上/下白各 **131～132px**，黑带高 **817px**。

```
16:9 参考图（白 + 黑）
┌────────────────────────────┐
│ 白：空，必裁                │
├────────────────────────────┤
│ 黑：作画（四周留 margin）   │
├────────────────────────────┤
│ 白：空，必裁                │
└────────────────────────────┘
              ↓ sharp 裁掉白带
┌────────────────────────────┐
│ 900×383                     │
└────────────────────────────┘
```

成品是 **900×383 横图**，不是正方形。

### 格式与忌项

- 成品 `jpg`；路径 `images/<id>.jpg`。
- 忌：假水印 / 假二维码 / 假头像墙；紫粉霓虹乱闪、玻璃拟态、乱粒子、假 3D 按钮条。
- 忌：画进白带；忌黑带内贴边撑满。

---

## 二、本项目自定义（RPost · 缩略图钩子风）

> 非通用。**B 站 / 油管 / 小红书缩略图**：大字钩子对准痛点、高对比、有冲突或前后对比。

### 要

1. **大字钩子**：对准**这篇正文**核心麻烦。
2. **高对比、色彩醒目**。
3. **冲突或前后对比**（贴本篇场景）。
4. 插画 / 半写实 / 夸张比喻均可。

### 不要

- 单调静物当主视觉；代码墙 / 公式墙。
- **只看标题就出 prompt**。
- 小图拼版 / 虚线 / 外框（参考蒙版色带不是画面内容）。
- 主题画进白带，或在黑带内贴边撑满。

---

## 三、作图 prompt 怎么写（必读正文 + 参考图）

### 1. 先读推文

`content/posts/<id>/*.qmd`（或 `.md`）。勿只看 `title`。

### 2. 出图参数

- `GenerateImage`
- **`aspect_ratio` 必须 `"16:9"`**
- **`reference_image_paths` 必须含** `cover/templates/ref-16x9-black235-white-margins.jpg`

### 3. prompt 布局句（必须写在最前）

> LAYOUT MASK (strict): The reference has TWO colors. WHITE top/bottom bands stay completely empty — they will be cropped. Paint ONLY inside the central BLACK band. Inside the black band, leave a small margin on all four sides — do NOT fill edge-to-edge; keep hook text and main subjects slightly inset from the black band edges.

中文备忘：

> 参考图两色：白=空（必裁）；黑=作画区。只画黑带，黑带内四周留一点 margin，别撑满。

### 4. 内容必含

1. 上面布局句。
2. 油管/B 站风，高对比。
3. 钩子原文、冲突具体画面、主色、道具（贴正文）。
4. 否定：无水印、无代码墙、无小图拼版；勿画白带；勿黑带贴边。

### 5. 好例子

「LAYOUT MASK：白空、只画黑带；黑带内四周留 margin。油管缩略图。钩子『换电脑就挂？』。碎笔记本+dplyr 碎片 vs 挂锁锁 renv.lock。暖橙+青绿。无代码墙、无水印。」

### 6. 写入 `cover.json` 的 `prompt`

存实际出图用的那条（须含：白空 / 只画黑带 / 黑带内留 margin）。
