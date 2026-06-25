# 日历配置详解

日历配置文件用于设置日历页面的节日、生日、日程安排等，支持公历和农历日期。

配置文件路径：[calendarConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/calendarConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `title` | `string` | `""` | 页面标题，留空使用 i18n 翻译 |
| `description` | `string` | `""` | 页面描述，留空使用 i18n 翻译 |
| `showComment` | `boolean` | `false` | 是否显示评论区 |

## 节日 API 配置

构建时自动从 API 拉取法定节假日数据并缓存，运行时无网络依赖。

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `holidayApi.enable` | `boolean` | `true` | 是否启用 API 拉取节假日 |
| `holidayApi.url` | `string` | 见源文件 | timor.tech 节假日 API 地址 |
| `holidayApi.fallbackOnError` | `boolean` | `true` | 拉取失败时是否使用内置节日兜底 |
| `holidayApi.years` | `number[]` | `[2026, 2027]` | 构建时拉取哪些年份的数据 |

## 内置补充节日

`builtinHolidays` 数组用于补充 API 不覆盖的节日，支持公历和农历：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 节日名称 |
| `date.type` | `"solar" \| "lunar"` | 日期类型：`solar` 公历，`lunar` 农历 |
| `date.month` | `number` | 月份（1-12） |
| `date.day` | `number` | 日期（1-31） |
| `icon` | `string` | 图标（Iconify 图标名） |

### 示例：添加节日

```ts
builtinHolidays: [
  {
    name: "春节",
    date: { type: "lunar", month: 1, day: 1 },
    icon: "material-symbols:festival",
  },
  {
    name: "圣诞节",
    date: { type: "solar", month: 12, day: 25 },
    icon: "material-symbols:card-giftcard",
  },
],
```

## 生日/纪念日配置

`birthdays` 数组配置每年重复的生日或纪念日：

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | `string` | 名称 |
| `date.type` | `"solar" \| "lunar"` | 日期类型 |
| `date.month` | `number` | 月份 |
| `date.day` | `number` | 日期 |
| `icon` | `string` | 图标 |
| `note` | `string` | 备注说明（可选） |

### 示例：添加生日

```ts
birthdays: [
  {
    name: "我的生日",
    date: { type: "solar", month: 12, day: 1 },
    icon: "material-symbols:cake",
    note: "又长大一岁",
  },
  {
    name: "妈妈生日",
    date: { type: "lunar", month: 8, day: 15 },
    icon: "material-symbols:cake",
    note: "农历生日",
  },
],
```

## 日程安排配置

`schedules` 数组支持一次性和重复日程安排：

### 一次性安排

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 日程标题 |
| `date` | `string` | 具体日期，格式 `YYYY-MM-DD` |
| `note` | `string` | 备注（可选） |

### 重复安排

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `string` | 日程标题 |
| `recurring.freq` | `"weekly" \| "monthly" \| "yearly"` | 重复频率 |
| `recurring.weekday` | `number` | 每周重复时：周几（0=周日，1=周一...6=周六） |
| `recurring.day` | `number` | 每月/每年重复时：日期 |
| `recurring.month` | `number` | 每年重复时：月份 |
| `recurring.lunar` | `boolean` | 是否为农历日期 |

### 示例：日程配置

```ts
schedules: [
  // 一次性
  { title: "毕业答辩", date: "2026-06-15", note: "记得带身份证" },
  // 每周五
  { title: "周报提交", recurring: { freq: "weekly", weekday: 5 } },
  // 每月28号
  { title: "月度复盘", recurring: { freq: "monthly", day: 28 } },
  // 每年公历4月5日
  { title: "祭祖", recurring: { freq: "yearly", month: 4, day: 5, lunar: false } },
],
```

## 显示开关配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `show.posts` | `boolean` | `true` | 是否在日历上显示文章发布日期 |
| `show.lunarDate` | `boolean` | `true` | 单元格右上角是否显示农历日期 |
| `show.weekNumber` | `boolean` | `false` | 是否显示周序号 |

## 未来概览配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `overview.futureDays` | `number` | `30` | 概览显示未来多少天的事件 |
| `overview.maxItems` | `number` | `6` | 概览卡片最多显示多少项 |

::: tip
- 农历日期会自动换算为当年的公历日期
- 节假日数据在构建时拉取，部署后不会更新，需要重新构建
- 文章发布日期会自动标记在日历上
- 支持的图标请使用 Iconify Material Symbols 图标集
:::
