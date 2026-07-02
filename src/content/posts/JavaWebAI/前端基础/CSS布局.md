---
title: CSS布局
published: 2026-05-14
tags:
  - HTML
  - CSS
  - Web基础
  - 前端
category: 编程学习
description: CSS布局速查卡片，涵盖CSS盒模型、Flex布局、页面居中方案的核心用法与实战技巧
order: 5
---

### CSS盒模型

#### 定义

页面中所有元素都可以看作一个盒子，由盒子将元素包含在矩形区域内。CSS 盒模型是页面布局的基石，包含四个部分：

- **内容区域（content）**：实际内容（文字、图片）所在区域
- **内边距区域（padding）**：内容与边框之间的空白
- **边框区域（border）**：围绕内边距的边框线
- **外边距区域（margin）**：盒子与其他元素之间的空白

#### 语法/用法

```css
div {
    width: 200px;              /* 宽度 */
    height: 200px;             /* 高度 */
    box-sizing: border-box;    /* 宽高包含 border+padding */
    background-color: aquamarine;

    padding: 20px;             /* 内边距（四边统一） */
    border: 10px solid red;    /* 边框：粗细 线型 颜色 */
    margin: 30px;              /* 外边距（四边统一） */
}
```

##### padding / margin 简写规则

| 写法 | 含义 |
|------|------|
| `padding: 20px;` | 上、右、下、左均为 20px |
| `padding: 20px 10px;` | 上下 20px，左右 10px |
| `padding: 10px 20px 30px 40px;` | 上 10px，右 20px，下 30px，左 40px（顺时针） |

##### box-sizing

| 值 | 说明 |
|------|------|
| `content-box`（默认） | `width/height` 仅指 content 区域，不包含 padding 和 border |
| `border-box` | `width/height` 包含 content + padding + border，更直观，推荐使用 |

#### 盒子大小计算

盒子实际占据的空间 = content + padding + border + margin（margin 不计入盒子自身大小，但影响周围元素的位置）

#### 常见场景

- 版心居中：`margin: 0 auto;`
- 卡片布局：`border` + `padding` + `background-color`
- 元素间距控制：`margin` 设置同级元素间距，`padding` 设置内容与边界的间距
- 通过浏览器开发者工具可视化调试盒模型

#### 注意事项

- 相邻块级元素的上下 `margin` 会发生**折叠**（取较大值而非相加）
- 推荐全局使用 `box-sizing: border-box;`，避免宽高计算混乱
- `border` 的三个参数顺序：`宽度 线型 颜色`，其中 `solid`（实线）最常用

---

### Flex布局

#### 定义

Flex（Flexible Box，弹性布局）是一种一维布局模型。设置 `display: flex;` 的元素成为 **Flex 容器（container）**，其所有直接子元素自动成为 **Flex 项目（item）**。通过给父容器添加 flex 属性来控制子元素的位置和排列方式。

#### 语法/用法

```css
.container {
    display: flex;
    flex-direction: row;           /* 主轴方向 */
    justify-content: space-between; /* 主轴对齐 */
    align-items: center;            /* 交叉轴对齐 */
}
```

##### 容器属性（常用）

| 属性 | 说明 | 常用值 |
|------|------|--------|
| `display: flex` | 开启弹性布局 | `flex` |
| `flex-direction` | 主轴方向 | `row`（横向，默认）、`column`（纵向） |
| `justify-content` | 主轴对齐方式 | `flex-start` / `flex-end` / `center` / `space-between` / `space-around` |
| `align-items` | 交叉轴对齐方式 | `flex-start` / `flex-end` / `center` / `stretch`（默认） |

##### justify-content 对齐效果

| 值 | 效果 |
|------|------|
| `flex-start` | 从头排列（默认） |
| `flex-end` | 从尾排列 |
| `center` | 居中排列 |
| `space-between` | 两端贴边，中间平分剩余空间 |
| `space-around` | 每个项目两侧留白相等 |

#### 常见场景

- 顶栏布局：标题左对齐，操作按钮右对齐
  ```css
  .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
  }
  ```
- 搜索表单栏：多个输入控件水平排列
- 卡片列表：等宽等间距的卡片网格
- 垂直居中：`flex-direction: column; justify-content: center; align-items: center;`

#### 注意事项

- Flex 是一维布局（行或列），如需二维布局（行和列同时），应使用 CSS Grid
- `flex-direction: column` 时主轴变为纵向，`justify-content` 控制垂直方向对齐
- 子元素的 `margin` 在 Flex 容器中仍有效，`margin: auto` 可实现独特的居中效果
- Flex 布局默认不换行，子元素总宽度超出容器时会被压缩；可通过 `flex-wrap: wrap` 实现换行

---

### 页面居中方案

#### 定义

页面居中布局（版心居中）是指将网页主体内容限制在固定宽度内，并在浏览器窗口中水平居中显示。这是现代网页最常见的布局模式。

#### 语法/用法

##### 核心实现

```css
.container {
    width: 70%;         /* 宽度占父元素70%，也可用固定像素如 960px */
    margin: 0 auto;     /* 上下0，左右自动（核心居中逻辑） */
}
```

##### 说明

`margin: 0 auto;` 的居中原理：将左右外边距均设为 `auto`，浏览器自动平分剩余空间，实现块级元素水平居中。

##### 完整示例

```html
<style>
    body {
        margin: 0;
    }
    #container {
        width: 80%;
        margin: 0 auto;
    }
</style>

<body>
    <div id="container">
        <!-- 所有页面内容包裹在此容器中 -->
    </div>
</body>
```

#### 常见场景

- 新闻资讯类网页的正文区域
- 企业官网的内容区
- 博客文章内容
- 后台管理系统中的表格和表单区域

#### 注意事项

- `margin: 0 auto` 仅对**块级元素**且设置了明确 **`width`** 的元素生效
- 若使用 Flex 布局，也可通过 `justify-content: center` 实现子元素居中，但 `margin: 0 auto` 更轻量
- 响应式设计中，宽度通常使用百分比或 `max-width` 而非固定像素值
- 将 `body` 的 `margin` 设为 `0` 可消除浏览器默认的外边距