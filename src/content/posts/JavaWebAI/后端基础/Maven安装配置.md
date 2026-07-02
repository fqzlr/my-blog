---
title: Maven安装配置与常见问题
published: 2026-05-16
tags:
  - Java
  - Maven
category: 编程学习
description: Maven下载安装、本地仓库配置、阿里云私服配置、环境变量配置、JDK版本关联及常见依赖下载问题解决
descriptionSource: ai
order: 2
---

# Maven安装配置

## 下载

下载地址：https://maven.apache.org/download.cgi

建议解压到没有中文、特殊字符的路径下。

解压后目录结构：

| 目录 | 说明 |
|------|------|
| `bin/` | 存放可执行命令（重点关注 `mvn` 命令） |
| `conf/` | 存放配置文件（`settings.xml` 后期需要修改） |
| `lib/` | 存放 Maven 依赖的 jar 包（Maven 本身也是 Java 开发） |

## 配置步骤

### 1. 配置本地仓库

在 `conf/settings.xml` 中配置 `<localRepository>` 标签，指定本地仓库路径，用于存储下载的 jar 包。

```xml
<localRepository>E:/maven/repository</localRepository>
```

### 2. 配置阿里云私服

中央仓库在国外，下载速度较慢。在 `conf/settings.xml` 的 `<mirrors>` 标签中添加：

```xml
<mirror>
    <id>alimaven</id>
    <name>aliyun maven</name>
    <url>http://maven.aliyun.com/nexus/content/groups/public/</url>
    <mirrorOf>central</mirrorOf>
</mirror>
```

### 3. 配置环境变量

- 新建系统变量 `MAVEN_HOME`，值为 Maven 解压安装目录
- 在 `Path` 中添加 `%MAVEN_HOME%\bin`
- 验证安装：命令行执行 `mvn -v`，输出版本信息表示安装成功

### 4. 配置关联 JDK 版本（可选）

在 `conf/settings.xml` 的 `<profiles>` 中添加：

```xml
<profile>
    <id>jdk-17</id>
    <activation>
        <activeByDefault>true</activeByDefault>
        <jdk>17</jdk>
    </activation>
    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <maven.compiler.compilerVersion>17</maven.compiler.compilerVersion>
    </properties>
</profile>
```

## 常见问题：依赖下载失败

**问题现象**：Maven 项目中添加的依赖未正确下载，右侧 Maven 面板中依赖报红，reload 重新加载也不会再下载。

**产生原因**：由于网络原因，依赖下载不完整，Maven 仓库中生成了 `xxx.lastUpdated` 文件，该文件不删除则不会重新下载。

**解决方案**：

1. 根据 Maven 依赖坐标，找到仓库中对应的 `xxx.lastUpdated` 文件并删除，然后重新加载项目。
2. 通过命令 `del /s *.lastUpdated` 批量递归删除指定目录下的所有 `xxx.lastUpdated` 文件。
3. 依赖下载完成后，若 Maven 面板仍然报红，可关闭 IDEA 后重新打开加载项目。

## 注意事项

- 安装路径中避免包含中文和空格。
- 配置 `settings.xml` 时注意标签的嵌套层级，`<mirror>` 必须在 `<mirrors>` 内部。
- 首次下载依赖时耗时较长，需耐心等待。