---
title: "用 mtcars 看一眼相关与散点"
author: "RPost"
date: "2026-03-18"
---

一句话：想快速看看两列数值有没有一起动，先画散点，再算相关。

## 数据

用 R 自带的 `mtcars`（真实汽车指标，不是假数据）。

```r
head(mtcars[, c("mpg", "wt")])
```

```
                   mpg    wt
Mazda RX4         21.0 2.620
Mazda RX4 Wag     21.0 2.875
Datsun 710        22.8 2.320
Hornet 4 Drive    21.4 3.215
Hornet Sportabout 18.7 3.440
Valiant           18.1 3.460
```

## 散点

（示例稿：正式流水线由 Quarto 在 Actions 中渲染并内嵌图片。）

```r
plot(mtcars$wt, mtcars$mpg,
     xlab = "重量 wt", ylab = "油耗 mpg",
     main = "越重往往越费油")
```

## 相关

```r
cor(mtcars$wt, mtcars$mpg)
```

```
[1] -0.8676594
```

负数：重量越大，mpg 往往越小。

## 带走

真实数据 + 一张散点 + 一个 `cor()`，就够讲清「相关」的第一印象。
