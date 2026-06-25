# 许可证配置详解

许可证配置文件用于设置文章顶部的版权许可证信息显示。

配置文件路径：[licenseConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/licenseConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否在文章顶部显示许可证信息 |
| `name` | `string` | `"CC BY-NC-SA 4.0"` | 许可证名称 |
| `url` | `string` | `"https://creativecommons.org/licenses/by-nc-sa/4.0/"` | 许可证详情链接 |

## 常用许可证选项

| 许可证 | 名称 | 说明 |
|--------|------|------|
| CC BY | 署名 | 允许他人使用、分发作品，但必须署名 |
| CC BY-SA | 署名-相同方式共享 | 允许改编，但需以相同许可证分发 |
| CC BY-NC | 署名-非商业性使用 | 仅限非商业用途 |
| CC BY-NC-SA | 署名-非商业性使用-相同方式共享 | 非商业+相同方式共享 |
| CC BY-ND | 署名-禁止演绎 | 允许转载但禁止修改 |
| CC0 | 公共领域 | 放弃所有权利，任意使用 |

### 示例

```ts
export const licenseConfig: LicenseConfig = {
  enable: true,
  name: "CC BY-NC-SA 4.0",
  url: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
};
```

### 关闭许可证显示

```ts
export const licenseConfig: LicenseConfig = {
  enable: false,
};
```

::: tip
- 许可证信息会显示在每篇文章的顶部，位于标题下方
- 点击许可证名称会跳转到对应的官方详情页面
- 如需为单篇文章单独设置许可证，可以在文章 frontmatter 中覆盖
:::
