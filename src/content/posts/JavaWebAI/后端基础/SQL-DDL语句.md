---
title: SQL-DDL语句
published: 2026-05-18
tags:
  - 前端
  - MySQL
  - 数据库
category: 编程学习
description: DDL数据定义语言：数据库与表结构的创建、查询、修改、删除操作
descriptionSource: ai
order: 3
---

# SQL-DDL语句

## 定义

**DDL（Data Definition Language）**：数据定义语言，用来定义数据库对象（数据库、表）。

## 语法/用法

### SQL 四大分类

| 分类 | 全称 | 说明 |
|---|---|---|
| DDL | Data Definition Language | 数据定义语言，定义数据库/表 |
| DML | Data Manipulation Language | 数据操作语言，增删改数据 |
| DQL | Data Query Language | 数据查询语言，查询数据 |
| DCL | Data Control Language | 数据控制语言，权限管理 |

### 数据库操作

```sql
-- 查询所有数据库
SHOW DATABASES;

-- 查询当前数据库
SELECT DATABASE();

-- 创建数据库（不存在则创建，指定字符集）
CREATE DATABASE [IF NOT EXISTS] 数据库名 [DEFAULT CHARSET utf8mb4];

-- 使用/切换数据库
USE 数据库名;

-- 删除数据库（存在则删除）
DROP DATABASE [IF EXISTS] 数据库名;
```

> `DATABASE` 可替换为 `SCHEMA`，如 `CREATE SCHEMA db01;`、`SHOW SCHEMAS;`

### 表操作 — 创建

```sql
CREATE TABLE 表名(
    字段1  字段1类型 [约束] [COMMENT '注释'],
    字段2  字段2类型 [约束] [COMMENT '注释'],
    ...
    字段n  字段n类型 [约束] [COMMENT '注释']
) [COMMENT '表注释'];
```

示例：

```sql
CREATE TABLE tb_user (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT 'ID,唯一标识',
    username VARCHAR(20) NOT NULL UNIQUE COMMENT '用户名',
    name VARCHAR(10) NOT NULL COMMENT '姓名',
    age INT COMMENT '年龄',
    gender CHAR(1) DEFAULT '男' COMMENT '性别'
) COMMENT '用户表';
```

### 约束

| 约束 | 关键字 | 描述 |
|---|---|---|
| 非空 | NOT NULL | 字段值不能为 NULL |
| 唯一 | UNIQUE | 字段值不能重复 |
| 主键 | PRIMARY KEY | 唯一标识一行记录（非空且唯一） |
| 默认值 | DEFAULT | 未指定值时使用默认值 |
| 外键 | FOREIGN KEY | 关联其他表的主键 |

**主键自增**：`AUTO_INCREMENT`，插入时自动生成递增的 ID 值，从 1 开始。

### MySQL 数据类型

**数值类型**：

| 类型 | 大小 | 用途 |
|---|---|---|
| TINYINT | 1 byte | 小整数值 |
| INT / INTEGER | 4 bytes | 大整数值 |
| BIGINT | 8 bytes | 极大整数值 |
| FLOAT | 4 bytes | 单精度浮点 |
| DOUBLE | 8 bytes | 双精度浮点 |

示例：`age TINYINT UNSIGNED`、`score DOUBLE(4,1)`

**字符串类型**：

| 类型 | 说明 |
|---|---|
| CHAR(N) | 定长字符串，性能高 |
| VARCHAR(N) | 变长字符串，按实际长度存储 |

示例：`username VARCHAR(50)`、`phone CHAR(11)`

**日期时间类型**：

| 类型 | 格式 | 说明 |
|---|---|---|
| DATE | YYYY-MM-DD | 日期 |
| TIME | HH:MM:SS | 时间 |
| DATETIME | YYYY-MM-DD HH:MM:SS | 日期时间 |
| TIMESTAMP | 时间戳 | 自动记录时间 |

示例：`birthday DATE`、`create_time DATETIME`

### 表操作 — 查询/修改/删除

```sql
-- 查询当前数据库所有表
SHOW TABLES;

-- 查看表结构
DESC 表名;

-- 查看建表语句
SHOW CREATE TABLE 表名;

-- 添加字段
ALTER TABLE 表名 ADD 字段名 类型(长度) [COMMENT '注释'] [约束];

-- 修改字段类型
ALTER TABLE 表名 MODIFY 字段名 新数据类型(长度);

-- 修改字段名+类型
ALTER TABLE 表名 CHANGE 旧字段名 新字段名 类型(长度) [COMMENT '注释'] [约束];

-- 删除字段
ALTER TABLE 表名 DROP 字段名;

-- 修改表名
RENAME TABLE 表名 TO 新表名;

-- 删除表（含数据）
DROP TABLE [IF EXISTS] 表名;
```

## 设计表流程

1. 阅读页面原型及需求文档，确定字段
2. 确认各字段的类型、长度限制、约束
3. 增加业务基础字段：`id`（主键自增）、`create_time`、`update_time`

### 员工表设计案例

```sql
CREATE TABLE emp(
    id INT UNSIGNED PRIMARY KEY AUTO_INCREMENT COMMENT 'ID,主键',
    username VARCHAR(20) NOT NULL UNIQUE COMMENT '用户名',
    password VARCHAR(32) NOT NULL COMMENT '密码',
    name VARCHAR(10) NOT NULL COMMENT '姓名',
    gender TINYINT UNSIGNED NOT NULL COMMENT '性别, 1:男, 2:女',
    phone CHAR(11) NOT NULL UNIQUE COMMENT '手机号',
    job TINYINT UNSIGNED COMMENT '职位, 1:班主任,2:讲师,3:学工主管,4:教研主管,5:咨询师',
    salary INT UNSIGNED COMMENT '薪资',
    image VARCHAR(255) COMMENT '头像',
    entry_date DATE COMMENT '入职日期',
    create_time DATETIME COMMENT '创建时间',
    update_time DATETIME COMMENT '修改时间'
) COMMENT '员工表';
```

## 注意事项

- MySQL 8 默认字符集为 `utf8mb4`，创建数据库时可不额外指定。
- `id` 字段应使用 `PRIMARY KEY AUTO_INCREMENT` 保证唯一性，避免手动维护。
- 同一数据库服务器中不允许创建同名数据库。
- `DROP TABLE` 会同时删除表中所有数据，不可恢复。
- 实际开发中，查看/修改/删除表结构通常直接在图形化界面操作。
