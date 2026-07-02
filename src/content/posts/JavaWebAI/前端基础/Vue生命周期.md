---
title: Vue生命周期
published: 2026-05-15
tags:
  - 前端
  - Vue
category: 编程学习
description: Vue实例从创建到销毁的8个阶段及mounted等钩子函数的应用
descriptionSource: ai
order: 14
---
# Vue生命周期

## 定义
Vue生命周期是指Vue实例从创建到销毁的完整过程。它包含8个阶段，每个阶段会自动执行对应的生命周期方法（也称为钩子函数）。其中`mounted`是最常用的钩子函数。

## 语法/用法

### 生命周期钩子使用
```javascript
createApp({
    data() {
        return {
            empList: []
        }
    },
    methods: {
        async search() {
            const result = await axios.get('https://api.example.com/emps/list');
            this.empList = result.data.data;
        }
    },
    // 生命周期钩子：挂载完成
    mounted() {
        // 页面初始化自动加载数据
        this.search();
    }
}).mount('#container')
```

## 常见场景
1. **mounted（挂载完成）**：
   - 页面初始化时自动请求后台数据
   - 初始化第三方插件
   - 获取DOM元素
   - 设置定时器

2. **created（创建完成）**：
   - 初始化数据
   - 非DOM相关操作

3. **beforeUnmount（卸载前）**：
   - 清理定时器
   - 移除事件监听
   - 取消未完成的请求

## 注意事项
1. **mounted是重点**：
   - Vue初始化成功，HTML页面渲染成功
   - 用于页面初始化时自动发送Ajax请求
   - 此时可以访问DOM元素

2. **生命周期顺序**：
   - beforeCreate → created → beforeMount → mounted
   - beforeUpdate → updated
   - beforeUnmount → unmounted

3. **钩子函数特性**：
   - 自动执行，不需要手动调用
   - 在Vue实例选项对象中定义
   - 每个实例都会经历完整的生命周期

4. **数据可用性**：
   - created中可以访问data和methods
   - mounted中可以访问DOM
   - beforeCreate中无法访问data

5. **避免内存泄漏**：
   - 在beforeUnmount中清理定时器
   - 取消事件监听
   - 清理全局引用

