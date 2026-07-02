---
title: JS事件监听
published: 2026-05-15
tags:
  - 前端
  - JavaScript
category: 编程学习
description: 使用addEventListener为DOM元素绑定事件实现用户交互
descriptionSource: ai
order: 5
---
# JS事件监听

## 定义
事件监听是将函数绑定到HTML元素上的特定事件，当事件触发时自动执行对应的函数。事件是发生在HTML元素上的"事情"，如按钮点击、鼠标移动、键盘按下等。

## 语法/用法

### addEventListener（推荐）
```javascript
// 语法：事件源.addEventListener('事件类型', 要执行的函数)
document.querySelector("#btn1").addEventListener('click', () => {
    alert("按钮被点击了...");
});
```

### DOM元素事件属性（早期方式）
```javascript
document.querySelector('#btn1').onclick = function() {
    alert("按钮被点击了...");
};
```

### HTML标签事件属性
```html
<input type="button" onclick="on()">
```

## 常见场景
1. **click**：按钮点击、链接点击
2. **mouseenter / mouseleave**：鼠标悬停效果，如隔行变色
3. **keydown / keyup**：键盘快捷键、输入验证
4. **blur / focus**：表单输入验证
5. **input**：实时搜索、字符计数
6. **submit**：表单提交前的数据验证

## 注意事项
1. **addEventListener vs on事件**：
   - `on`方式会被覆盖（重复绑定只保留最后一个）
   - `addEventListener`可以绑定多次，拥有更多特性
   - 推荐使用`addEventListener`
2. **常见错误**：
   - 获取DOM元素时在元素渲染之前执行（应将脚本放在body底部或使用DOMContentLoaded）
   - 事件类型名称大小写敏感（如"click"不能写成"Click"）
3. **事件冒泡**：默认事件会冒泡到父元素，可以通过`event.stopPropagation()`阻止
4. **事件委托**：通过父元素监听子元素事件，提高性能

