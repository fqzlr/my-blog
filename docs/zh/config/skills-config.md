# 技能图标配置详解

技能图标配置文件用于设置"关于"页面展示的技能图标，包括图标选择、分组和配色。

配置文件路径：[skillsConfig.ts](file:///e:/AItool/zzwork/my-blog/src/config/skillsConfig.ts)

## 配置项说明

| 配置项 | 类型 | 说明 |
|--------|------|------|
| `items` | `Array` | 技能图标完整列表，定义每个技能的名称、图标和分组 |
| `skills` | `Array<Array<string>>` | 技能展示分组，按二维数组组织显示 |
| `colors` | `string[]` | 技能标签颜色池，循环使用 |

## 技能项配置（items）

每个技能项包含：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `name` | `string` | 是 | 技能名称 |
| `icon` | `string` | 是 | Iconify 图标名称 |
| `group` | `string` | 是 | 技能分组，如 `"Frontend"`、`"Backend"`、`"Language"` 等 |

### 常用图标参考

| 技能 | 图标名 |
|------|--------|
| Astro | `simple-icons:astro` |
| React | `simple-icons:react` |
| Vue | `simple-icons:vuedotjs` |
| Svelte | `simple-icons:svelte` |
| TypeScript | `simple-icons:typescript` |
| JavaScript | `simple-icons:javascript` |
| Python | `simple-icons:python` |
| Java | `mdi:language-java` |
| Node.js | `simple-icons:nodedotjs` |
| Tailwind CSS | `simple-icons:tailwindcss` |
| Docker | `simple-icons:docker` |
| MySQL | `simple-icons:mysql` |
| Redis | `simple-icons:redis` |
| MongoDB | `simple-icons:mongodb` |
| Git | `simple-icons:git` |
| Linux | `simple-icons:linux` |
| Nginx | `simple-icons:nginx` |

更多图标可在 [Iconify 图标库](https://icon-sets.iconify.design/) 查找。

## 技能分组（skills）

二维数组定义技能的显示分组，每个子数组为一行展示的技能：

```ts
skills: [
  ["TypeScript", "React", "Tailwind"],   // 第一行
  ["Java", "Python"],                     // 第二行
  ["Redis", "MySQL", "MongoDB", "Spring"], // 第三行
  ["Git", "Docker", "Linux", "Nginx"],    // 第四行
],
```

::: tip
`skills` 中填写的技能名称必须在 `items` 数组中存在对应定义。
:::

## 颜色配置（colors）

颜色数组定义技能标签的背景色，会循环使用：

```ts
colors: [
  "#fbbf24", // amber
  "#4ade80", // green
  "#a78bfa", // purple
  "#fb923c", // orange
  "#22d3ee", // cyan
  "#f472b6", // pink
  "#a3e635", // lime
  "#60a5fa", // blue
],
```

### 示例：添加新技能

```ts
export const skillsConfig = {
  items: [
    { name: "Astro", icon: "simple-icons:astro", group: "Frontend" },
    { name: "Rust", icon: "simple-icons:rust", group: "Language" },
    { name: "Go", icon: "simple-icons:go", group: "Language" },
    { name: "PostgreSQL", icon: "simple-icons:postgresql", group: "Storage" },
  ],
  skills: [
    ["TypeScript", "React", "Astro", "Tailwind"],
    ["Java", "Python", "Go", "Rust"],
    ["Redis", "MySQL", "PostgreSQL", "MongoDB"],
  ],
  colors: [
    "#fbbf24",
    "#4ade80",
    "#a78bfa",
  ],
};
```

::: tip
- 图标使用 Iconify 图标名格式：`集合名:图标名`
- 颜色支持 HEX、RGB、HSL 等 CSS 颜色格式
- 建议每行技能数量控制在 3-5 个，保持视觉平衡
:::
