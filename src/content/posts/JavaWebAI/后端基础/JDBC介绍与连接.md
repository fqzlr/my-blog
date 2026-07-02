---
title: JDBC介绍与连接
published: 2026-05-19
tags:
  - Java
  - JDBC
  - 数据库
category: 编程学习
description: JDBC（Java DataBase Connectivity）是Java操作关系型数据库的底层API规范。
descriptionSource: ai
order: 1
---

# JDBC介绍与连接

## 定义

**JDBC（Java DataBase Connectivity）**，是使用Java语言操作关系型数据库的一套API，也是操作数据库最为基础、底层的技术。

**本质：**

- sun公司官方定义的一套操作所有关系型数据库的规范，即接口。
- 各个数据库厂商去实现这套接口，提供数据库驱动jar包。
- 开发者使用这套接口(JDBC)编程，真正执行的代码是驱动jar包中的实现类。

## 架构

在Java代码中通过JDBC接口操作数据库，底层由各数据库厂商的驱动实现：

```
Java Application
       │
  JDBC API (接口)
       │
  数据库驱动 (MySQL / Oracle / ...)
       │
    数据库
```

## 生态定位

JDBC是操作数据库最为基础、底层的技术。在企业项目开发中，一般都会使用基于JDBC封装的高级框架：

| 框架 | 市场地位 |
|------|----------|
| Mybatis | 最为主流 |
| MybatisPlus | 其次 |
| Hibernate | 较少 |
| SpringDataJPA | 较少 |

## 常见场景

- 直接编写JDBC程序执行SQL语句（学习/小型工具）
- 作为Mybatis/MybatisPlus等框架的底层依赖

## 注意事项

- JDBC程序需要手动管理数据库连接、结果集解析和资源关闭，代码较为繁琐。
- 生产环境中一般不直接使用原生JDBC，而是使用基于JDBC封装的高级框架。
- 数据库驱动jar包需与数据库版本匹配。

## 相关链接

- [JDBC查询操作](/posts/JavaWebAI/JDBC查询操作)
- [JDBC增删改操作](/posts/JavaWebAI/JDBC增删改操作)
- [Mybatis基础](/posts/JavaWebAI/Mybatis基础)