---
title: Ajax与异步编程
published: 2026-05-15
tags:
  - 前端
  - Ajax
category: 编程学习
description: 使用Ajax实现页面无刷新数据交互，async/await简化异步编程
descriptionSource: ai
order: 13
---
# Ajax与异步编程

## 定义
Ajax（Asynchronous JavaScript And XML）是一种在不重新加载整个页面的情况下，与服务器交换数据并更新部分网页的技术。它实现了前端与服务器的异步数据交互。

## 语法/用法

### 同步vs异步对比
```
同步请求流程：
浏览器 → 发送请求 → [等待服务器处理] → 接收响应 → 继续操作
        (期间页面被阻塞，无法操作)

异步请求流程：
浏览器 → 发送请求 → 继续其他操作
        (请求在后台处理)
服务器 → 处理完成 → 返回数据 → 更新页面局部内容
        (页面不刷新，用户体验好)
```

### async/await语法
```javascript
// 用async声明异步方法
async search() {
    const result = await axios.get(
        `https://api.example.com/emps/list?name=${this.searchForm.name}`
    );
    this.empList = result.data.data;
}
```

### Promise方式
```javascript
axios.get(url)
    .then(res => {
        console.log(res.data);
    })
    .catch(err => {
        console.log(err);
    });
```

## 常见场景
1. **数据获取**：从服务器加载数据并动态展示
2. **表单提交**：异步提交表单数据，避免页面刷新
3. **搜索联想**：用户输入时实时获取联想建议
4. **数据验证**：用户名可用性检查、邮箱验证等
5. **局部刷新**：只更新页面中变化的部分

## 注意事项
1. **同步vs异步**：
   - 同步请求会阻塞页面，等待服务器响应期间无法操作
   - 异步请求不阻塞页面，用户体验更好

2. **async/await**：
   - `async`用于声明异步方法
   - `await`用于等待异步任务执行
   - 配合使用可以让异步代码看起来像同步代码
   - 提高代码可读性和可维护性

3. **错误处理**：
   - 使用try-catch包裹await调用
   - Promise方式使用.catch处理错误

4. **跨域问题**：
   - Ajax请求受同源策略限制
   - 需要服务器配置CORS或使用代理

5. **异步不是多线程**：
   - JavaScript是单线程语言
   - 异步通过事件循环机制实现
   - 不阻塞主线程但也不能利用多核并行计算

