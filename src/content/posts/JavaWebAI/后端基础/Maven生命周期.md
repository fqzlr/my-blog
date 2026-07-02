---
title: Maven生命周期
published: 2026-05-16
tags:
  - Java
  - Maven
category: 编程学习
description: Maven三套生命周期（clean、default、site）的核心阶段及插件执行机制
descriptionSource: ai
order: 4
---

# Maven生命周期

## 定义

Maven 的生命周期是对所有项目构建过程的抽象和统一，描述了一次项目构建经历哪些阶段。

Maven 从大量项目和构建工具中总结了一套高度完善的构建生命周期，包含清理、初始化、编译、测试、打包、集成测试、验证、部署和站点生成等几乎所有构建步骤。

## 三套生命周期

Maven 将项目构建生命周期划分为三套，相互独立：

![生命周期三套](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-37.png)

| 生命周期 | 作用 |
|----------|------|
| **clean** | 清理工作 |
| **default** | 核心工作：编译、测试、打包、安装、部署等 |
| **site** | 生成报告、发布站点等 |

### 生命周期阶段详解

![生命周期阶段](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-41.png)

常用阶段：

| 阶段 | 说明 |
|------|------|
| `clean` | 移除上一次构建生成的文件 |
| `compile` | 编译项目源代码 |
| `test` | 使用单元测试框架运行测试（JUnit） |
| `package` | 将编译后的文件打包（jar、war 等） |
| `install` | 安装项目到本地仓库 |

**执行顺序**：同一套生命周期中，阶段是有顺序的，后面的阶段依赖于前面的阶段。执行后面的生命周期时，前面的生命周期都会执行。

**跨生命周期**：`package` 和 `compile` 属于同一套生命周期，执行 `package` 时 `compile` 会自动运行；但 `clean` 与 `package` 不属于同一套，执行 `package` 时 `clean` 不会运行。

## 插件机制

Maven 的生命周期是抽象的，生命周期本身不做任何实际工作。**实际任务（如源代码编译）都交由插件来完成。**

![插件执行机制](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-42.png)

生命周期顺序：`clean` → `validate` → `compile` → `test` → `package` → `verify` → `install` → `site` → `deploy`

日常开发重点关注：`clean` → `compile` → `test` → `package` → `install`

## 执行方式

**方式一：IDEA 中执行**
在 IDEA 右侧 Maven 工具栏中选择对应生命周期，双击执行。

**方式二：命令行执行**
在 Maven 项目目录下打开命令行，执行：

```bash
mvn compile    # 编译
mvn test       # 测试
mvn package    # 打包
mvn install    # 安装到本地仓库
```

## 注意事项

- 同一套生命周期中，执行后面的阶段会自动执行前面所有阶段。
- 不同套的生命周期互不影响（如 `clean` 和 `default` 互不触发）。
- 生命周期本身是抽象定义，具体工作由插件实现。