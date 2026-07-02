---
title: SpringBootWeb案例
published: 2026-05-17
tags:
  - 前端
  - SpringBoot
  - Java
category: 编程学习
description: 基于SpringBoot开发Web程序完成用户列表渲染的完整案例
descriptionSource: ai
order: 4
---

# SpringBootWeb案例

## 定义
本案例展示了如何使用SpringBoot开发一个Web应用，完成用户列表的渲染展示。前端页面通过Ajax请求后端接口，后端从文本文件中加载用户数据并返回JSON格式数据，前端再将数据渲染展示在表格中。

## 语法/用法
### 1. 定义实体类
```java
package com.itheima.pojo;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Integer id;
    private String username;
    private String password;
    private String name;
    private Integer age;
    private LocalDateTime updateTime;
}
```

### 2. 引入Hutool工具包
```xml
<dependency>
    <groupId>cn.hutool</groupId>
    <artifactId>hutool-all</artifactId>
    <version>5.8.27</version>
</dependency>
```

### 3. 开发Controller
```java
import cn.hutool.core.io.IoUtil;
import cn.hutool.json.JSONConfig;
import cn.hutool.json.JSONUtil;
import com.itheima.pojo.User;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@RestController
public class UserController {
    @RequestMapping("/list")
    public String list(){
        //1.加载并读取文件
        InputStream in = this.getClass().getClassLoader().getResourceAsStream("user.txt");
        ArrayList<String> lines = IoUtil.readLines(in, StandardCharsets.UTF_8, new ArrayList<>());
        //2.解析数据，封装成User对象
        List<User> userList = lines.stream().map(line -> {
            String[] parts = line.split(",");
            return new User(
                Integer.parseInt(parts[0]), parts[1], parts[2],
                parts[3], Integer.parseInt(parts[4]),
                LocalDateTime.parse(parts[5], DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
            );
        }).collect(Collectors.toList());
        //3.响应JSON数据
        return JSONUtil.toJsonStr(userList, JSONConfig.create().setDateFormat("yyyy-MM-dd HH:mm:ss"));
    }
}
```

### 4. @ResponseBody注解
- **类型**：方法注解、类注解
- **位置**：书写在Controller方法上或类上
- **作用**：将方法返回值直接响应给浏览器，如果返回值类型是实体对象/集合，将转换为JSON格式后响应
- `@RestController` = `@Controller` + `@ResponseBody`，在类上加此注解后，所有方法自动带有@ResponseBody功能

## 常见场景
1. 前后端分离项目中，后端Controller返回JSON数据给前端渲染
2. 将本地文本文件数据读取后通过API接口暴露
3. 使用Hutool等工具库简化文件读取和JSON转换操作

## 注意事项
1. **代码职责混乱问题**：上述案例将数据读取、逻辑处理、响应代码全部写在Controller中，当业务复杂时会导致代码复用性差、难以维护
2. 前后端分离的项目中，一般直接在请求处理类上加`@RestController`注解，无需在方法上加`@ResponseBody`

## 相关链接
- [Hutool官方文档](https://hutool.cn/)
- [SpringBoot官方文档](https://spring.io/projects/spring-boot)