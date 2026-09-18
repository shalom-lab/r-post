/**
 * 后期接入：把渲染后的 Markdown 转成微信公众号格式并发布。
 * 你有自己的转换方法时，在此实现即可；操作台可再挂按钮调用。
 */
export async function publishToWeChat(_markdown: string): Promise<void> {
  // TODO: 接入你的 MD → 微信图文 转换与发布 API
  throw new Error("公众号发布尚未接入：请实现 publishToWeChat()");
}
