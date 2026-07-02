---
title: SpringBoot配置文件
published: 2026-05-19
tags:
  - SpringBoot
  - YAML
  - 配置
  - Java
category: 编程学习
description: SpringBoot支持properties和yml两种配置文件格式，yml以数据为中心，层级结构更清晰。
descriptionSource: ai
order: 5
---

# SpringBoot配置文件

## 定义

SpringBoot项目支持两种配置文件格式：

| 格式 | 文件名 | 特点 |
|------|--------|------|
| properties | `application.properties` | `key=value` 形式，层级不清晰 |
| yml | `application.yml` / `application.yaml` | 以数据为中心，层级清晰，推荐使用 |

## 语法

### YML基本语法

- 大小写敏感
- 数值前必须有空格作为分隔符
- 使用缩进表示层级关系，不允许使用Tab键，只能用空格（IDEA中自动将Tab转换为空格）
- 相同层级的元素左侧对齐即可
- `#` 表示注释

### 定义对象/Map集合

```yaml
user:
  name: zhangsan
  age: 18
  password: 123456
```

### 定义数组/List/Set集合

```yaml
hobby:
  - java
  - game
  - sport
```

## 常见场景

### 数据库连接配置对比

**properties 写法**：

```properties
spring.datasource.driver-class-name=com.mysql.cj.jdbc.Driver
spring.datasource.url=jdbc:mysql://localhost:3306/web01
spring.datasource.username=root
spring.datasource.password=root@1234
mybatis.configuration.log-impl=org.apache.ibatis.logging.stdout.StdOutImpl
```

**yml 写法**：

```yaml
#数据源配置
spring:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/web01
    username: root
    password: root@1234
#mybatis配置
mybatis:
  configuration:
    log-impl: org.apache.ibatis.logging.stdout.StdOutImpl
```

## 注意事项

- 在项目开发中，推荐使用 `application.yml` 配置文件，简洁、明了。
- 如果配置项的值以 `0` 开头，值需要使用单引号引起来，因为以 `0` 开头在yml中表示八进制数据。
- `application.properties` 和 `application.yml` 可共存，优先级由SpringBoot加载顺序决定。
- 切换配置文件格式时，将原文件重命名（如改为 `_application.properties`）即可避免冲突。

## 相关链接

- [Mybatis基础](/posts/JavaWebAI/Mybatis基础)