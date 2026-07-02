# Meting-API 部署与博客接入指南

> 适用博客：Astro + Firefly 主题（dumplingandcakeblog）
> 自建 API 地址：`https://mu.tsh520.cn`
> 服务器：腾讯云 119.45.92.169，Docker 部署

---

## 一、API 端可用性验证

部署完成后，用浏览器直接打开以下链接确认有 JSON 返回：

```
https://mu.tsh520.cn/api?server=netease&type=search&id=hello
```

### API 参数说明

| 参数 | 可选值 | 示例 |
|------|--------|------|
| `server` | `netease` / `tencent` / `kugou` / `baidu` / `kuwo` | `netease` |
| `type` | `search` / `song` / `album` / `artist` / `playlist` / `lrc` / `url` / `pic` | `playlist` |
| `id` | 对应类型的 ID 或关键词 | `7455413086` |

返回格式（以 `type=song` 为例）：
```json
[
  {
    "title": "歌曲名",
    "author": "歌手名",
    "url": "https://mu.tsh520.cn/api?server=netease&type=url&id=xxx&auth=xxx",
    "pic": "https://mu.tsh520.cn/api?server=netease&type=pic&id=xxx&auth=xxx",
    "lrc": "https://mu.tsh520.cn/api?server=netease&type=lrc&id=xxx&auth=xxx"
  }
]
```

---

## 二、博客音乐系统架构

Firefly 主题的音乐系统由以下**4 个核心文件**组成：

```
src/
├── config/
│   └── musicConfig.ts          ← 核心配置文件（改这个为主）
├── components/
│   ├── features/
│   │   ├── MusicManager.astro  ← 单例音频管理器（播放、API拉取、歌词解析）
│   │   └── MusicPlayer.astro   ← 侧边栏 / 导航栏弹出播放器的 UI
│   └── widget/
│       └── Music.astro         ← 侧边栏音乐小组件（Widget 包装器）
├── pages/
│   └── music/
│       └── index.astro         ← /music 独立音乐页面（唱片机 + 收藏架）
└── components/layout/
    └── Navbar.astro            ← 导航栏音乐按钮 + 弹出播放器
```

### 数据流

```
musicConfig.ts ──→ MusicManager.astro ──→ window.__fireflyMusic ──→ MusicPlayer.astro
                         │                      │
                         │              本地模式: 直接加载本地文件
                         │              Meting模式: fetch API 获取数据
                         ↓
              /music 页面（独立播放器 + 收藏展示）
```

### 音乐播放器出现位置

| 位置 | 控制方式 |
|------|----------|
| **侧边栏** | [sidebarConfig.ts](src/config/sidebarConfig.ts) 中 `type: "music"` enable/disable |
| **导航栏弹出** | [musicConfig.ts](src/config/musicConfig.ts) 中 `showInNavbar: true/false` |
| **/music 独立页面** | [siteConfig.ts](src/config/siteConfig.ts) 中 `pages.musicPage: true/false` |

---

## 三、具体改造步骤

### 步骤 1：修改核心音乐配置 `musicConfig.ts`

文件路径：`src/config/musicConfig.ts`

#### 方案 A：用 Meting API 播放指定歌单（推荐）

将配置改为使用你的自建 API 拉取网易云歌单：

```ts
import type { MusicPlayerConfig } from "../types/config";

export const musicPlayerConfig: MusicPlayerConfig = {
    showInNavbar: true,

    // 改为 "meting" 模式
    mode: "meting",

    volume: 0.7,
    playMode: "list",
    showLyrics: true,

    meting: {
        // ★ 改这里：指向你的自建 API
        api: "https://mu.tsh520.cn/api?server=:server&type=:type&id=:id",

        // 音乐平台
        server: "netease",

        // 类型：song / playlist / album / search / artist
        type: "playlist",

        // 歌单 ID（在网易云音乐网页版 URL 里找，如 playlist?id=7455413086）
        id: "7455413086",

        auth: "",

        // 备用 API
        fallbackApis: [
            "https://mu.tsh520.cn/api?server=:server&type=:type&id=:id",
        ],
    },

    // local 配置保留不删，随时可以切回 mode: "local"
    local: {
        playlist: [
            // ... 保留你原来的本地音乐
        ],
    },
};
```

> **如何获取网易云音乐歌单 ID？**
> 在浏览器打开网易云音乐网页版 → 进入歌单 → URL 里的 `id=` 后面的数字就是。例如 `music.163.com/#/playlist?id=7455413086` → id 为 `7455413086`

#### 方案 B：保留本地模式，只把 `/music` 页面接入 API

不变 `musicConfig.ts`（继续用 `mode: "local"`），只改 `/music` 页面（见步骤 3）。

---

### 步骤 2：修改侧边栏配置（可选）

侧边栏的音乐组件已启用，无需改动。如果想关闭侧边栏音乐组件，改 [sidebarConfig.ts](src/config/sidebarConfig.ts) 中 `type: "music"` 的 `enable: false` 即可。

---

### 步骤 3：修改 `/music` 音乐页面

文件路径：`src/pages/music/index.astro`

