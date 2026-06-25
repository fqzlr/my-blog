# 友链配置详解

友链配置文件用于管理友链页面的显示设置和友链列表，同时支持通过 GitHub Gist 管理外部友链数据源。

配置文件路径：
- [friendsConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/friendsConfig.ts) - 本地友链配置
- [externalFriendsConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalFriendsConfig.ts) - 外部友链数据源配置

## 友链页面配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | `""` | 页面标题，留空使用 i18n 翻译 |
| `description` | `string` | `""` | 页面描述文本，留空使用 i18n 翻译 |
| `showCustomContent` | `boolean` | `true` | 是否显示底部自定义内容（friends.mdx） |
| `showComment` | `boolean` | `true` | 是否显示评论区（需先启用评论系统） |
| `randomizeSort` | `boolean` | `false` | 是否随机排序友链，开启后忽略权重 |
| `applyLink` | `string` | 见源文件 | 友链申请链接，显示申请按钮 |

### 站点信息配置

用于友链申请指南弹窗中展示本站信息：

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `siteInfo.name` | `string` | 站点名称 |
| `siteInfo.desc` | `string` | 站点描述 |
| `siteInfo.url` | `string` | 站点 URL |
| `siteInfo.avatar` | `string` | 站点头像 URL |
| `siteInfo.email` | `string` | 联系邮箱 |

### 注意事项配置

友链申请指南弹窗中的注意事项列表，每项包含 `title` 和 `content`。

## 友链项配置

每个友链对象包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | `string` | 是 | 友链站点名称 |
| `imgurl` | `string` | 是 | 站点头像 URL |
| `desc` | `string` | 是 | 站点描述 |
| `siteurl` | `string` | 是 | 站点链接 |
| `tags` | `string[]` | 否 | 标签数组，如 `["Blog"]`、`["Docs"]` |
| `weight` | `number` | 否 | 排序权重，数值越大越靠前，默认 10 |
| `enabled` | `boolean` | 是 | 是否启用该友链 |

### 示例：添加友链

```ts
{
  title: "示例博客",
  imgurl: "https://example.com/avatar.png",
  desc: "这是一个示例博客",
  siteurl: "https://example.com/",
  tags: ["Blog"],
  weight: 50,
  enabled: true,
},
```

## 外部友链数据源配置

基于 GitHub Gist 的外部友链数据源，可在不修改代码的情况下更新友链。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否启用外部友链数据源 |
| `gistId` | `string` | 见源文件 | GitHub Gist ID |
| `fileName` | `string` | `"friends.json"` | Gist 中的文件名 |

### 使用方法

1. 在 [GitHub Gist](https://gist.github.com/) 创建一个名为 `friends.json` 的文件
2. 将友链数据按 JSON 格式写入（格式与本地配置一致）
3. 从 Gist URL 中获取 Gist ID（如 `https://gist.github.com/user/abc123` 中的 `abc123`）
4. 将 Gist ID 填入 `gistId` 字段

### friends.json 格式示例

```json
[
  {
    "title": "外部友链示例",
    "imgurl": "https://example.com/avatar.png",
    "desc": "通过 Gist 管理的友链",
    "siteurl": "https://example.com/",
    "tags": ["Blog"],
    "weight": 10,
    "enabled": true
  }
]
```

::: tip
- 友链按 `weight` 降序排列，权重相同则按添加顺序排列
- 设置 `enabled: false` 可以暂时隐藏友链而不删除
- 外部友链和本地友链会合并显示
- 自定义底部内容可在 `src/content/spec/friends.md` 中编写
:::
