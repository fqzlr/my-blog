---
title: SQL-DQL语句
published: 2026-05-18
tags:
  - 前端
  - MySQL
  - 数据库
category: 编程学习
description: DQL数据查询语言：基本查询、条件查询、聚合函数、分组、排序、分页的完整用法
descriptionSource: ai
order: 5
---

# SQL-DQL语句

## 定义

**DQL（Data Query Language）**：数据查询语言，用来查询数据库表中的记录。查询关键字为 `SELECT`。在业务系统中，查询是最常用、最重要的操作。

## 语法/用法

### 完整语法结构

```sql
SELECT     字段列表
FROM       表名列表
WHERE      条件列表
GROUP BY   分组字段列表
HAVING     分组后条件列表
ORDER BY   排序字段列表
LIMIT      分页参数
```

### 基本查询

```sql
-- 查询指定字段
SELECT 字段1, 字段2 FROM 表名;

-- 查询所有字段
SELECT * FROM 表名;

-- 设置别名
SELECT 字段1 [AS] 别名1, 字段2 [AS] 别名2 FROM 表名;

-- 去除重复记录
SELECT DISTINCT 字段列表 FROM 表名;
```

示例：

```sql
SELECT name, entry_date FROM emp;
SELECT name AS 姓名, entry_date AS 入职日期 FROM emp;
SELECT DISTINCT job FROM emp;
```

> `*` 号查询所有字段，开发中尽量少用（不直观、影响效率）。

### 条件查询（WHERE）

```sql
SELECT 字段列表 FROM 表名 WHERE 条件列表;
```

#### 比较运算符

| 运算符 | 说明 |
|---|---|
| `>` `>=` `<` `<=` `=` | 大小比较 |
| `<>` 或 `!=` | 不等于 |
| `BETWEEN ... AND ...` | 在范围内（含边界） |
| `IN(...)` | 多值匹配 |
| `LIKE` | 模糊匹配（`%` 任意字符，`_` 单个字符） |
| `IS NULL` / `IS NOT NULL` | 空值判断 |

#### 逻辑运算符

| 运算符 | 说明 |
|---|---|
| `AND` 或 `&&` | 逻辑与 |
| `OR` 或 `||` | 逻辑或 |
| `NOT` 或 `!` | 逻辑非 |

示例：

```sql
-- 姓名等于
SELECT * FROM emp WHERE name = '杨逍';

-- 薪资范围
SELECT * FROM emp WHERE salary <= 5000;

-- NULL 判断
SELECT * FROM emp WHERE job IS NULL;
SELECT * FROM emp WHERE job IS NOT NULL;

-- 不等
SELECT * FROM emp WHERE password <> '123456';

-- 日期范围
SELECT * FROM emp WHERE entry_date BETWEEN '2000-01-01' AND '2010-01-01';

-- IN 多值
SELECT * FROM emp WHERE job IN (2, 3, 4);

-- 模糊匹配
SELECT * FROM emp WHERE name LIKE '__';       -- 两个字
SELECT * FROM emp WHERE name LIKE '张%';      -- 姓张
SELECT * FROM emp WHERE name LIKE '%二%';     -- 包含"二"
```

### 聚合函数

| 函数 | 功能 |
|---|---|
| `COUNT(字段)` | 统计行数（忽略 NULL） |
| `SUM(字段)` | 求和 |
| `MAX(字段)` | 最大值 |
| `MIN(字段)` | 最小值 |
| `AVG(字段)` | 平均值 |

> 聚合函数会忽略 NULL 值。`COUNT(*)` 是统计总行数的推荐写法（MySQL 底层优化）。

示例：

```sql
SELECT COUNT(*) FROM emp;         -- 员工总数
SELECT AVG(salary) FROM emp;      -- 平均薪资
SELECT MIN(salary) FROM emp;      -- 最低薪资
SELECT MAX(salary) FROM emp;      -- 最高薪资
SELECT SUM(salary) FROM emp;      -- 薪资总额
```

### 分组查询（GROUP BY）

```sql
SELECT 字段列表 FROM 表名 [WHERE 条件] GROUP BY 分组字段 [HAVING 分组后条件];
```

示例：

```sql
-- 按性别统计人数
SELECT gender, COUNT(*) FROM emp GROUP BY gender;

-- 分组前筛选 + 分组后过滤
SELECT job, COUNT(*)
FROM emp
WHERE entry_date <= '2015-01-01'
GROUP BY job
HAVING COUNT(*) >= 2;
```

#### WHERE 与 HAVING 的区别

| 对比维度 | WHERE | HAVING |
|---|---|---|
| 执行时机 | 分组前过滤 | 分组后过滤 |
| 能否使用聚合函数 | 不能 | 可以 |

执行顺序：`WHERE` → `聚合函数` → `HAVING`

### 排序查询（ORDER BY）

```sql
SELECT 字段列表 FROM 表名 ORDER BY 字段1 [ASC|DESC], 字段2 [ASC|DESC] ...;
```

- `ASC`：升序（默认，可省略）
- `DESC`：降序

示例：

```sql
-- 按入职时间升序
SELECT * FROM emp ORDER BY entry_date;

-- 按入职时间降序
SELECT * FROM emp ORDER BY entry_date DESC;

-- 多字段排序：入职时间升序，相同时按更新时间降序
SELECT * FROM emp ORDER BY entry_date ASC, update_time DESC;
```

### 分页查询（LIMIT）

```sql
SELECT 字段列表 FROM 表名 LIMIT 起始索引, 查询记录数;
```

- 起始索引从 0 开始。
- 计算公式：`起始索引 = (页码 - 1) × 每页记录数`

示例：

```sql
-- 第1页，每页5条
SELECT * FROM emp LIMIT 0, 5;
-- 等价简写
SELECT * FROM emp LIMIT 5;

-- 第2页，每页5条
SELECT * FROM emp LIMIT 5, 5;

-- 第3页，每页5条
SELECT * FROM emp LIMIT 10, 5;
```

## 常见场景

DQL 是业务系统中最核心的操作，网站/APP 的数据展示、搜索、报表导出等功能均依赖 DQL 实现。

## 注意事项

- `NULL` 判断只能用 `IS NULL` / `IS NOT NULL`，不能用 `= NULL`。
- 分组后 `SELECT` 的字段通常仅限聚合函数和分组字段，查询其他字段无意义。
- `LIMIT` 是 MySQL 方言，不同数据库的分页语法不同。
- 分页查询第一页时，`LIMIT 5` 等价于 `LIMIT 0, 5`。

## 测试数据

```sql
-- 创建 emp 表并插入测试数据，详见源文档 3.3.2 节。
-- 包含 30 条梁山好汉员工数据，覆盖性别、职位、薪资等多种筛选场景。
```
