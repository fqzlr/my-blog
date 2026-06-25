# 广告配置详解

广告配置文件用于设置侧边栏广告组件的内容，支持纯图片广告和带文字内容的完整广告。

配置文件路径：[adConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/adConfig.ts)

::: tip
这里只是配置广告内容，如果要开关广告组件，请在 `sidebarConfig.ts` 中控制侧边栏组件的启用。
:::

## 广告配置项

支持两个独立的广告配置：`adConfig1` 和 `adConfig2`，可以同时启用或分别配置。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | - | 广告标题（可选，纯图片广告可不填） |
| `content` | `string` | - | 广告内容文本（可选） |
| `image.src` | `string` | - | 广告图片路径 |
| `image.alt` | `string` | - | 图片替代文本 |
| `image.link` | `string` | - | 图片点击跳转链接 |
| `image.external` | `boolean` | - | 是否为外部链接（外部链接会在新窗口打开） |
| `link.text` | `string` | - | 按钮文字（可选） |
| `link.url` | `string` | - | 按钮跳转链接 |
| `link.external` | `boolean` | - | 按钮链接是否为外部链接 |
| `closable` | `boolean` | `true` | 是否允许用户关闭广告 |
| `displayCount` | `number` | `-1` | 显示次数限制，`-1` 为无限制 |
| `padding.all` | `string` | - | 四边内边距，如 `"0"`、`"1rem"` |
| `padding.top` | `string` | - | 顶部内边距 |
| `padding.right` | `string` | - | 右侧内边距 |
| `padding.bottom` | `string` | - | 底部内边距 |
| `padding.left` | `string` | - | 左侧内边距 |

## 纯图片广告示例

无边距图片占满整个广告组件：

```ts
export const adConfig1: AdConfig = {
  image: {
    src: "assets/images/banner.jpg",
    alt: "广告横幅",
    link: "https://example.com",
    external: true,
  },
  closable: true,
  displayCount: -1,
  padding: {
    all: "0",
  },
};
```

## 完整内容广告示例

带标题、描述、图片和按钮的完整广告：

```ts
export const adConfig2: AdConfig = {
  title: "支持博主",
  content: "如果您觉得本站内容对您有帮助，欢迎支持我们的创作！",
  image: {
    src: "assets/images/support.jpg",
    alt: "支持博主",
    link: "/sponsor/",
    external: false,
  },
  link: {
    text: "支持一下",
    url: "/sponsor/",
    external: false,
  },
  closable: true,
  displayCount: -1,
  padding: {
    all: "1rem",
  },
};
```

::: tip
- 图片建议放在 `public/assets/images/` 目录下
- `displayCount` 设置为正整数时，用户关闭指定次数后广告不再显示
- 设置 `padding.all: "0"` 可实现图片无边距铺满效果
- 内部链接使用相对路径（如 `/about/`），外部链接需设置 `external: true`
:::
