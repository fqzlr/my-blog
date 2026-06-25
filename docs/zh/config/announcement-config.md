# 公告配置详解

公告配置文件用于设置侧边栏公告组件的标题、公告列表和关闭功能。

配置文件路径：[announcementConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/announcementConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | `"公告"` | 公告组件标题 |
| `closable` | `boolean` | `true` | 是否允许用户关闭公告 |

## 公告列表配置

`items` 数组配置每条公告的内容，每个公告项包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `tag` | `string` | 否 | 公告标签，如"欢迎"、"更新"、"友链" |
| `title` | `string` | 是 | 公告标题 |
| `content` | `string` | 是 | 公告内容文本 |
| `time` | `string` | 否 | 发布日期，格式 `YYYY-MM-DD` |
| `link` | `string` | 否 | 详情链接，点击公告跳转 |
| `sort` | `number` | 否 | 排序权重，数值越小越靠前 |

### 示例：添加公告

```ts
items: [
  {
    tag: "欢迎",
    title: "欢迎来到我的博客",
    content: "这里记录我的学习和生活，欢迎常来看看！",
    time: "2024-01-01",
    link: "/about/",
    sort: 1,
  },
  {
    tag: "更新",
    title: "网站功能更新",
    content: "新增了相册和音乐播放器功能，欢迎体验！",
    time: "2024-01-15",
    link: "/changelog/",
    sort: 2,
  },
],
```

### 完整配置示例

```ts
export const announcementConfig: AnnouncementConfig = {
  title: "最新公告",
  items: [
    {
      tag: "通知",
      title: "评论系统升级",
      content: "评论系统已升级，欢迎留言互动！",
      time: "2024-06-01",
      link: "/guestbook/",
      sort: 1,
    },
  ],
  closable: true,
};
```

::: tip
- 公告按 `sort` 升序排列，数值越小越靠前
- 设置 `link` 后公告会变为可点击状态
- 用户关闭公告后会记住状态，不会重复弹出
- 公告组件需要在 `sidebarConfig.ts` 中启用才会显示
- 标签可以用来区分公告类型，支持自定义标签文字
:::
