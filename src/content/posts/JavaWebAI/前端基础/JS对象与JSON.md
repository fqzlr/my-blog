---
title: JS对象与JSON
published: 2026-05-15
tags:
  - 前端
  - JavaScript
category: 编程学习
description: JavaScript对象的键值对结构及JSON.stringify和JSON.parse的数据转换方法
descriptionSource: ai
order: 1
---
# JS对象与JSON

## 定义
JavaScript对象是键值对的集合，用于组织和管理数据。JSON（JavaScript Object Notation）是一种轻量级的数据交换格式，基于JavaScript对象语法但独立于语言，现多用于网络数据传输。

## 语法/用法

### 自定义对象
```javascript
let user = {
    name: "Tom",
    age: 10,
    gender: "男",
    // 方法定义（简化语法）
    sing() {
        console.log("悠悠的唱着最炫的民族风~");
    }
}

// 访问属性
console.log(user.name);
// 调用方法
user.sing();
```

### JSON格式要求
```javascript
// JSON标准格式：key必须使用双引号
{
    "key": value,
    "key": value,
    "key": value
}
```

### JS对象与JSON转换
```javascript
// JS对象
let person = {
    name: 'itcast',
    age: 18,
    gender: '男'
}

// JS对象 → JSON字符串
JSON.stringify(person);

// JSON字符串 → JS对象
let personJson = '{"name": "heima", "age": 18}';
JSON.parse(personJson).name;
```

## 常见场景
1. **自定义对象**：封装实体数据，如用户信息、商品信息等
2. **JSON.stringify()**：将JS对象转换为JSON字符串，用于发送数据到服务器
3. **JSON.parse()**：将JSON字符串转换为JS对象，用于解析服务器返回的数据
4. **前端与后端通信**：API调用中JSON是主要的数据传输格式

## 注意事项
1. **JSON的key必须使用双引号**，单引号或省略引号不符合JSON规范
2. **JSON不支持函数**，只能表示数据
3. **对象方法简化语法**：`sing() { ... }` 等同于 `sing: function() { ... }`
4. **JSON.stringify循环引用问题**：如果对象包含循环引用，`JSON.stringify()`会抛出错误
5. **深度比较**：两个内容相同的JS对象不相等，只有引用相同的才相等

