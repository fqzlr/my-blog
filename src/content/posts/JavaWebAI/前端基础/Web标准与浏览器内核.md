---
title: Web标准与浏览器内核
published: 2026-05-14
tags:
  - HTML
  - CSS
  - Web基础
  - 前端
category: 编程学习
description: Web标准与浏览器内核速查卡片，涵盖Web标准定义、浏览器内核对比及常见浏览器差异
order: 1
---

## 定义

**Web标准** 是由 W3C（World Wide Web Consortium，万维网联盟）制定的一系列网页技术规范，确保不同浏览器对同一段前端代码的解析结果一致。其核心由三部分组成：

- **HTML**（HyperText Markup Language）：负责网页的 **结构**（页面元素与内容）
- **CSS**（Cascading Style Sheet）：负责网页的 **表现**（外观、位置、样式）
- **JavaScript**：负责网页的 **行为**（交互效果）

**浏览器内核** 是浏览器中负责解析和渲染前端代码的组件。不同浏览器的内核不同，对同一段代码的解析效果也存在差异——这正是 Web 标准存在的意义。

## 常见浏览器内核

| 浏览器 | 内核 |
|--------|------|
| Chrome | Blink（早期为 WebKit） |
| Firefox | Gecko |
| Safari | WebKit |
| IE | Trident |

## 常见场景

- 判断某个 CSS 属性是否需要添加浏览器私有前缀
- 理解为何同一页面在不同浏览器中显示效果不一致
- 前端性能优化时考虑不同内核的渲染差异

## 注意事项

- HTML 标签是预定义好的，不可自定义（如不存在 `<h7>`）
- HTML 语法相对松散，但编写时建议保持严谨