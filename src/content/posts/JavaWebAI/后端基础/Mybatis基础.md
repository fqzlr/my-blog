---
title: Mybatis基础
published: 2026-05-19
tags:
  - Java
  - Mybatis
  - SpringBoot
  - 数据库
  - ORM
category: 编程学习
description: Mybatis是一款优秀的持久层框架，用于简化JDBC开发，支持注解和XML两种方式编写SQL。
descriptionSource: ai
order: 4
---

# Mybatis基础

## 定义

**MyBatis** 是一款优秀的**持久层框架**，用于简化JDBC的开发。原本是Apache的开源项目iBatis，2010年迁移至Google Code并改名为MyBatis，2013年11月迁移到Github。

- 官网：https://mybatis.org/mybatis-3/zh/index.html

**持久层**：即数据访问层（DAO），负责与数据库交互。

**框架**：一套可重用、通用、半成品的软件基础代码模型，在框架基础上开发更高效、规范。

## 快速入门

### 1. 创建SpringBoot工程，导入依赖

```xml
<dependency>
    <groupId>org.mybatis.spring.boot</groupId>
    <artifactId>mybatis-spring-boot-starter</artifactId>
</dependency>
<dependency>
    <groupId>mysql</groupId>
    <artifactId>mysql-connector-java</artifactId>
</dependency>
<dependency>
    <groupId>org.projectlombok</groupId>
    <artifactId>lombok</artifactId>
</dependency>
```

### 2. 数据准备

实体类 `User`（位于 `com.itheima.pojo` 包）：

```java
@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Integer id;
    private String username;
    private String password;
    private String name;
    private Integer age;
}
```

### 3. 配置Mybatis

`application.properties`：

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/web
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.username=root
spring.datasource.password=root@1234
```

### 4. 编写Mapper接口

```java
@Mapper
public interface UserMapper {
    @Select("select * from user")
    public List<User> findAll();
}
```

- `@Mapper`：表示Mybatis中的Mapper接口，运行时框架自动生成代理对象并交由Spring IOC容器管理。
- `@Select`：编写select查询语句。

### 5. 单元测试

```java
@SpringBootTest
class ApplicationTests {
    @Autowired
    private UserMapper userMapper;

    @Test
    public void testFindAll() {
        List<User> userList = userMapper.findAll();
        userList.forEach(System.out::println);
    }
}
```

## JDBC vs Mybatis

| JDBC缺点 | Mybatis解决方案 |
|----------|----------------|
| url/username/password硬编码在代码中 | 配置在 `application.properties` 中 |
| 查询结果解析封装繁琐 | 自动完成映射封装 |
| 频繁获取/释放连接造成资源浪费 | 内置数据库连接池技术 |

## 数据库连接池

数据库连接池是一个容器，负责分配、管理数据库连接。

**工作原理**：

- 程序启动时，在连接池中创建一定数量的Connection对象。
- 客户端执行SQL时从连接池获取Connection，执行完毕后归还（复用）。
- 空闲时间超过最大空闲时间的连接会被自动释放。

**好处**：资源重用、提升响应速度、避免连接遗漏。

### 常见连接池产品

| 连接池 | 说明 |
|--------|------|
| Hikari | SpringBoot默认，性能优越 |
| Druid | 阿里巴巴开源，功能强大 |
| C3P0 / DBCP | 老牌连接池，较少使用 |

### 切换为Druid

```xml
<dependency>
    <groupId>com.alibaba</groupId>
    <artifactId>druid-spring-boot-starter</artifactId>
    <version>1.2.19</version>
</dependency>
```

```properties
spring.datasource.type=com.alibaba.druid.pool.DruidDataSource
spring.datasource.druid.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.druid.url=jdbc:mysql://localhost:3306/web
spring.datasource.druid.username=root
spring.datasource.druid.password=1234
```

## 增删改查操作

### 注解速查

| 操作 | 注解 | 示例 |
|------|------|------|
| 查询 | `@Select` | `@Select("select * from user where id = #{id}")` |
| 新增 | `@Insert` | `@Insert("insert into user(...) values(#{...})")` |
| 修改 | `@Update` | `@Update("update user set ... where id = #{id}")` |
| 删除 | `@Delete` | `@Delete("delete from user where id = #{id}")` |

### 参数占位符

Mybatis提供两种占位符：

| 占位符 | 特点 | 推荐 |
|--------|------|------|
| `#{...}` | 预编译SQL（生成 `?`），防SQL注入 | 强烈推荐 |
| `${...}` | 直接字符串拼接，存在SQL注入风险 | 不推荐 |

### 删除示例

```java
@Delete("delete from user where id = #{id}")
public Integer deleteById(Integer id);
```

`Integer` 返回值表示DML语句影响的记录数。

### 新增示例

```java
@Insert("insert into user(username,password,name,age) values(#{username},#{password},#{name},#{age})")
public void insert(User user);
```

多个参数封装到对象中，通过 `#{对象属性名}` 引用。

### 修改示例

```java
@Update("update user set username=#{username},password=#{password},name=#{name},age=#{age} where id=#{id}")
public void update(User user);
```

### 查询示例（多参数）

```java
@Select("select * from user where username = #{username} and password = #{password}")
public User findByUsernameAndPassword(@Param("username") String username, @Param("password") String password);
```

`@Param` 注解为方法形参起名；基于官方骨架创建的SpringBoot项目中接口编译时会保留方法形参名，`@Param` 可省略（直接 `#{形参名}`）。

## XML映射配置

### 使用场景

- **注解**：简单的增删改查功能。
- **XML**：复杂的SQL功能。

**注意**：一个接口方法对应的SQL语句，要么使用注解，要么使用XML，不可同时配置。

### XML配置规范

1. XML映射文件名称与Mapper接口名称一致，放在相同包下（同包同名）。
2. XML映射文件的 `namespace` 为Mapper接口全限定名。
3. SQL语句的 `id` 与Mapper接口方法名一致，返回类型一致。

### XML示例

```xml
<?xml version="1.0" encoding="UTF-8" ?>
<!DOCTYPE mapper
  PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
  "https://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.itheima.mapper.UserMapper">

    <select id="findAll" resultType="com.itheima.pojo.User">
        select * from user
    </select>

</mapper>
```

## 辅助配置

### SQL提示

在IDEA中配置与MySQL数据库的连接，可在 `@Select` 注解中获得SQL语法提示和表名/列名校验。

### Mybatis日志输出

```properties
mybatis.configuration.log-impl=org.apache.ibatis.logging.stdout.StdOutImpl
```

开启后可在控制台查看执行的SQL语句及参数。

## 注意事项

- 测试类所在包需要与引导类所在包相同。
- 强烈建议使用 `#{}` 占位符，防止SQL注入。
- DML操作建议定义 `Integer` 返回值接收影响行数。
- MybatisX是IDEA中快速开发Mybatis的插件，可快速定位Mapper与XML的映射关系。

## 相关链接

- [JDBC介绍与连接](/posts/JavaWebAI/JDBC介绍与连接)
- [JDBC查询操作](/posts/JavaWebAI/JDBC查询操作)
- [JDBC增删改操作](/posts/JavaWebAI/JDBC增删改操作)
- [SpringBoot配置文件](/posts/JavaWebAI/SpringBoot配置文件)