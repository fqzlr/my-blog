# AI搜索配置详解

AI搜索配置文件用于配置基于向量检索的AI智能搜索功能，包括API地址、模型配置、向量索引等。

配置文件路径：[aiSearchConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/aiSearchConfig.ts)

::: warning
AI搜索功能需要配合 Cloudflare Workers 和 Vectorize 向量数据库使用，需要一定的技术基础。部署前请确保你已了解相关服务的配置方法。
:::

## 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `apiUrl` | `string` | 见源文件 | 第三方 AI API 地址 |
| `modelName` | `string` | `"deepseek-ai/DeepSeek-V4-Flash"` | 对话模型名称（显示在搜索弹窗标题） |
| `embeddingModel` | `string` | `"Qwen/Qwen3-Embedding-8B"` | Embedding 模型（文本转向量用） |
| `vectorizeDim` | `number` | `1024` | 向量维度，需与 Vectorize 索引一致 |
| `batchSize` | `number` | `500` | 构建脚本向量上传批大小 |
| `embedBatchSize` | `number` | `50` | 构建脚本 Embedding 请求批大小 |
| `indexName` | `string` | `"blog-ai-search"` | Cloudflare Vectorize 索引名称 |

## 配置项详解

### apiUrl
第三方 AI API 的基础地址，用于调用对话模型和 Embedding 模型。默认使用 ModelScope 的 API：
```
https://api-inference.modelscope.cn/v1
```

你也可以替换为其他兼容 OpenAI API 格式的服务地址，如：
- OpenAI 官方：`https://api.openai.com/v1`
- 硅基流动：`https://api.siliconflow.cn/v1`
- 自建 OneAPI 等

### modelName
用于生成回答的对话大模型，需要是 API 地址支持的模型。默认使用 DeepSeek-V4-Flash，你也可以替换为：
- `deepseek-ai/DeepSeek-R1`
- `Qwen/Qwen3-72B`
- `meta-llama/Llama-3-70B-Instruct`
- 其他你 API 支持的模型

### embeddingModel
用于将文本转换为向量的 Embedding 模型，向量维度必须与 `vectorizeDim` 一致。

### vectorizeDim
向量维度，由你使用的 Embedding 模型决定。修改此值时需要同步重新创建 Vectorize 索引。

### batchSize / embedBatchSize
构建向量索引时的批处理大小，用于控制 API 请求频率，避免触发限流。

### indexName
Cloudflare Vectorize 索引的名称，需要与你 `wrangler.toml` 中配置的索引名一致。

## 示例配置

```ts
export const aiSearchConfig = {
  apiUrl: "https://api.openai.com/v1",
  modelName: "gpt-4o-mini",
  embeddingModel: "text-embedding-3-small",
  vectorizeDim: 1536,
  batchSize: 100,
  embedBatchSize: 20,
  indexName: "my-blog-search",
};
```

## 构建向量索引

配置完成后，需要运行构建脚本来生成文章的向量索引并上传到 Vectorize：

```bash
node scripts/build-vectorize-index.js
```

::: tip
- Worker 的 `wrangler.toml` 配置需要与此文件保持同步（非敏感配置）
- API Key 等敏感信息应通过环境变量配置，不要硬编码在代码中
- 向量索引构建完成后，新增/修改文章需要重新运行构建脚本
- Vectorize 索引有免费额度，个人博客使用完全足够
:::
