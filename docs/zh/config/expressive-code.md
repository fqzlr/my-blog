# 代码块配置详解

代码块配置文件用于设置代码高亮主题、代码折叠、语言徽章等 expressive-code 插件功能。

配置文件路径：[expressiveCodeConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/expressiveCodeConfig.ts)

::: tip
修改本配置后需要重启 Astro 开发服务器才能生效。
:::

## 主题配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `darkTheme` | `string` | `"one-dark-pro"` | 暗色模式下的代码主题 |
| `lightTheme` | `string` | `"one-light"` | 亮色模式下的代码主题 |

### 可用主题列表
expressive-code 内置了多种代码主题，包括：
- `one-dark-pro` / `one-light`
- `github-dark` / `github-light`
- `dracula`、`nord`、`material-theme` 等

更多主题请参考 [expressive-code 官方文档](https://expressive-code.com/guides/themes/)。

### 示例

```ts
darkTheme: "github-dark",
lightTheme: "github-light",
```

## 代码折叠插件

控制长代码块的折叠显示功能。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pluginCollapsible.enable` | `boolean` | `true` | 是否启用代码块折叠功能 |
| `pluginCollapsible.lineThreshold` | `number` | `15` | 当代码行数超过此值时显示折叠按钮 |
| `pluginCollapsible.previewLines` | `number` | `8` | 折叠状态下显示的代码行数 |
| `pluginCollapsible.defaultCollapsed` | `boolean` | `true` | 长代码块默认是否折叠 |

### 示例

```ts
pluginCollapsible: {
  enable: true,
  lineThreshold: 20,
  previewLines: 10,
  defaultCollapsed: false,
},
```

## 语言徽章插件

在代码块右上角显示编程语言标识。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `pluginLanguageBadge.enable` | `boolean` | `false` | 是否启用语言徽章插件 |

### 示例

```ts
pluginLanguageBadge: {
  enable: true,
},
```
