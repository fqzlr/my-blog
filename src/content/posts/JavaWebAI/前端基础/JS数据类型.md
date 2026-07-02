---
title: JS数据类型
published: 2026-05-15
tags:
  - 前端
  - JavaScript
category: 编程学习
description: JavaScript的原始数据类型与引用数据类型，以及typeof检测和模板字符串的使用
descriptionSource: ai
order: 3
---
# JS数据类型

## 定义
JavaScript数据类型分为**原始数据类型**和**引用数据类型**。原始数据类型包括number、string、boolean、null、undefined等。使用`typeof`关键字可以返回变量的数据类型。

## 语法/用法

### 基本类型检测
```javascript
// 原始数据类型
typeof 3;           // "number"
typeof 3.14;        // "number"
typeof "A";         // "string"
typeof 'Hello';     // "string"
typeof true;        // "boolean"
typeof false;       // "boolean"
typeof null;        // "object" (注意：这是JavaScript的历史遗留bug)
typeof undefined;   // "undefined"
```

### 模板字符串
```javascript
let name = 'Tom';
let age = 18;

// 传统字符串拼接
console.log('大家好, 我是新入职的' + name + ', 今年' + age + '岁了');

// 模板字符串（反引号）
console.log(`大家好, 我是新入职的${name}, 今年${age}岁了`);
```

## 常见场景
1. **number**：数值计算、计数器、数组索引
2. **string**：文本处理、用户输入、HTML内容
3. **boolean**：条件判断、状态切换、开关控制
4. **null**：明确表示空值
5. **undefined**：变量已声明但未赋值
6. **模板字符串**：拼接字符串和变量时使用，比传统拼接更简洁

## 注意事项
1. **弱类型特性**：JavaScript是弱类型语言，变量可以存放不同类型的值
2. **typeof null**：返回"object"是JavaScript的历史遗留bug，null实际是一个特殊的基本类型值
3. **模板字符串**：
   - 必须使用反引号(`)
   - 变量使用`${}`语法引用
   - 支持换行和多行字符串
4. **字符串表示**：可以使用双引号(")、单引号(')或反引号(`)
5. **数值范围**：JavaScript的number类型是双精度64位浮点数，整数范围在-(2^53-1)到2^53-1之间

