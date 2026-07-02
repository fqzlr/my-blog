---
title: SQL-DML语句
published: 2026-05-18
tags:
  - 前端
  - MySQL
  - 数据库
category: 编程学习
description: DML数据操作语言：INSERT、UPDATE、DELETE 的语法与注意事项
descriptionSource: ai
order: 4
---

# SQL-DML语句

## 定义

**DML（Data Manipulation Language）**：数据操作语言，用来对数据库表中的数据记录进行增、删、改操作。

## 语法/用法

### INSERT — 插入数据

```sql
-- 向指定字段插入
INSERT INTO 表名 (字段1, 字段2, ...) VALUES (值1, 值2, ...);

-- 向全部字段插入（字段顺序必须与表结构一致）
INSERT INTO 表名 VALUES (值1, 值2, ...);

-- 批量插入（指定字段）
INSERT INTO 表名 (字段1, 字段2, ...) VALUES
    (值1, 值2, ...),
    (值1, 值2, ...);

-- 批量插入（全部字段）
INSERT INTO 表名 VALUES
    (值1, 值2, ...),
    (值1, 值2, ...);
```

示例：

```sql
-- 指定字段插入
INSERT INTO emp(username, name, gender, phone, create_time, update_time)
VALUES ('wuji', '张无忌', 1, '13309091231', NOW(), NOW());

-- 全字段插入
INSERT INTO emp(id, username, password, name, gender, phone, job, salary, image, entry_date, create_time, update_time)
VALUES (1, 'shinaian', '123456', '施耐庵', 1, '13309090001', 4, 15000, '1.jpg', '2000-01-01', NOW(), NOW());

-- 批量插入
INSERT INTO emp(username, name, gender, phone, create_time, update_time)
VALUES
    ('Tom1', '汤姆1', 1, '13309091231', NOW(), NOW()),
    ('Tom2', '汤姆2', 1, '13309091232', NOW(), NOW());
```

### UPDATE — 修改数据

```sql
UPDATE 表名 SET 字段1 = 值1, 字段2 = 值2, ... [WHERE 条件];
```

示例：

```sql
-- 修改指定记录
UPDATE emp SET name = '张三', update_time = NOW() WHERE id = 1;

-- 修改整张表（不加 WHERE 条件）
UPDATE emp SET entry_date = '2010-01-01', update_time = NOW();
```

### DELETE — 删除数据

```sql
DELETE FROM 表名 [WHERE 条件];
```

示例：

```sql
-- 删除指定记录
DELETE FROM emp WHERE id = 1;

-- 删除全部数据
DELETE FROM emp;
```

## 注意事项

| 操作 | 注意点 |
|---|---|
| INSERT | 字段顺序与值的顺序必须一一对应；字符串和日期需用引号包裹；插入数据不得超出字段规定范围 |
| UPDATE | 不加 WHERE 条件会修改整张表的所有数据；一般需同步更新 `update_time` 字段 |
| DELETE | 不加 WHERE 条件会删除整张表的数据；不能删除某一个字段的值（应使用 UPDATE 置 NULL）；全量删除时会提示确认 |

## 相关链接
