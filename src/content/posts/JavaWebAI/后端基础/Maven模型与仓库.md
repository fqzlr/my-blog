---
title: Maven模型与仓库
published: 2026-05-16
tags:
  - Java
  - Maven
category: 编程学习
description: Maven的三大模型（项目对象模型、依赖管理模型、构建生命周期模型）及仓库体系（本地仓库、中央仓库、远程仓库）
descriptionSource: ai
order: 1
---

# Maven模型与仓库

## Maven模型

Maven 基于三种核心模型构建：

### 1. 构建生命周期模型（Build Lifecycle & Phases）

定义标准化构建流程。当需要编译时，Maven 提供编译插件；需要打包时，提供打包插件等。

![构建生命周期模型](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-11.png)

### 2. 项目对象模型（Project Object Model）

将项目抽象成一个对象模型，拥有专属坐标（唯一标识），通过坐标可以定位到所需资源位置。

![项目对象模型](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-8.png)

坐标由三部分组成：

| 组成部分 | 含义 | 示例 |
|----------|------|------|
| `groupId` | 组织名（域名反写） | `com.itheima` |
| `artifactId` | 模块名 | `maven-project01` |
| `version` | 版本号 | `1.0-SNAPSHOT` |

![Maven项目坐标示例](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-9.png)

### 3. 依赖管理模型（Dependency）

使用坐标描述当前项目依赖哪些第三方 jar 包。过去需要手动复制 jar 包到 `lib` 目录，现在只需在 `pom.xml` 中配置依赖即可，对应的 jar 包存储在本地 Maven 仓库中。

![依赖管理模型](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-6.png)

![pom.xml依赖配置](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-5.png)

![本地仓库jar文件](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-27.png)

## Maven仓库

仓库本质是一个目录（文件夹），用于存储开发中所有依赖（jar 包）和插件。

Maven 仓库分为三类：

| 仓库类型 | 说明 |
|----------|------|
| **本地仓库** | 自己计算机上的目录，用来存储 jar 包 |
| **中央仓库** | 由 Maven 团队维护的全球唯一仓库，地址：https://repo1.maven.org/maven2/ |
| **远程仓库（私服）** | 一般由公司团队搭建的私有仓库 |

![Maven仓库分类](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-28.png)

### jar 包查找顺序

当项目中使用坐标引入依赖 jar 包后：

1. 先查找**本地仓库**中是否有对应的 jar 包
   - 有 → 项目直接引用
   - 没有 → 去中央仓库下载到本地仓库
2. 如果搭建了远程仓库（私服），查找顺序变为：**本地仓库 → 远程仓库 → 中央仓库**

## 注意事项

- 中央仓库在国外，下载速度可能较慢，建议配置阿里云私服镜像加速。
- 私服中通常缓存了常用的开源 jar 包，可以减少外网访问。