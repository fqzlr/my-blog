---
title: JDBC增删改操作
published: 2026-05-19
tags:
  - Java
  - JDBC
  - SQL
  - 数据库
category: 编程学习
description: 基于JDBC执行INSERT/UPDATE/DELETE等DML语句，掌握executeUpdate方法的使用。
descriptionSource: ai
order: 2
---

# JDBC增删改操作

## 定义

JDBC中执行增删改（DML）操作通过 `PreparedStatement.executeUpdate()` 方法完成，返回值为受影响的记录行数。

## 语法/用法

### 执行DML语句的标准流程

```java
// 1. 建立数据库连接
Connection conn = DriverManager.getConnection(
    "jdbc:mysql://localhost:3306/web", "root", "1234");

// 2. SQL语句（预编译）
String sql = "UPDATE user SET password = ?, age = ? WHERE id = ?";

// 3. 创建PreparedStatement
PreparedStatement pstmt = conn.prepareStatement(sql);

// 4. 设置参数
pstmt.setString(1, newPassword);
pstmt.setInt(2, newAge);
pstmt.setInt(3, userId);

// 5. 执行更新
int rowsUpdated = pstmt.executeUpdate();

// 6. 关闭资源
pstmt.close();
conn.close();
```

### DML vs DQL 返回值

| 操作类型 | 方法 | 返回值 |
|----------|------|--------|
| DML（INSERT/UPDATE/DELETE）| `executeUpdate()` | `int` — 影响的记录数 |
| DQL（SELECT）| `executeQuery()` | `ResultSet` — 查询结果集 |

### 事务处理

JDBC默认自动提交。如需手动控制事务：

```java
conn.setAutoCommit(false);   // 关闭自动提交
// ... 执行多条DML ...
conn.commit();               // 手动提交
// 或 conn.rollback();       // 出错时回滚
```

## 常见场景

- 用户信息的增删改操作
- 批量数据导入/更新
- 需要事务控制的复杂业务操作

## 注意事项

- DML操作必须使用预编译SQL（`PreparedStatement`），防止SQL注入。
- 执行完毕后必须关闭 `PreparedStatement` 和 `Connection`。
- `executeUpdate()` 返回值可用于判断操作是否成功（影响行数 > 0）。
- 多条DML需保证原子性时，务必使用事务控制。

## 相关链接

- [JDBC介绍与连接](/posts/JavaWebAI/JDBC介绍与连接)
- [JDBC查询操作](/posts/JavaWebAI/JDBC查询操作)
- [Mybatis基础](/posts/JavaWebAI/Mybatis基础)