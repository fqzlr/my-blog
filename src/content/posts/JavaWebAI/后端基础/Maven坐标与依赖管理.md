---
title: Maven坐标与依赖管理
published: 2026-05-16
tags:
  - Java
  - Maven
category: 编程学习
description: Maven坐标体系、POM文件结构、依赖配置、依赖传递与排除依赖的完整说明
descriptionSource: ai
order: 3
---

# Maven坐标与依赖管理

## Maven坐标

坐标是资源的**唯一标识**，通过坐标可以唯一定位资源位置，用于定义项目或引入依赖。

### 坐标组成

| 组成部分 | 含义 | 说明 |
|----------|------|------|
| `groupId` | 组织名称 | 通常为域名反写，如 `com.itheima` |
| `artifactId` | 模块名称 | 如 `order-service`、`goods-service` |
| `version` | 版本号 | `SNAPSHOT`（快照版）或 `RELEASE`（发行版） |

- **SNAPSHOT**：功能不稳定、尚处于开发中的快照版本
- **RELEASE**：功能趋于稳定、可以用于发行的版本

![坐标表示项目](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-29.png)

## POM 文件结构

POM（Project Object Model）通过 `pom.xml` 描述当前 Maven 项目。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <!-- POM模型版本 -->
    <modelVersion>4.0.0</modelVersion>

    <!-- 当前项目坐标 -->
    <groupId>com.itheima</groupId>
    <artifactId>maven-project01</artifactId>
    <version>1.0-SNAPSHOT</version>

    <!-- 项目的JDK版本及编码 -->
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>
</project>
```

**核心标签说明**：

| 标签 | 说明 |
|------|------|
| `<project>` | POM 文件根标签 |
| `<modelVersion>` | POM 模型版本，目前为 4.0.0 |
| `<groupId>` / `<artifactId>` / `<version>` | 项目坐标，定位项目在本地仓库中的位置 |
| `<maven.compiler.source>` | 编译 JDK 版本 |
| `<maven.compiler.target>` | 运行 JDK 版本 |
| `<project.build.sourceEncoding>` | 项目字符集编码 |

## 依赖配置

### 基本配置

在 `pom.xml` 中使用 `<dependencies>` 和 `<dependency>` 引入依赖：

```xml
<dependencies>
    <dependency>
        <groupId>org.springframework</groupId>
        <artifactId>spring-context</artifactId>
        <version>6.1.4</version>
    </dependency>
</dependencies>
```

**查找依赖坐标的途径**：Maven 中央仓库 https://mvnrepository.com/

### 依赖传递

在 Maven 项目中，如果 A 依赖 B，B 依赖 C，C 依赖 D，那么 A 项目中也会传递引入 C 和 D。

![依赖传递](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-33.png)

### 排除依赖

如果传递下来的某个依赖不需要，可以通过 `<exclusions>` 排除，**被排除的资源无需指定版本**。

```xml
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-context</artifactId>
    <version>6.1.4</version>

    <!-- 排除依赖 -->
    <exclusions>
        <exclusion>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-observation</artifactId>
        </exclusion>
    </exclusions>
</dependency>
```

![排除依赖](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-34.png)

## 注意事项

- 引入的依赖如果在本地仓库中不存在，会连接远程仓库/中央仓库下载，首次耗时较长。
- 依赖坐标信息不确定时，可到 https://mvnrepository.com/ 搜索。
- 排除依赖只需指定 `groupId` 和 `artifactId`，无需 `version`。