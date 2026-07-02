---
title: JS函数
published: 2026-05-15
tags:
  - 前端
  - JavaScript
category: 编程学习
description: JavaScript函数的三种定义方式：命名函数、函数表达式和箭头函数
descriptionSource: ai
order: 4
---
# JS函数

## 定义
函数是被设计用来执行特定任务的代码块，方便程序的封装复用。JavaScript中的函数可以通过命名函数、函数表达式和箭头函数三种方式定义。

## 语法/用法

### 方式一：命名函数
```javascript
function add(a, b) {
    return a + b;
}

let result = add(10, 20);
```

### 方式二：匿名函数
```javascript
// 函数表达式
var add = function (a, b) {
    return a + b;
}

// 箭头函数（推荐）
var add = (a, b) => {
    return a + b;
}
```

### 匿名函数的调用方式
```javascript
// 通过变量调用
let result = add(10, 20);

// 直接作为回调函数
document.querySelector('#btn').addEventListener('click', () => {
    alert("按钮被点击了");
});
```

## 常见场景
1. **命名函数**：工具函数、公共方法、需要复用的代码块
2. **函数表达式**：需要将函数作为变量传递的场景
3. **箭头函数**：回调函数、简短的函数定义、需要保留外部this的场景
4. **直接匿名调用**：事件处理、数组方法（map、filter、forEach等）

## 注意事项
1. **参数灵活性**：由于JavaScript是弱类型语言，形参不需要声明类型，返回值也不需要声明类型
2. **参数个数**：实参个数与形参个数可以不一致，但建议保持一致
3. **箭头函数特性**：
   - 更简洁的语法
   - 不绑定自己的this
   - 不能用作构造函数
   - 在现代前端开发中使用频率更高
4. **函数提升**：命名函数会被提升到作用域顶部，可以在声明前调用；函数表达式和箭头函数则不会

## 相关链接
- [JavaScript变量与常量](JavaScript变量与常量.md)
- [JavaScript数据类型](JavaScript数据类型.md)
- [JavaScript事件监听](JavaScript事件监听.md)