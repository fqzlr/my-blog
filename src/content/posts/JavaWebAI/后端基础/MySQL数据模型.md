---
title: MySQL数据模型
published: 2026-05-18
tags:
  - 前端
  - MySQL
  - 数据库
category: 编程学习
description: 关系型数据库的二维表模型与MySQL的数据存储层次结构
descriptionSource: ai
order: 1
---

# MySQL数据模型

## 定义

**关系型数据库（RDBMS）**：建立在关系模型基础上，由多张相互连接的**二维表**组成的数据库。二维表由行（记录）和列（字段）组成。

![二维表示例](https://ph.0824.uk/file/article/05-Web后端基础_数据库_-image-9.png)

## 二维表的优点

- 使用表存储数据，格式统一，便于维护
- 使用 SQL 语言操作，标准统一，使用方便，可用于复杂查询

> 基于二维表存储数据的数据库是关系型数据库；反之则是非关系型数据库（如 Redis）。

## MySQL 数据存储层次

![MySQL数据模型](https://ph.0824.uk/file/article/05-Web后端基础_数据库_-image-15.png)

**存储层次（由大到小）**：

```
数据库服务器
  └── 数据库1
  │     ├── 表A（多行记录）
  │     └── 表B
  └── 数据库2
        └── 表C
```

MySQL 客户端通过 DBMS 发送 SQL，DBMS 根据 SQL 指令操作数据库中的表及数据。

## 常见场景

在 MySQL 中存储数据的步骤：

1. 创建数据库（多个数据库间相互独立）
2. 在数据库下创建数据表（一个数据库可含多张表）
3. 将数据存入数据表（一张表可存多行数据）

## 注意事项

- MySQL、Oracle、DB2、SQL Server 都属于关系型数据库（基于二维表）。
- 非关系型数据库（NoSQL）如 Redis，不基于二维表存储。
