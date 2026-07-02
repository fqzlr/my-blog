---
title: 单元测试与JUnit
published: 2026-05-16
tags:
  - Java
  - Maven
  - JUnit
category: 编程学习
description: 软件测试阶段划分、测试方法分类、JUnit单元测试入门、断言、常用注解及依赖范围
descriptionSource: ai
order: 5
---

# JUnit单元测试

## 测试概述

测试是一种用来促进鉴定软件正确性、完整性、安全性和质量的过程。

### 测试阶段划分

![测试阶段划分](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-47.png)

| 阶段 | 说明 | 目的 | 测试人员 |
|------|------|------|----------|
| **单元测试** | 对软件最小组成单位进行测试 | 检验基本组成单位的正确性 | 开发人员 |
| **集成测试** | 将通过测试的单元组合后测试 | 检查单元之间的协作是否正确 | 开发人员 |
| **系统测试** | 对集成好的软件系统进行彻底测试 | 验证正确性、性能是否满足要求 | 测试人员 |
| **验收测试** | 针对用户需求、业务流程的正式测试 | 验证是否满足验收标准 | 客户/需求方 |

### 测试方法

![测试方法](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-48.png)

| 方法 | 说明 |
|------|------|
| **白盒测试** | 清楚软件内部结构和代码逻辑，用于验证代码和逻辑正确性 |
| **黑盒测试** | 不清楚内部结构，用于验证功能、兼容性、验收测试 |
| **灰盒测试** | 结合白盒和黑盒，既关注内部结构又考虑外部表现 |

![灰盒测试](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-49.png)

## JUnit 单元测试

JUnit 是最流行的 Java 测试框架之一。相比在 `main` 方法中测试，JUnit 具有以下优势：

![JUnit优势](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-51.png)

| main 方法测试的问题 | JUnit 的优势 |
|---------------------|-------------|
| 测试代码与源代码未分开，难维护 | 测试代码与源代码分离，便于维护 |
| 一个方法测试失败影响后面方法 | 各测试方法独立运行 |
| 无法自动化测试，得不到测试报告 | 可自动化测试，自动产出测试报告 |

### 入门示例

**引入依赖**（`pom.xml`）：

```xml
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.9.1</version>
    <scope>test</scope>
</dependency>
```

**编写测试类**（`src/test/java` 目录下）：

```java
@Test
public void testGetAge() {
    Integer age = new UserService().getAge("110002200505091218");
    System.out.println(age);
}
```

- 测试通过：显示绿色
- 测试失败：显示红色

**命名规范**：
- 测试类命名：`XxxTest`
- 测试方法命名：`public void xxx() { ... }`

## 断言

JUnit 提供断言方法，验证被测试方法是否按预期工作。

```java
@Test
public void testGetAge() {
    Integer age = new UserService().getAge("110002200505091218");
    Assertions.assertNotEquals(18, age, "两个值相等");
}

@Test
public void testGetGender() {
    String gender = new UserService().getGender("612429198904201611");
    Assertions.assertEquals("男", gender);
}
```

![断言测试结果](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-54.png)

## 常见注解

| 注解 | 说明 |
|------|------|
| `@Test` | 标记方法为测试方法 |
| `@BeforeEach` | 每个测试方法执行前运行 |
| `@AfterEach` | 每个测试方法执行后运行 |
| `@BeforeAll` | 所有测试方法执行前运行一次（必须 `static`） |
| `@AfterAll` | 所有测试方法执行后运行一次（必须 `static`） |
| `@DisplayName` | 指定测试类或方法的显示名称 |
| `@ParameterizedTest` | 标记为参数化测试方法 |
| `@ValueSource` | 为参数化测试提供数据源 |

**生命周期注解示例**：

```java
public class UserServiceTest {

    @BeforeEach
    public void testBefore() {
        System.out.println("before...");
    }

    @AfterEach
    public void testAfter() {
        System.out.println("after...");
    }

    @BeforeAll
    public static void testBeforeAll() {
        System.out.println("before all ...");
    }

    @AfterAll
    public static void testAfterAll() {
        System.out.println("after all...");
    }

    @Test
    public void testGetAge() {
        Integer age = new UserService().getAge("110002200505091218");
        System.out.println(age);
    }
}
```

![注解输出结果](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-55.png)

**参数化测试示例**：

```java
@DisplayName("测试-学生业务操作")
public class UserServiceTest {

    @DisplayName("测试-获取年龄")
    @Test
    public void testGetAge() {
        Integer age = new UserService().getAge("110002200505091218");
        System.out.println(age);
    }

    @DisplayName("测试-获取性别")
    @ParameterizedTest
    @ValueSource(strings = {"612429198904201611", "612429198904201631", "612429198904201626"})
    public void testGetGender(String idcard) {
        String gender = new UserService().getGender(idcard);
        System.out.println(gender);
    }
}
```

![参数化测试输出](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-56.png)

## 依赖范围

通过 `<scope>` 标签控制依赖的使用范围：

![依赖范围](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-58.png)

| scope 值 | 主程序（main） | 测试程序（test） | 打包（package） |
|-----------|:---:|:---:|:---:|
| `compile`（默认） | ✅ | ✅ | ✅ |
| `test` | ❌ | ✅ | ❌ |
| `provided` | ✅ | ✅ | ❌ |
| `runtime` | ❌ | ✅ | ✅ |

**典型用法**：JUnit 依赖设置 `scope` 为 `test`，表示该依赖仅测试程序可用，主程序中无法使用。

```xml
<dependency>
    <groupId>org.junit.jupiter</groupId>
    <artifactId>junit-jupiter</artifactId>
    <version>5.9.1</version>
    <scope>test</scope>
</dependency>
```

![scope配置](https://ph.0824.uk/file/article/03-Web后端基础_Maven基础_-image-59.png)

## 注意事项

- 单元测试代码应放在 `src/test/java` 目录下，与源代码分离。
- `@BeforeAll` 和 `@AfterAll` 方法必须使用 `static` 修饰。
- 依赖范围合理设置可避免将测试依赖打入生产包。