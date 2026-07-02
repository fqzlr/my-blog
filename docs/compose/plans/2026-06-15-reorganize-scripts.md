# Scripts 目录重组 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `scripts/` 目录重组为按功能分组的子目录结构，每个功能脚本独立一个文件夹。

**Target Structure:**
```
scripts/
├── cli.js                              # 统一入口（保留在根目录）
├── README.md                           # 文档
├── new-post/
│   └── index.js
├── generate-icons/
│   └── index.js
├── sync/
│   ├── index.js
│   ├── config.js
│   ├── config.example.js
│   ├── sync.ps1
│   ├── sync.sh
│   └── 同步笔记.bat
├── fetch-media/
│   ├── index.py
│   └── img-anime/                      # 保留原内容
├── fetch-music/
│   ├── fetch-lrc.py
│   ├── extract-lrc.py
│   ├── downloads/                      # 保留原内容
│   ├── api1.txt
│   └── api2.txt
├── fill-descriptions/
│   └── index.ts
└── zcyyy/                              # 保持原样
```

---

### Task 1: 创建 new-post 子目录

**Files:**
- Move: `scripts/new-post.js` → `scripts/new-post/index.js`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir scripts/new-post
git mv scripts/new-post.js scripts/new-post/index.js
```

- [ ] **Step 2: 更新 package.json 脚本路径**

修改 `package.json` 中 `"new-post"` 脚本：
```json
"new-post": "node scripts/new-post/index.js",
```

- [ ] **Step 3: 更新 cli.js 中的路径引用**

修改 `scripts/cli.js` 中 `new` 命令的 `run` 函数：
```js
run: (args) => spawn("node", [resolve(__dirname, "new-post", "index.js"), ...args], { stdio: "inherit" }),
```

---

### Task 2: 创建 generate-icons 子目录

**Files:**
- Move: `scripts/generate-icons.js` → `scripts/generate-icons/index.js`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir scripts/generate-icons
git mv scripts/generate-icons.js scripts/generate-icons/index.js
```

- [ ] **Step 2: 更新 package.json 脚本路径**

修改 `package.json` 中 `"icons"` 和 `"build"` 脚本：
```json
"icons": "node scripts/generate-icons/index.js",
"build": "node scripts/generate-icons/index.js && astro build && pagefind --site dist",
```

- [ ] **Step 3: 更新 cli.js 中的路径引用**

cli.js 的 `build` 命令直接调用 `pnpm build`，不需要修改。但需要确认 `generate-icons/index.js` 内部的相对路径仍然正确（`__dirname` 指向 `scripts/generate-icons/`，需要向上一级找到项目根目录）。

修改 `scripts/generate-icons/index.js` 中的 `ROOT_DIR`：
```js
const ROOT_DIR = join(__dirname, "..", "..");
```

---

### Task 3: 创建 sync 子目录

**Files:**
- Move: `scripts/sync.js` → `scripts/sync/index.js`
- Move: `scripts/sync.config.js` → `scripts/sync/config.js`
- Move: `scripts/sync.config.example.js` → `scripts/sync/config.example.js`
- Move: `scripts/sync.ps1` → `scripts/sync/sync.ps1`
- Move: `scripts/sync.sh` → `scripts/sync/sync.sh`
- Move: `scripts/同步笔记.bat` → `scripts/sync/同步笔记.bat`

- [ ] **Step 1: 创建目录并移动所有同步相关文件**

```bash
mkdir scripts/sync
git mv scripts/sync.js scripts/sync/index.js
git mv scripts/sync.config.js scripts/sync/config.js
git mv scripts/sync.config.example.js scripts/sync/config.example.js
git mv scripts/sync.ps1 scripts/sync/sync.ps1
git mv scripts/sync.sh scripts/sync/sync.sh
git mv "scripts/同步笔记.bat" "scripts/sync/同步笔记.bat"
```

- [ ] **Step 2: 更新 sync/index.js 中的 config 导入路径**

修改 `scripts/sync/index.js` 第 16 行：
```js
import config from './config.js';
```

- [ ] **Step 3: 更新 sync/config.js 中的路径引用**

修改 `scripts/sync/config.js` 中的 `__dirname` 和 `projectContentPath`：
```js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// projectContentPath 需要向上两级到 scripts/ 再到项目根目录
projectContentPath: path.resolve(__dirname, '../../src/content'),
```

- [ ] **Step 4: 更新 sync/config.example.js 中的路径引用**

同上，修改 `projectContentPath`：
```js
projectContentPath: path.resolve(__dirname, '../../src/content'),
```

- [ ] **Step 5: 更新 sync/sync.ps1 中的脚本路径**

```powershell
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir
node index.js
```

- [ ] **Step 6: 更新 sync/sync.sh 中的脚本路径**

```bash
cd "$(dirname "$0")"
node index.js
```

- [ ] **Step 7: 更新 sync/同步笔记.bat 中的脚本路径**

```bat
cd /d "%~dp0"
node index.js
```

- [ ] **Step 8: 更新 package.json 脚本路径**

```json
"sync": "node scripts/sync/index.js",
```

- [ ] **Step 9: 更新 cli.js 中的路径引用**

