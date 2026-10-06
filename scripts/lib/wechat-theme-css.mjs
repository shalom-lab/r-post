import fs from "node:fs";
import path from "node:path";

export const DEFAULT_THEME = "前端之巅";

/**
 * 从 mdcss/<主题名>.css 读取自定义样式，交给 getWeChatHtml(markdown, customCss)。
 * markmuse-wechat 会与默认样式合并。
 */
export function loadThemeCss(mdcssDir, themeName = DEFAULT_THEME) {
  const name = String(themeName || DEFAULT_THEME).trim() || DEFAULT_THEME;
  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    throw new Error(`主题名不合法：${name}`);
  }
  const file = path.join(mdcssDir, `${name}.css`);
  if (!fs.existsSync(file)) {
    throw new Error(`找不到主题样式 mdcss/${name}.css`);
  }
  return fs.readFileSync(file, "utf8");
}
