---
title: MySQL安装与连接
published: 2026-05-18
tags:
  - 前端
  - MySQL
  - 数据库
category: 编程学习
description: MySQL 8.0 社区版的安装、启动与命令行连接方式
descriptionSource: ai
order: 2
---

# MySQL安装与连接

## 定义

MySQL 是当前互联网开发中最流行的开源关系型数据库管理系统。

## 版本说明

| 版本 | 说明 |
|---|---|
| MySQL Enterprise Edition（商业版） | 收费，享有技术支持，可试用 30 天 |
| MySQL Community Server（社区版） | 免费，无官方技术支持 |

本课程使用 MySQL Community Server 8.0.34。

## 连接语法

MySQL 服务器启动后，使用命令行连接：

```bash
mysql -u用户名 -p密码 [-h数据库服务器IP地址 -P端口号]
```

- `-h` 省略时默认连接本地 `127.0.0.1`
- `-P` 省略时默认端口 `3306`

### 两种密码输入方式

**方式一**：密码直接跟在 `-p` 后（明文暴露，不安全）

**方式二**：`-p` 后回车，再在交互界面输入密码（推荐）

## 企业环境连接

真实开发中，MySQL 部署在公司服务器（IDC 机房），开发人员通过网络远程连接：

```
mysql -h服务器IP -P端口号 -u用户名 -p
```

![企业远程连接](https://ph.0824.uk/file/article/05-Web后端基础_数据库_-image-8.png)

## 注意事项

- 学习阶段可本地安装，企业开发中数据库在远程服务器。
- 图形化管理工具（DataGrip / IDEA 内置数据库工具）可大幅提升效率。
- 驱动下载可能较慢，需耐心等待。

## 相关链接

- [MySQL 社区版下载](https://downloads.mysql.com/archives/community/)
- [MySQL 安装文档](https://heuqqdmbyk.feishu.cn/wiki/ZRSFwACsRiBD2NkV7bmcrJhInme)
