---
title: Vue指令-v-if与v-show
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: v-if通过移除DOM节点控制显示，v-show通过CSS display属性切换可见性
descriptionSource: ai
order: 9
---
# Vue指令-v-if与v-show

## 定义
`v-if`和`v-show`都是用于控制元素显示与隐藏的指令，但实现机制不同。`v-if`通过条件判断创建或移除元素节点，`v-show`通过CSS的display属性控制显示隐藏。

## 语法/用法

### v-if指令
```html
<!-- 基本用法 -->
<span v-if="isVisible">显示内容</span>

<!-- v-else-if链式调用 -->
<span v-if="emp.job === '1'">班主任</span>
<span v-else-if="emp.job === '2'">讲师</span>
<span v-else-if="emp.job === '3'">学工主管</span>
<span v-else-if="emp.job === '4'">教研主管</span>
<span v-else-if="emp.job === '5'">咨询师</span>
<span v-else>其他</span>

<!-- v-else -->
<div v-if="isAdmin">管理员面板</div>
<div v-else>普通用户面板</div>
```

### v-show指令
```html
<!-- 基本用法 -->
<span v-show="isVisible">显示内容</span>

<!-- 多个条件 -->
<span v-show="emp.job === '1'">班主任</span>
<span v-show="emp.job === '2'">讲师</span>
<span v-show="emp.job === '3'">学工主管</span>
<span v-show="emp.job === '4'">教研主管</span>
<span v-show="emp.job === '5'">咨询师</span>
```

## 常见场景
1. **v-if适用场景**：
   - 条件不经常变化
   - 初始渲染条件为false时不需要渲染
   - 需要配合v-else或v-else-if使用
   - 性能要求不高，但需要完全销毁/重建元素

2. **v-show适用场景**：
   - 条件频繁切换
   - 初始渲染成本较高
   - 只需要简单的显示/隐藏切换
   - 需要保持元素状态（如表单输入）

## 注意事项
1. **实现机制差异**：
   - `v-if`：条件为false时，元素从DOM中移除
   - `v-show`：条件为false时，元素通过`display: none`隐藏

2. **性能考虑**：
   - `v-if`有更高的切换开销（创建/销毁）
   - `v-show`有更高的初始渲染开销（总是渲染）
   - 频繁切换用`v-show`，运行时条件很少改变用`v-if`

3. **v-else规则**：
   - `v-else`必须紧跟在`v-if`或`v-else-if`之后
   - `v-else-if`必须出现在`v-if`之后
   - 可以有多个`v-else-if`

4. **与v-for一起使用**：
   - 不推荐在同一元素上同时使用`v-if`和`v-for`
   - 需要时，`v-if`的优先级更高

## 相关链接
- [Vue框架概述](Vue框架概述.md)
- [Vue指令-v-for](Vue指令-v-for.md)
- [Vue指令-v-bind](Vue指令-v-bind.md)