---
title: HTML表格与表单
published: 2026-05-14
tags:
  - HTML
  - CSS
  - Web基础
  - 前端
category: 编程学习
description: HTML表格与表单速查卡片，涵盖表格标签与表单标签的用法、属性对比与实战要点
order: 4
---

### 表格标签

#### 定义

HTML 表格用于展示行列结构化的数据，由 `<table>`、`<tr>`、`<th>`、`<td>` 等标签构成。

#### 语法/用法

##### 基础表格结构

```html
<table>
  <thead>
    <tr>
      <th>姓名</th>
      <th>性别</th>
      <th>职位</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>令狐冲</td>
      <td>男</td>
      <td>讲师</td>
    </tr>
    <tr>
      <td>任盈盈</td>
      <td>女</td>
      <td>学工主管</td>
    </tr>
  </tbody>
</table>
```

##### 标签说明

| 标签 | 说明 | 属性 |
|------|------|------|
| `<table>` | 表格容器 | `border`、`width`、`cellspacing`、`cellpadding` |
| `<thead>` | 表头区域（语义化） | - |
| `<tbody>` | 表体区域（语义化） | - |
| `<tr>` | 表格行 | - |
| `<th>` | 表头单元格 | `colspan`（跨列）、`rowspan`（跨行） |
| `<td>` | 数据单元格 | `colspan`、`rowspan` |

##### 跨行跨列

```html
<td colspan="2">跨两列</td>
<td rowspan="3">跨三行</td>
```

#### 常见场景

- 数据报表、统计表格
- 产品规格对比表
- 课程表、日程表
- 后台管理系统中的数据列表

#### 注意事项

- 现代开发中表格的样式（边框、间距、颜色）应通过 CSS 控制，而非 HTML 属性
- 使用 `<thead>`、`<tbody>` 等语义化标签提升可访问性
- 避免使用表格进行页面布局（应使用 CSS Flex/Grid）
- 复杂表格可结合 `colspan`、`rowspan` 实现单元格合并

---

### 表单标签

#### 定义

表单（Form）是网页中负责数据采集的核心组件，用户通过表单项录入数据后提交到服务端。表单数据一般会被服务端接收后存储到数据库中。

#### 语法/用法

##### 表单容器 `<form>`

```html
<form action="/save" method="post">
    <!-- 表单项 -->
</form>
```

##### form 属性

| 属性 | 说明 | 取值 |
|------|------|------|
| `action` | 数据提交的目标 URL | URL 路径，不指定则提交到当前页面 |
| `method` | 数据提交方式 | `GET`（默认）或 `POST` |

##### GET vs POST

| 对比维度 | GET | POST |
|----------|-----|------|
| 数据位置 | 拼接在 URL 后面（`?key=value`） | 放在请求体中 |
| 数据大小 | URL 长度有限制 | 无大小限制 |
| 安全性 | 数据暴露在地址栏 | 相对安全 |
| 适用场景 | 搜索查询、筛选 | 登录、注册、数据提交 |

##### 表单项标签

###### `<input>` — 核心表单项

通过 `type` 属性控制输入形式：

| type 值 | 说明 | 示例 |
|----------|------|------|
| `text` | 文本输入框 | `<input type="text" name="name">` |
| `password` | 密码输入框 | `<input type="password" name="pwd">` |
| `radio` | 单选按钮 | `<input type="radio" name="gender" value="1">` |
| `checkbox` | 复选框 | `<input type="checkbox" name="hobby" value="java">` |
| `file` | 文件上传 | `<input type="file" name="image">` |
| `date` | 日期选择 | `<input type="date" name="birthday">` |
| `time` | 时间选择 | `<input type="time" name="time">` |
| `datetime-local` | 日期时间选择 | `<input type="datetime-local" name="dt">` |
| `hidden` | 隐藏域（不可见但会提交） | `<input type="hidden" name="id" value="1">` |
| `submit` | 提交按钮 | `<input type="submit" value="提交">` |
| `reset` | 重置按钮 | `<input type="reset" value="重置">` |
| `button` | 普通按钮 | `<input type="button" value="按钮">` |

###### `<select>` — 下拉列表

```html
<select name="degree">
    <option value="">请选择</option>
    <option value="1">大专</option>
    <option value="2">本科</option>
</select>
```

###### `<textarea>` — 文本域

```html
<textarea name="description" cols="30" rows="10"></textarea>
```

#### 常见场景

- 用户注册、登录表单
- 信息搜索与筛选
- 管理系统数据录入
- 个人信息编辑

#### 注意事项

- **表单项必须指定 `name` 属性**，否则提交时不会采集该字段的数据
- 同一组 `radio` 的 `name` 必须相同以实现互斥
- `<label>` 包裹 `<input>` 可实现点击标签文字聚焦控件：
  ```html
  <label><input type="checkbox" name="hobby" value="game"> 游戏</label>
  ```
- `value` 属性决定了表单项提交到服务端的实际值