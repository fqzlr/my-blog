---
title: Vue框架概述
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: Vue渐进式框架的核心概念：数据驱动视图与createApp创建应用
descriptionSource: ai
order: 6
---
# Vue框架概述

## 定义
Vue是一款用于**构建用户界面**的**渐进式**JavaScript**框架**。它基于数据渲染出用户看到的界面，简化了DOM操作，提高了开发效率。

## 语法/用法

### Vue应用创建
```html
<div id="app">
    {{message}}
</div>

<script type="module">
    import { createApp } from 'https://unpkg.com/vue@3/dist/vue.esm-browser.js'
    createApp({
        data() {
            return {
                message: 'Hello Vue'
            }
        }
    }).mount('#app')
</script>
```

### 数据驱动视图
```javascript
// Vue实例中的数据
data() {
    return {
        message: 'Hello Vue'
    }
}

// 模板中的插值表达式
{{message}}
```

## 常见场景
1. **构建用户界面**：基于数据渲染出用户看到的界面
2. **局部模块改造**：使用Vue改造现有项目的部分功能
3. **工程化开发**：基于Vue核心包和插件进行整站开发
4. **数据绑定**：实现数据与视图的自动同步更新

## 注意事项
1. **渐进式框架**：
   - 不需要一次性学习所有特性
   - 可以逐步引入Vue的功能
   - 从简单到复杂逐步使用

2. **Vue应用结构**：
   - 必须通过`createApp()`创建Vue应用实例
   - 数据必须定义在`data()`方法中
   - 必须通过`mount()`方法挂载到DOM元素

3. **插值表达式限制**：
   - 只能写在Vue控制的区域内（如`#app`内部）
   - 只能使用Vue中定义的数据
   - 不能使用JavaScript语句

4. **开发模式**：
   - 局部模块改造：基于Vue核心包完成项目局部模块改造
   - 工程化开发：基于Vue核心包、插件进行整站开发

## 相关链接
- [Vue指令-v-for](Vue指令-v-for.md)
- [Vue指令-v-bind](Vue指令-v-bind.md)
- [Vue指令-v-model](Vue指令-v-model.md)
- [Vue生命周期](Vue生命周期.md)