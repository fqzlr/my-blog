# 赞助配置详解

赞助配置文件用于设置赞助页面的内容、赞助方式、赞助者列表等信息。

配置文件路径：[sponsorConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/sponsorConfig.ts)

## 页面基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | `"赞助"` | 页面标题 |
| `description` | `string` | 见源文件 | 页面描述文本 |
| `usage` | `string` | `""` | 赞助用途说明 |
| `showSponsorsList` | `boolean` | `true` | 是否显示赞助者列表 |
| `showComment` | `boolean` | `true` | 是否显示评论区 |
| `showButtonInPost` | `boolean` | `true` | 是否在文章详情页底部显示赞助按钮 |

## 赞助方式配置

`methods` 数组配置支持的赞助渠道，每个赞助方式包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 赞助方式名称，如"微信支付"、"支付宝" |
| `icon` | `string` | 是 | 图标名称（使用 Iconify 图标名） |
| `qrCode` | `string` | 否 | 收款码图片路径（放在 public 目录下） |
| `link` | `string` | 否 | 赞助链接（如爱发电个人主页） |
| `description` | `string` | 否 | 赞助方式描述 |
| `enabled` | `boolean` | 是 | 是否启用该赞助方式 |

### 示例：赞助方式配置

```ts
methods: [
  {
    name: "微信支付",
    icon: "fa7-brands:weixin",
    qrCode: "/assets/images/wechat.png",
    link: "",
    description: "",
    enabled: true,
  },
  {
    name: "爱发电",
    icon: "simple-icons:afdian",
    qrCode: "",
    link: "https://ifdian.net/a/yourname",
    description: "通过爱发电进行打赏",
    enabled: true,
  },
],
```

## 赞助者列表配置

`sponsors` 数组用于展示赞助者信息，每个赞助者包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 赞助者名称 |
| `avatar` | `string` | 否 | 赞助者头像 URL（不填显示默认头像） |
| `amount` | `string` | 否 | 赞助金额，如 `"¥50"` |
| `date` | `string` | 否 | 赞助日期，格式 `YYYY-MM-DD` |

### 示例：添加赞助者

```ts
sponsors: [
  {
    name: "赞助者昵称",
    avatar: "https://example.com/avatar.png",
    amount: "¥50",
    date: "2024-01-01",
  },
  {
    name: "匿名好心人",
    amount: "¥10",
    date: "2024-01-15",
  },
],
```

::: tip
- 收款码图片建议放在 `public/assets/images/` 目录下
- 图标使用 Iconify 图标名，可在 [Iconify 图标库](https://icon-sets.iconify.design/) 查找
- 匿名赞助者可以不设置 `avatar` 字段
- 赞助按钮会显示在每篇文章的底部侧边栏
:::