修改 `scripts/cli.js` 中 `sync` 命令：
```js
run: (args) => spawn("node", [resolve(__dirname, "sync", "index.js"), ...args], { stdio: "inherit" }),
```

- [ ] **Step 10: 删除项目根目录的同步笔记快捷方式**

```bash
rm "scripts/同步笔记.bat - 快捷方式.lnk"
```

---

### Task 4: 创建 fetch-media 子目录

**Files:**
- Move: `scripts/fetch-media.py` → `scripts/fetch-media/index.py`
- Move: `scripts/img-anime/` → `scripts/fetch-media/img-anime/`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir scripts/fetch-media
git mv scripts/fetch-media.py scripts/fetch-media/index.py
git mv scripts/img-anime scripts/fetch-media/img-anime
```

- [ ] **Step 2: 更新 fetch-media/index.py 中的路径常量**

修改 `scripts/fetch-media/index.py` 中的路径定义：
```python
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
BLOG_BANGUMI_DIR = os.path.join(BASE_DIR, "src", "content", "bangumi", "anime")
COVER_DIR = os.path.join(os.path.dirname(__file__), "img-anime")
```

- [ ] **Step 3: 更新 cli.js 中的路径引用**

修改 `scripts/cli.js` 中 `media` 命令：
```js
run: (args) => spawn("python", [resolve(__dirname, "fetch-media", "index.py"), ...args], { stdio: "inherit" }),
```

---

### Task 5: 创建 fetch-music 子目录

**Files:**
- Move: `scripts/fetch-lrc.py` → `scripts/fetch-music/fetch-lrc.py`
- Move: `scripts/extract-lrc.py` → `scripts/fetch-music/extract-lrc.py`
- Move: `scripts/downloads/` → `scripts/fetch-music/downloads/`
- Move: `scripts/api1.txt` → `scripts/fetch-music/api1.txt`
- Move: `scripts/api2.txt` → `scripts/fetch-music/api2.txt`

- [ ] **Step 1: 创建目录并移动所有音乐相关文件**

```bash
mkdir scripts/fetch-music
git mv scripts/fetch-lrc.py scripts/fetch-music/fetch-lrc.py
git mv scripts/extract-lrc.py scripts/fetch-music/extract-lrc.py
git mv scripts/downloads scripts/fetch-music/downloads
git mv scripts/api1.txt scripts/fetch-music/api1.txt
git mv scripts/api2.txt scripts/fetch-music/api2.txt
```

- [ ] **Step 2: 更新 fetch-music/fetch-lrc.py 中的路径常量**

修改 `scripts/fetch-music/fetch-lrc.py` 中的路径定义：
```python
BLOG_CONTENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "src", "content", "bangumi", "music"))
DEFAULT_OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "downloads"))
```

- [ ] **Step 3: 更新 cli.js 中的路径引用**

修改 `scripts/cli.js` 中 `music` 命令：
```js
run: (args) => spawn("python", [resolve(__dirname, "fetch-music", "fetch-lrc.py"), ...args], { stdio: "inherit" }),
```

修改 `lrc` 命令：
```js
run: (args) => spawn("python", [resolve(__dirname, "fetch-music", "extract-lrc.py"), ...args], { stdio: "inherit" }),
```

---

### Task 6: 创建 fill-descriptions 子目录

**Files:**
- Move: `scripts/fill-descriptions.ts` → `scripts/fill-descriptions/index.ts`

- [ ] **Step 1: 创建目录并移动文件**

```bash
mkdir scripts/fill-descriptions
git mv scripts/fill-descriptions.ts scripts/fill-descriptions/index.ts
```

- [ ] **Step 2: 更新 fill-descriptions/index.ts 中的路径常量**

修改 `scripts/fill-descriptions/index.ts` 中的 `POSTS_DIR`：
```ts
const POSTS_DIR = path.resolve(__dirname, "..", "..", "src", "content", "posts");
```

- [ ] **Step 3: 更新 cli.js 中的路径引用**

修改 `scripts/cli.js` 中 `desc` 命令：
```js
run: () => spawn("npx", ["tsx", resolve(__dirname, "fill-descriptions", "index.ts")], { stdio: "inherit" }),
```

---

### Task 7: 更新文档和 .gitignore

**Files:**
- Modify: `scripts/README.md`
- Modify: `.gitignore`

- [ ] **Step 1: 更新 README.md 文档**

更新 `scripts/README.md` 中的所有脚本路径引用，反映新的目录结构。

- [ ] **Step 2: 更新 .gitignore 路径**

修改 `.gitignore` 第 42 行：
```
scripts/fill-descriptions/index.ts
```

---

### Task 8: 验证所有路径正确

- [ ] **Step 1: 运行 `pnpm cli` 确认交互菜单正常显示**

```bash
pnpm cli
```
预期：菜单正常显示所有命令，无报错。

- [ ] **Step 2: 运行 `pnpm build` 确认构建正常**

```bash
pnpm build
```
预期：generate-icons 正常执行，Astro 构建成功。

- [ ] **Step 3: 运行 `pnpm lint` 确认代码规范**

```bash
pnpm lint
```
预期：无新增 lint 错误。

- [ ] **Step 4: 检查最终目录结构**

```bash
ls -R scripts/
```
预期：所有文件在正确位置，旧位置无残留文件。
