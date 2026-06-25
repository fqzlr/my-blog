# 影视追番配置详解

影视追番配置文件用于配置基于 GitHub Gist 的外部影视数据源，可在不修改代码的情况下更新番剧、电影、书籍、游戏、音乐等收藏内容。

配置文件路径：[externalBangumiConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/externalBangumiConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否启用外部影视数据源 |
| `gistId` | `string` | 见源文件 | GitHub Gist ID |
| `fileName` | `string` | `"bangumi.json"` | Gist 中的文件名 |

## 使用方法

### 1. 创建 GitHub Gist

1. 访问 [GitHub Gist](https://gist.github.com/)
2. 创建一个新的 Gist，文件名填写 `bangumi.json`
3. 按照下面的格式添加影视数据
4. 创建后从 URL 中获取 Gist ID（如 `https://gist.github.com/user/abc123` 中的 `abc123`）

### 2. 配置 Gist ID

将获取到的 Gist ID 填入配置文件的 `gistId` 字段：

```ts
export const externalBangumiConfig = {
  enable: true,
  gistId: "你的GistID",
  fileName: "bangumi.json",
};
```

### 3. bangumi.json 数据格式

数据按分类组织，支持以下分类：
- `anime` - 番剧/动画
- `book` - 书籍
- `game` - 游戏
- `music` - 音乐
- `movie` - 电影（在源文件中使用）

#### 单条数据格式

每个条目包含以下字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `title` | `string` | 是 | 作品标题 |
| `cover` | `string` | 否 | 封面图片 URL |
| `desc` | `string` | 否 | 作品描述/观后感 |
| `score` | `number` | 否 | 评分（0-10） |
| `status` | `string` | 否 | 观看状态：`watched` 已看、`watching` 在看、`want` 想看 |
| `date` | `string` | 否 | 观看/完结日期，格式 `YYYY-MM-DD` |

### 示例：bangumi.json

```json
{
  "anime": [
    {
      "title": "进击的巨人",
      "cover": "https://example.com/cover.jpg",
      "desc": "史诗级作品",
      "score": 9.8,
      "status": "watched",
      "date": "2024-01-15"
    }
  ],
  "movie": [
    {
      "title": "盗梦空间",
      "cover": "https://example.com/inception.jpg",
      "desc": "诺兰经典之作",
      "score": 9.5,
      "status": "watched"
    }
  ],
  "book": [
    {
      "title": "活着",
      "author": "余华",
      "desc": "感人至深",
      "score": 9.0,
      "status": "watched"
    }
  ]
}
```

## 本地数据配置

除了使用外部 Gist 数据源，你也可以直接在本地内容目录添加影视数据：

- 番剧：`src/content/bangumi/anime/`
- 书籍：`src/content/bangumi/book/`
- 游戏：`src/content/bangumi/game/`
- 音乐：`src/content/bangumi/music/`

每个作品创建一个 `.md` 文件，使用 frontmatter 定义元数据。

::: tip
- 本地数据和 Gist 数据会合并显示
- Gist 数据更新后无需重新构建博客，前端会动态拉取
- 建议使用 Secret Gist 避免数据被随意修改
- 如果不需要外部数据，设置 `enable: false` 即可
:::
