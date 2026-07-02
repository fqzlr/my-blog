---
title: JDBC查询操作
published: 2026-05-19
tags:
  - Java
  - JDBC
  - SQL
  - 数据库
category: 编程学习
description: 基于JDBC实现数据库查询操作，包括预编译SQL、ResultSet解析与SQL注入防护。
descriptionSource: ai
order: 3
---

# JDBC查询操作

## 定义

JDBC查询操作通过 `PreparedStatement` 执行 `SELECT` 语句，返回 `ResultSet` 结果集，遍历解析后获取数据。

## 语法/用法

### 核心代码流程

```java
// 1. 获取连接
Connection conn = DriverManager.getConnection(
    "jdbc:mysql://localhost:3306/web", "root", "1234");

// 2. 创建预编译的PreparedStatement对象
PreparedStatement pstmt = conn.prepareStatement(
    "SELECT * FROM user WHERE username = ? AND password = ?");

// 3. 设置参数
pstmt.setString(1, "daqiao");
pstmt.setString(2, "123456");

// 4. 执行查询
ResultSet rs = pstmt.executeQuery();

// 5. 处理结果集
while (rs.next()) {
    int id = rs.getInt("id");
    String username = rs.getString("username");
    String password = rs.getString("password");
    String name = rs.getString("name");
    int age = rs.getInt("age");
}

// 6. 关闭资源
rs.close();
pstmt.close();
conn.close();
```

### 参数化测试版本

```java
@ParameterizedTest
@CsvSource({"daqiao,123456"})
public void testJdbc(String _username, String _password) throws Exception {
    Connection conn = DriverManager.getConnection(
        "jdbc:mysql://localhost:3306/web", "root", "1234");
    PreparedStatement pstmt = conn.prepareStatement(
        "SELECT * FROM user WHERE username = ? AND password = ?");
    pstmt.setString(1, _username);
    pstmt.setString(2, _password);
    ResultSet rs = pstmt.executeQuery();
    while (rs.next()) {
        // 解析结果...
    }
    rs.close();
    pstmt.close();
    conn.close();
}
```

### Maven依赖

```xml
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
    <version>8.0.30</version>
</dependency>
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.9.3</version>
    <scope>test</scope>
</dependency>
```

## ResultSet 详解

`ResultSet`（结果集对象）封装了DQL查询语句查询的结果。

| 方法 | 说明 |
|------|------|
| `next()` | 将光标从当前位置向前移动一行，返回 `true`（有效行）/ `false`（无效行）|
| `getXxx(列编号)` | 按列索引获取数据 |
| `getXxx("列名")` | 按列名获取数据（推荐）|

解析步骤：光标初始指向第0行 → 每次 `next()` 前移一行 → 有数据则用 `getXxx` 取值。

## 预编译SQL

### 两种风格对比

| 风格 | 示例 | 特点 |
|------|------|------|
| 静态SQL | `"SELECT * FROM user WHERE username = 'daqiao'"` | 参数硬编码，不安全 |
| 预编译SQL | `"SELECT * FROM user WHERE username = ?"` | 参数动态传递，推荐 |

### SQL注入

**SQL注入**：通过控制输入来修改事先定义好的SQL语句，以达到执行代码对服务器进行攻击的方法。

典型攻击输入：密码输入 `' or '1' = '1`，拼接后SQL变为：

```sql
SELECT * FROM user WHERE username = 'xxx' AND password = '' or '1' = '1'
```

`or '1'='1'` 恒为真，导致绕过登录验证。

### 解决方案

预编译SQL将 `' or '1'='1` 整体作为字符串参数处理（转义为普通字符串），而非SQL逻辑的一部分，从而杜绝SQL注入。

### 性能优势

预编译SQL在数据库端可缓存执行计划，同一SQL模板多次执行时性能更高。

## 注意事项

- 始终使用预编译SQL（`PreparedStatement`），禁止直接拼接SQL字符串。
- `ResultSet`、`PreparedStatement`、`Connection` 使用完毕后必须关闭，推荐使用 try-with-resources。
- JDBC执行DQL语句用 `executeQuery()`，返回 `ResultSet`。

