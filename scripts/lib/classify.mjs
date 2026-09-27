/** Pick one fixed RPost category slug from free text. */
export function classify(text) {
  if (/ggplot|作图|绘图|图表|可视化/i.test(text)) return "r-plot";
  if (/统计|回归|检验|相关|方差|概率|置信区间/i.test(text)) return "r-stats";
  if (/tidyverse|dplyr|tidyr|purrr|管道|数据整理/i.test(text)) return "r-tidyverse";
  if (/代码管理|项目|renv|git|包管理|目录结构|函数管理/i.test(text)) {
    return "r-code-management";
  }
  return "r-base";
}
