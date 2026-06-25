# 页脚配置详解

页脚配置文件用于启用自定义页脚 HTML 内容注入功能。

配置文件路径：[footerConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/footerConfig.ts)

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `false` | 是否启用自定义页脚 HTML 注入功能 |

## HTML 内容编辑

自定义页脚内容需要直接编辑 HTML 文件：

文件路径：[FooterConfig.html](file:///e:/AItool/zzwork/my-blog/src/config/FooterConfig.html)

你可以在该文件中添加备案号、自定义链接、版权声明等 HTML 内容。

### 示例

```ts
export const footerConfig: FooterConfig = {
  enable: true, // 启用自定义页脚
};
```

### FooterConfig.html 示例

```html
<div class="custom-footer">
  <p>© 2024 我的博客 | <a href="https://beian.miit.gov.cn/" target="_blank">备案号</a></p>
  <p>Powered by <a href="https://astro.build" target="_blank">Astro</a></p>
</div>
```

::: tip
- 启用后会在默认页脚下方显示自定义 HTML 内容
- 可以在 HTML 中使用内联样式或全局 CSS 类
- 备案号配置建议优先使用 `siteConfig.ts` 中的 `beian` 字段
:::
