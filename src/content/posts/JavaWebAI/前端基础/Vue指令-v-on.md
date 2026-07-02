---
title: Vue指令-v-on
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: 使用v-on（简写@）为HTML标签绑定事件处理方法
descriptionSource: ai
order: 11
---
# Vue指令-v-on

## 定义
`v-on`指令用于为HTML标签绑定事件，实现用户与页面的交互功能。它可以监听DOM事件，并在事件触发时执行Vue实例中定义的方法。

## 语法/用法

### 完整语法
```html
<input type="button" value="点我" v-on:click="handle">
```

### 简化语法（推荐）
```html
<input type="button" value="点我" @click="handle">
```

### 方法定义
```javascript
createApp({
    data() {
        return {
            searchEmp: {
                name: '',
                gender: '',
                job: ''
            }
        }
    },
    methods: {
        search() {
            console.log(this.searchEmp)
        },
        clear() {
            this.searchEmp = {
                name: '',
                gender: '',
                job: ''
            }
        }
    }
}).mount('#container')
```

## 常见场景
1. **点击事件**：按钮点击、提交操作
2. **表单处理**：表单提交、输入验证
3. **元素交互**：鼠标悬停、移出效果
4. **键盘事件**：快捷键、输入监听
5. **数据操作**：增删改查功能触发

## 注意事项
1. **事件处理方法**：
   - 必须在Vue实例的`methods`中定义
   - 方法名使用驼峰命名（camelCase）
   - 方法中通过`this`访问Vue实例数据

2. **this指向**：
   - `methods`函数中的`this`指向Vue实例
   - 可以通过`this`获取到`data()`中定义的数据

3. **事件修饰符**：
   - `.prevent`：阻止默认行为
   - `.stop`：阻止事件冒泡
   - `.once`：事件只触发一次

4. **与原生JS事件区别**：
   - 不需要手动获取DOM元素
   - 方法直接绑定，更简洁
   - 数据更新自动反映到视图

5. **常见事件类型**：
   - click：鼠标点击
   - submit：表单提交
   - keyup/keydown：键盘事件
   - input：输入变化

