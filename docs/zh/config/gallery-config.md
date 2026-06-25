# 相册配置详解

相册配置文件用于管理相册列表、瀑布流布局和网络相册设置。

配置文件路径：[galleryConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/galleryConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `columnWidth` | `number` | `240` | 瀑布流最小列宽（px），浏览器根据容器宽度自动计算列数 |

::: tip
`columnWidth` 值越小列数越多，值越大列数越少。建议在 200-320 之间调整。
:::

## 网络相册配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `networkAlbum.maxQuantity` | `number` | `10` | 单次获取图片数量上限 |
| `networkAlbum.defaultQuantity` | `number` | `6` | 默认加载图片数量 |

## 相册列表配置

`albums` 数组配置所有相册，每个相册包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | 是 | 相册唯一标识符，用于目录命名和 URL 路径 |
| `name` | `string` | 是 | 相册显示名称 |
| `description` | `string` | 是 | 相册描述 |
| `location` | `string` | 否 | 拍摄地点 |
| `date` | `string` | 是 | 相册日期，格式 `YYYY-MM-DD`，用于排序 |
| `tags` | `string[]` | 否 | 相册标签，用于分类过滤 |
| `cover` | `string` | 否 | 手动指定封面图路径，不填则自动寻找 |

### 相册目录结构

每个相册需要在 `public/gallery/` 目录下创建对应的子目录，目录名与 `id` 一致：

```
public/gallery/
├── ai-2026/          # 对应 id: "ai-2026"
│   ├── 1.webp
│   ├── 2.webp
│   └── ...
└── gpt-img2-2026/    # 对应 id: "gpt-img2-2026"
    ├── cover.jpg     # 封面图（可选）
    ├── 1.webp
    └── ...
```

### 封面图规则

- 如果设置了 `cover` 字段，使用指定图片
- 否则查找目录下的 `cover.*` 文件（cover.jpg、cover.png、cover.webp 等）
- 如果没有封面文件，则使用目录下第一张图片作为封面

### 示例：添加相册

```ts
albums: [
  {
    id: "travel-2024",
    name: "2024 旅行记录",
    description: "今年去过的地方",
    location: "云南",
    date: "2024-07-15",
    tags: ["旅行", "风景"],
  },
  {
    id: "daily-2024",
    name: "日常随拍",
    description: "生活中的小美好",
    date: "2024-01-01",
    tags: ["日常"],
    cover: "/gallery/daily-2024/cover.jpg",
  },
],
```

### 支持的图片格式

- JPG / JPEG
- PNG
- WebP（推荐，体积小质量好）
- AVIF（体积最小，兼容性稍低）
- GIF（动图）

::: tip
- 图片建议使用 WebP 或 AVIF 格式以减小加载体积
- 相册按 `date` 降序排列，最新的相册显示在前面
- 本地相册图片会在构建时被 Astro 自动优化
- 网络相册功能需要额外配置 API 接口
:::
