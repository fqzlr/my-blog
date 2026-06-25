# 看板娘配置详解

看板娘配置文件用于设置 Spine 2D 模型和 Live2D 模型看板娘，支持位置、尺寸、交互消息、响应式等配置。

配置文件路径：[pioConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/pioConfig.ts)

主题支持两种看板娘模型：
- **Spine 模型**：使用 Esoteric Software Spine 制作的 2D 骨骼动画模型
- **Live2D 模型**：使用 Live2D Cubism 制作的模型（支持 Cubism 2 和 Cubism 3+）

## Spine 模型配置

### 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `false` | 是否启用 Spine 看板娘 |

### 模型配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `model.path` | `string` | 见源文件 | Spine 模型 JSON 文件路径 |
| `model.scale` | `number` | `1.0` | 模型缩放比例 |
| `model.x` | `number` | `0` | X 轴偏移 |
| `model.y` | `number` | `0` | Y 轴偏移 |

### 位置配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `position.corner` | `string` | `"bottom-left"` | 显示位置：`bottom-left`、`bottom-right`、`top-left`、`top-right` |
| `position.offsetX` | `number` | `0` | 水平偏移距离（px） |
| `position.offsetY` | `number` | `0` | 垂直偏移距离（px） |

::: warning
注意：在 `bottom-right` 位置可能会挡住返回顶部按钮。
:::

### 尺寸配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `size.width` | `number` | `135` | 容器宽度（px） |
| `size.height` | `number` | `165` | 容器高度（px） |

### 交互配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `interactive.enabled` | `boolean` | `true` | 是否启用交互功能 |
| `interactive.clickAnimations` | `string[]` | 见源文件 | 点击时随机播放的动画列表 |
| `interactive.clickMessages` | `string[]` | 见源文件 | 点击时随机显示的文字消息 |
| `interactive.messageDisplayTime` | `number` | `3000` | 文字显示时间（毫秒） |
| `interactive.idleAnimations` | `string[]` | 见源文件 | 待机动画列表 |
| `interactive.idleInterval` | `number` | `8000` | 待机动画切换间隔（毫秒） |

### 其他配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `responsive.hideOnMobile` | `boolean` | `true` | 是否在移动端隐藏 |
| `responsive.mobileBreakpoint` | `number` | `768` | 移动端断点（px） |
| `zIndex` | `number` | `1000` | 元素层级 |
| `opacity` | `number` | `1.0` | 透明度，范围 0-1 |

## Live2D 模型配置

### 基本配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `enable` | `boolean` | `true` | 是否启用 Live2D 看板娘 |
| `defaultVisible` | `boolean` | `false` | 首次访问是否默认显示（false 则点击入口后加载） |

### 模型配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `model.path` | `string` | 见源文件 | Live2D 模型文件路径（支持 `.model.json` 和 `.model3.json`） |

### 分辨率配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `resolution` | `number` | `3` | 渲染分辨率倍率，默认使用 `devicePixelRatio`（上限 2），值越大越清晰但越耗性能 |

### 作者信息

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `author.name` | `string` | 模型作者名称 |
| `author.url` | `string` | 作者主页链接 |

### 交互配置

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `interactive.enabled` | `boolean` | `true` | 是否启用交互功能 |
| `interactive.clickMessages` | `string[]` | 见源文件 | 点击时随机显示的文字消息 |
| `interactive.messageDisplayTime` | `number` | `3000` | 文字显示时间（毫秒） |

::: tip
- 模型文件需要放在 `public/pio/models/` 目录下
- Live2D 的 motions 和 expressions 会从模型 JSON 文件中自动读取
- Spine 和 Live2D 不要同时启用，建议只启用一个
- 移动端建议设置 `hideOnMobile: true` 以节省性能
:::
