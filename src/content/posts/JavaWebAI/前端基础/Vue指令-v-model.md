---
title: Vue指令-v-model
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: 使用v-model在表单元素上实现数据和视图的双向绑定
descriptionSource: ai
order: 10
---
# Vue指令-v-model

## 定义
`v-model`指令用于在表单元素上实现**双向数据绑定**。它可以方便地获取或设置表单项数据，实现Vue数据与表单输入之间的自动同步。

## 语法/用法

### 基本用法
```html
<!-- 文本输入框 -->
<input type="text" v-model="username">

<!-- 下拉选择框 -->
<select v-model="selected">
    <option value="A">选项A</option>
    <option value="B">选项B</option>
</select>

<!-- 多选框 -->
<input type="checkbox" v-model="checked">

<!-- 单选框 -->
<input type="radio" v-model="picked" value="a">
```

### 表单数据绑定
```html
<form class="search-form">
    <input type="text" v-model="searchEmp.name" placeholder="姓名" />
    <select v-model="searchEmp.gender">
        <option value="">性别</option>
        <option value="1">男</option>
        <option value="2">女</option>
    </select>
</form>
```

## 常见场景
1. **表单输入**：文本输入、密码输入、文本域
2. **选择控件**：下拉选择、单选框、多选框
3. **搜索功能**：搜索框与搜索条件的双向绑定
4. **数据收集**：用户注册、信息填写等表单场景
5. **实时过滤**：输入框内容实时过滤列表数据

## 注意事项
1. **数据源要求**：
   - `v-model`绑定的变量必须在`data()`中定义
   - 变量可以是基本类型或对象属性

2. **双向绑定原理**：
   - Vue数据变化 → 视图更新
   - 视图输入变化 → Vue数据更新
   - 本质是`v-bind`和`v-on`的语法糖

3. **修饰符**：
   - `.lazy`：在change事件后同步数据
   - `.number`：将输入转为数字类型
   - `.trim`：自动过滤首尾空白字符

4. **自定义组件**：
   - 在自定义组件上使用`v-model`需要特殊处理
   - 需要组件内部实现`modelValue`和`update:modelValue`

5. **与原生表单区别**：
   - 不需要手动获取表单值
   - 数据变化自动同步到视图
   - 支持多种表单元素类型

## 相关链接
- [Vue框架概述](Vue框架概述.md)
- [Vue指令-v-bind](Vue指令-v-bind.md)
- [Vue指令-v-on](Vue指令-v-on.md)
- [JavaScript事件监听](JavaScript事件监听.md)