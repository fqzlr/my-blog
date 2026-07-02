---
title: Axios库使用
published: 2026-05-15
tags:
  - 前端
  - Ajax
category: 编程学习
description: 基于Promise的Axios HTTP客户端发送GET/POST请求及与async/await配合使用
descriptionSource: ai
order: 12
---
# Axios库使用

## 定义
Axios是一个基于Promise的HTTP客户端，用于浏览器和Node.js环境。它对原生的Ajax进行了封装，简化了HTTP请求的编写和响应处理。

## 语法/用法

### 官方文档
Axios官网：https://www.axios-http.cn

### 引入Axios
```html
<script src="https://unpkg.com/axios/dist/axios.min.js"></script>
```

### 通用方式发送请求
```javascript
// GET请求
axios({
    url: 'https://api.example.com/data',
    method: 'get'
}).then(function(res) {
    console.log(res.data);
}).catch(function(err) {
    console.log(err);
})

// POST请求
axios({
    url: 'https://api.example.com/update',
    method: 'post'
}).then(function(res) {
    console.log(res.data);
}).catch(function(err) {
    console.log(err);
})
```

### 请求方法别名
```javascript
// GET请求
axios.get("https://api.example.com/data")
    .then(result => {
        console.log(result.data);
    })

// POST请求
axios.post("https://api.example.com/update", "id=1")
    .then(result => {
        console.log(result.data);
    })

// 带参数GET请求
axios.get(`https://api.example.com/list?name=${name}&gender=${gender}&job=${job}`)
    .then(res => {
        this.empList = res.data.data;
    })
```

### 与async/await结合使用
```javascript
async search() {
    const result = await axios.get(
        `https://api.example.com/list?name=${this.searchForm.name}`
    );
    this.empList = result.data.data;
}
```

## 常见场景
1. **GET请求**：获取数据、查询操作
2. **POST请求**：提交表单、创建数据
3. **PUT请求**：更新数据
4. **DELETE请求**：删除数据
5. **并发请求**：同时发送多个请求并处理

## 注意事项
1. **引入方式**：
   - 可以通过CDN引入（在线）
   - 可以通过npm安装（本地）
   - 建议使用离线版本以提高稳定性

2. **响应处理**：
   - 响应数据在`res.data`中
   - 使用`.then()`处理成功响应
   - 使用`.catch()`处理错误响应

3. **请求方法区别**：
   - GET请求参数在URL中
   - POST请求参数在请求体中

4. **async/await优化**：
   - 使用async/await可以让异步代码像同步代码一样编写
   - 提高代码可读性和可维护性
   - 建议在前端项目中优先使用此方式

5. **常见错误处理**：
   - 网络错误
   - 服务器返回错误状态码
   - 超时问题
   - 跨域问题