这个页面有两处硬编码的 API 地址需要改为你的自建地址。

#### 第 1 处：define:vars 中的 metingApiUrl（约第 673 行）

原代码：
```astro
<script is:inline define:vars={{ collectionPlaylistJson: JSON.stringify(collectionPlaylist), metingApiUrl: "https://meting.elysium-stack.cn/api" }}>
```

改为：
```astro
<script is:inline define:vars={{ collectionPlaylistJson: JSON.stringify(collectionPlaylist), metingApiUrl: "https://mu.tsh520.cn/api" }}>
```

> 这个变量传递给页面内 JavaScript 的 `metingApi` 变量，用于按需解析音乐内容集合中标注了 `metingServer` 和 `metingId` 的歌曲。

#### 第 2 处：更优雅的做法（推荐）

直接引用 `musicConfig` 中的 `api` 值，避免硬编码。找到约第 673 行：

```astro
---
// 在 Astro 模板顶部（frontmatter 中）添加导入和读取：
import { musicPlayerConfig } from "@/config/musicConfig";

const metingApiBase = musicPlayerConfig.meting?.api
    ? musicPlayerConfig.meting.api.split("?")[0]  // 提取 "https://mu.tsh520.cn/api"
    : "https://mu.tsh520.cn/api";
---
```

然后在 define:vars 中使用变量：
```astro
<script is:inline define:vars={{ collectionPlaylistJson: JSON.stringify(collectionPlaylist), metingApiUrl: metingApiBase }}>
```

---

### 步骤 4：改造内容收藏中的歌曲为 Meting 模式

`/music` 页面从 `src/content/bangumi/music/*.md` 加载歌曲。有两种使用方式：

#### 方式 A：直接用本地音频（当前做法）

无需修改，保持现有格式：
```yaml
---
title: 知我
category: music
status: 2
image: https://re.0824.uk/zl/tx.webp
artist: 国风堂
audioUrl: https://re.tsh520.cn/music/知我.mp3
lrcUrl: https://re.tsh520.cn/music/知我.lrc
score: 8
published: 2026-01-01
---
```

#### 方式 B：通过 Meting API 动态获取（新增歌曲推荐）

添加 `metingServer` 和 `metingId` 字段，不填 `audioUrl`：

```yaml
---
title: 晴天
category: music
status: 2
image: https://p1.music.126.net/xxx.jpg
artist: 周杰伦
metingServer: netease
metingId: "1868553880"
score: 10
published: 2026-01-01
---
```

> 页面脚本会检测到有 `metingId` 但没有 `audioUrl` 时，自动调用 Meting API 获取真实播放链接。这也是为什么步骤 3 中要改 `metingApiUrl` 的原因。

---

## 四、各场景 API 调用一览

| 场景 | 调用方 | API URL 来源 |
|------|--------|-------------|
| 侧边栏/Navbar 小播放器（meting 模式） | MusicManager.astro → fetchMetingData() | `musicConfig.ts` → `meting.api` |
| /music 页面 - 收藏卡点击播放 | index.astro → resolveMetingTracks() | 页面 `metingApiUrl` 变量（步骤 3 修改处） |
| /music 页面 - 卡片的 onClick 处理 | index.astro → card click handler | 页面 `metingApi` 变量 |

---

## 五、Docker 容器运维

### 日常命令

```bash
# 查看容器状态
docker ps | grep meting-api

# 查看日志
docker logs meting-api --tail 50

# 重启容器
docker restart meting-api

# 停止并删除
docker stop meting-api && docker rm meting-api
```

### 更新代码后重新部署

```bash
cd /www/wwwroot/meting-api
git pull
docker build -t meting-api .
docker stop meting-api && docker rm meting-api
docker run -d --name meting-api --restart=always -p 3000:80 -e METING_URL=https://mu.tsh520.cn -e METING_TOKEN=abc123 meting-api
```

### 如果需要 Cookie（VIP 歌曲）

部分歌曲需要登录态才能获取播放链接。在服务器上：

```bash
# 创建 cookie 目录
mkdir -p /www/wwwroot/meting-api/cookie

# 将网易云 cookie 写入文件（从浏览器开发者工具中复制）
echo "你的cookie字符串" > /www/wwwroot/meting-api/cookie/netease

# 重新运行容器并挂载 cookie 目录
docker stop meting-api && docker rm meting-api
docker run -d --name meting-api --restart=always -p 3000:80 \
  -e METING_URL=https://mu.tsh520.cn \
  -e METING_TOKEN=abc123 \
  -v /www/wwwroot/meting-api/cookie:/app/cookie \
  meting-api
```

---

## 六、验证清单

- [ ] `https://mu.tsh520.cn/api?server=netease&type=search&id=hello` 返回 JSON
- [ ] `https://mu.tsh520.cn/api?server=netease&type=song&id=1868553880` 返回歌曲数据
- [ ] 修改 `musicConfig.ts` 后博客侧边栏能加载 Meting 歌单
- [ ] `/music` 页面点击 Meting 歌曲卡片能正常播放
- [ ] Navbar 音乐按钮弹出的小播放器正常工作
