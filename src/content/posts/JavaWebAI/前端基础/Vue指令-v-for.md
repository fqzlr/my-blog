---
title: Vue指令-v-for
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: 使用v-for指令进行列表渲染，结合key属性实现高效DOM复用
descriptionSource: ai
order: 7
---
# Vue指令-v-for

## 定义
`v-for`指令用于列表渲染，遍历容器的元素或对象的属性。它可以根据数据源动态生成多个相同的HTML元素。

## 语法/用法

### 基本语法
```html
<tr v-for="(item, index) in items" :key="item.id">
    {{item.name}}
</tr>
```

### 简化语法（省略index）
```html
<tr v-for="item in items" :key="item.id">
    {{item.name}}
</tr>
```

### 遍历对象属性
```html
<li v-for="(value, key) in object">
    {{key}}: {{value}}
</li>
```

## 常见场景
1. **列表渲染**：员工列表、商品列表、消息列表等
2. **表格数据展示**：动态生成表格行
3. **导航菜单**：根据权限动态生成菜单项
4. **下拉选项**：动态生成select的option选项
5. **组件列表**：渲染多个相同结构的组件

## 注意事项
1. **key的重要性**：
   - 必须为每个遍历项添加唯一的`key`属性
   - 推荐使用数据的唯一标识（如id）
   - 不推荐使用index作为key（会变化，不对应）
   - key帮助Vue正确排序复用，提升渲染性能

2. **数据源要求**：
   - 遍历的数组必须在`data()`中定义
   - 数据变化时视图会自动更新

3. **作用域**：
   - 在`v-for`内部可以访问父作用域的属性
   - 每个遍历项都有自己的作用域

4. **性能优化**：
   - 避免在`v-for`内部使用复杂计算
   - 大数据量时考虑虚拟滚动
   - 使用`v-if`和`v-for`时，`v-if`的优先级更高

## 相关链接
- [Vue框架概述](Vue框架概述.md)
- [Vue指令-v-if与v-show](Vue指令-v-if与v-show.md)
- [Vue指令-v-bind](Vue指令-v-bind.md)