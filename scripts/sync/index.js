#!/usr/bin/env node

/**
 * Obsidian 笔记同步脚本
 * 将 Obsidian 笔记同步到 Astro 博客项目的 content 文件夹
 *
 * 支持增量同步策略：
 * - skip: 跳过已存在的文件（默认）
 * - incremental: 仅当源文件较新时更新
 * - force: 强制覆盖所有文件
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import config from './config.js';

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// 检查是否支持颜色
const supportsColor = process.stdout.isTTY && !process.env.NO_COLOR;

// 彩色日志函数
const log = {
  info: (msg) => supportsColor ? console.log(`${colors.blue}ℹ${colors.reset} ${msg}`) : console.log(`[INFO] ${msg}`),
  success: (msg) => supportsColor ? console.log(`${colors.green}✓${colors.reset} ${msg}`) : console.log(`[OK] ${msg}`),
  warn: (msg) => supportsColor ? console.log(`${colors.yellow}⚠${colors.reset} ${msg}`) : console.log(`[WARN] ${msg}`),
  error: (msg) => supportsColor ? console.error(`${colors.red}✗${colors.reset} ${msg}`) : console.error(`[ERROR] ${msg}`),
  header: (msg) => supportsColor ? console.log(`\n${colors.cyan}${colors.bright}${msg}${colors.reset}`) : console.log(`\n${msg}`),
  dim: (msg) => supportsColor ? console.log(`${colors.dim}${msg}${colors.reset}`) : console.log(msg),
};

// 命令行参数解析
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    strategy: config.syncStrategy || 'skip',
    types: [],
    help: false,
    quiet: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--strategy' || arg === '-s') {
      const strategy = args[++i];
      if (['skip', 'incremental', 'force'].includes(strategy)) {
        result.strategy = strategy;
      } else {
        log.warn(`未知同步策略: ${strategy}，使用默认: skip`);
      }
    } else if (arg === '--type' || arg === '-t') {
      result.types.push(args[++i]);
    } else if (arg === '--all' || arg === '-a') {
      result.types = ['文章', '动态', '记录', '生活', '相册', '弹幕', '导航', '友链', '资源'];
    } else if (arg === '--force' || arg === '-f') {
      result.strategy = 'force';
    } else if (arg === '--help' || arg === '-h') {
      result.help = true;
    } else if (arg === '--quiet' || arg === '-q') {
      result.quiet = true;
    }
  }

  return result;
}

// 打印帮助信息
function printHelp() {
  console.log(`
${colors.bright}🚀 Obsidian 笔记同步工具${colors.reset}

${colors.bright}用法:${colors.reset} node sync.js [选项]

${colors.bright}选项:${colors.reset}
  -s, --strategy <策略>    同步策略: skip(默认) | incremental | force
  -t, --type <类型>       指定同步类型: 文章 | 动态 | 记录 | 生活 | 相册 | 弹幕 | 导航 | 友链 | 资源
  -a, --all               同步全部类型
  -f, --force             强制覆盖所有文件
  -q, --quiet             静默模式，仅显示汇总
  -h, --help              显示帮助信息

${colors.bright}同步策略说明:${colors.reset}
  skip         - 跳过已存在的文件（默认行为）
  incremental  - 仅当源文件较新时更新目标文件
  force        - 强制覆盖所有文件

${colors.bright}示例:${colors.reset}
  node sync.js                                    # 交互模式
  node sync.js --strategy incremental             # 增量同步
  node sync.js --type 文章                        # 仅同步文章
  node sync.js --type 相册                        # 仅同步相册
  node sync.js --all --strategy force            # 强制同步全部
  node sync.js -t 文章 -t 动态 -s incremental     # 增量同步文章和动态
  node sync.js -t 导航                            # 仅同步导航网站
  node sync.js -t 友链                           # 仅同步友链
  node sync.js -t 资源                           # 仅同步资源
  node sync.js -a -q                             # 静默同步全部
`);
}

// 工具函数：解析 frontmatter
function parseFrontmatter(content) {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    try {
      const frontmatter = {};
      const lines = match[1].split('\n');
      let currentKey = null;
      let arrayValues = [];

      for (const line of lines) {
        // 检查是否是数组项
        if (line.match(/^\s+-\s+/)) {
          if (currentKey && arrayValues.length > 0) {
            frontmatter[currentKey] = arrayValues;
          }
          arrayValues.push(line.replace(/^\s+-\s+/, '').trim());
          continue;
        }

        // 保存上一个数组
        if (currentKey && arrayValues.length > 0 && !line.match(/^\s/)) {
          frontmatter[currentKey] = arrayValues;
          arrayValues = [];
        }

        // 解析键值对
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          currentKey = line.substring(0, colonIndex).trim();
          let value = line.substring(colonIndex + 1).trim();

          if (value === '') {
            // 空值，等待数组或下一个键
            continue;
          } else if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          }

          frontmatter[currentKey] = value;
          currentKey = null;
        }
      }

      // 处理最后一个数组
      if (currentKey && arrayValues.length > 0) {
        frontmatter[currentKey] = arrayValues;
      }

      return {
        frontmatter,
        content: match[2] || '',
      };
    } catch (e) {
      log.warn(`frontmatter 解析失败: ${e.message}`);
    }
  }

  return { frontmatter: {}, content };
}

// 工具函数：生成文件名
function generateFileName(frontmatter, originalName, mapping) {
  if (mapping.datePrefix && mapping.dateField && frontmatter[mapping.dateField]) {
    const date = frontmatter[mapping.dateField];
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);

    if (!/^\d{4}-\d{2}-\d{2}/.test(baseName)) {
      return `${date}${ext}`;
    }
  }

  return originalName;
}

// 工具函数：复制文件
async function copyFile(src, dest, options = {}) {
  const { strategy = 'skip' } = options;

  return new Promise((resolve, reject) => {
    const destDir = path.dirname(dest);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    if (fs.existsSync(dest)) {
      const srcStat = fs.statSync(src);
      const destStat = fs.statSync(dest);

      switch (strategy) {
        case 'skip':
          resolve({ action: 'skip', reason: '文件已存在' });
          return;
        case 'incremental':
          if (srcStat.mtime.getTime() <= destStat.mtime.getTime()) {
            resolve({ action: 'skip', reason: '目标文件较新' });
            return;
          }
          break;
        case 'force':
          break;
      }
    }

    fs.copyFile(src, dest, (err) => {
      if (err) reject(err);
      else resolve({ action: fs.existsSync(dest) && strategy === 'incremental' ? 'update' : 'copy' });
    });
  });
}

// 工具函数：获取文件修改时间
function getFileModTime(filePath) {
  try {
    return fs.statSync(filePath).mtime.getTime();
  } catch {
    return 0;
  }
}

// 工具函数：递归复制文件夹
async function copyDirectory(src, dest, options = {}) {
  const { strategy = 'skip' } = options;
  let count = 0;

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      count += await copyDirectory(srcPath, destPath, options);
    } else {
      const result = await copyFile(srcPath, destPath, { strategy });
      if (result.action !== 'skip') count++;
    }
  }

  return count;
}

// 格式化路径（缩短显示）
function shortenPath(fullPath, basePath) {
  const relative = path.relative(basePath, fullPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    // 相对路径太长时截断
    if (fullPath.length > 50) {
      return '...' + fullPath.slice(-47);
    }
    return fullPath;
  }
  return relative;
}

// 同步指定类型
async function syncType(mapping, strategy = 'skip', quiet = false) {
  const obsidianFolder = path.join(config.obsidianVaultPath, mapping.obsidianFolder);
  const targetFolder = path.join(config.projectContentPath, mapping.targetFolder);

  // 初始化统计
  const stats = {
    md: { copied: 0, updated: 0, skipped: 0 },
    assets: { copied: 0, updated: 0, skipped: 0 },
    other: { copied: 0, updated: 0, skipped: 0 },
    errors: 0,
  };

  // 检查源文件夹是否存在
  if (!fs.existsSync(obsidianFolder)) {
    log.warn(`跳过 ${mapping.type}: Obsidian 文件夹不存在`);
    return stats;
  }

  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  // 递归读取所有文件
  function readAllFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        if (file === '.obsidian' || file.startsWith('.') || file === 'assets') continue;
        readAllFiles(filePath, fileList);
      } else {
        fileList.push({
          path: filePath,
          relativePath: path.relative(obsidianFolder, filePath),
          name: file,
        });
      }
    }

    return fileList;
  }

  const strategyLabel = {
    'skip': '跳过已存在',
    'incremental': '增量同步',
    'force': '强制覆盖'
  };

  // 打印标题
  if (!quiet) {
    log.header('═'.repeat(60));
    log.header(`  📁 ${mapping.type}`);
    log.header('═'.repeat(60));
    log.dim(`  策略: ${strategyLabel[strategy] || strategy}  |  开始: ${new Date().toLocaleTimeString()}`);
    console.log('');
  }

  const files = readAllFiles(obsidianFolder);
  const syncedAssets = new Set();

  for (const fileInfo of files) {
    try {
      if (fileInfo.name.endsWith('.md')) {
        const content = fs.readFileSync(fileInfo.path, 'utf-8');
        const { frontmatter } = parseFrontmatter(content);

        const newFileName = generateFileName(frontmatter, fileInfo.name, mapping);
        const relativeDir = path.dirname(fileInfo.relativePath);
        const targetDir = path.join(targetFolder, relativeDir);
        const targetPath = path.join(targetDir, newFileName);

        const result = await copyFile(fileInfo.path, targetPath, { strategy });

        if (result.action === 'skip') {
          stats.md.skipped++;
          if (config.verbose && !quiet) {
            log.dim(`  ⏭  ${fileInfo.relativePath}`);
          }
        } else if (result.action === 'update') {
          stats.md.updated++;
          if (!quiet) log.success(`${fileInfo.relativePath} → ${newFileName}`);
        } else {
          stats.md.copied++;
          if (!quiet) log.success(`+ ${fileInfo.relativePath} → ${newFileName}`);
        }

        // 同步 assets 文件夹
        const noteDir = path.dirname(fileInfo.path);
        const assetsDir = path.join(noteDir, 'assets');

        if (fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory() && !syncedAssets.has(assetsDir)) {
          syncedAssets.add(assetsDir);
          const assetsTargetDir = path.join(targetFolder, relativeDir, 'assets');
          const copiedAssets = await copyDirectory(assetsDir, assetsTargetDir, { strategy });

          if (copiedAssets > 0) {
            stats.assets.copied += copiedAssets;
            if (!quiet) log.dim(`  📦 资源 ${path.relative(obsidianFolder, assetsDir)}/ (${copiedAssets} 个文件)`);
          }
        }
      } else {
        const relativeDir = path.dirname(fileInfo.relativePath);
        const targetDir = path.join(targetFolder, relativeDir);
        const targetPath = path.join(targetDir, fileInfo.name);

        const result = await copyFile(fileInfo.path, targetPath, { strategy });

        if (result.action === 'skip') {
          stats.other.skipped++;
        } else if (result.action === 'update') {
          stats.other.updated++;
          if (!quiet) log.success(`${fileInfo.relativePath}`);
        } else {
          stats.other.copied++;
          if (!quiet) log.success(`+ ${fileInfo.relativePath}`);
        }
      }
    } catch (err) {
      stats.errors++;
      log.error(`${fileInfo.relativePath}: ${err.message}`);
    }
  }

  // 打印统计
  if (!quiet) {
    const totalCopied = stats.md.copied + stats.assets.copied + stats.other.copied;
    const totalUpdated = stats.md.updated + stats.assets.updated + stats.other.updated;
    const totalSkipped = stats.md.skipped + stats.assets.skipped + stats.other.skipped;

    console.log('');
    log.header('─'.repeat(60));
    log.dim(`  📊 ${mapping.type} 统计`);

    if (stats.errors > 0) {
      log.error(`  ❌ 错误: ${stats.errors} 个`);
    }

    const summary = [];
    if (totalCopied > 0) summary.push(`${colors.green}+${totalCopied} 新增${colors.reset}`);
    if (totalUpdated > 0) summary.push(`${colors.cyan}↻ ${totalUpdated} 更新${colors.reset}`);
    if (totalSkipped > 0) summary.push(`${colors.dim}⏭ ${totalSkipped} 跳过${colors.reset}`);

    console.log(`  ${summary.join('  ')}`);
    log.header('─'.repeat(60));
  }

  return stats;
}

// 全局统计
let globalStats = {
  types: 0,
  totalCopied: 0,
  totalUpdated: 0,
  totalSkipped: 0,
  totalErrors: 0,
};

// 主函数
async function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    process.exit(0);
  }

  const { strategy: defaultStrategy, types, quiet } = args;

  // 打印标题
  log.header('═'.repeat(60));
  log.header(`  🚀 Obsidian 笔记同步工具`);
  log.header('═'.repeat(60));
  console.log('');

  // 验证配置
  if (!fs.existsSync(config.obsidianVaultPath)) {
    log.error(`Obsidian vault 路径不存在: ${config.obsidianVaultPath}`);
    log.error('请编辑 sync.config.js 修改配置');
    process.exit(1);
  }

  if (!fs.existsSync(config.projectContentPath)) {
    log.error(`项目 content 路径不存在: ${config.projectContentPath}`);
    process.exit(1);
  }

  log.dim(`  📂 笔记库: ${shortenPath(config.obsidianVaultPath, process.cwd())}`);
  log.dim(`  📂 目标目录: ${shortenPath(config.projectContentPath, process.cwd())}`);
  console.log('');

  // 如果指定了类型，直接执行
  if (types.length > 0) {
    const strategyLabel = {
      'skip': '跳过已存在',
      'incremental': '增量同步',
      'force': '强制覆盖'
    };

    if (!quiet) {
      log.header(`  📋 策略: ${strategyLabel[defaultStrategy]}`);
      log.header(`  🎯 类型: ${types.join(', ')}`);
      console.log('');
      log.header('  🔄 开始同步...\n');
    }

    const startTime = Date.now();
    let typeIndex = 0;

    for (const type of types) {
      typeIndex++;
      const mapping = config.mappings.find(m => m.type === type);
      if (mapping) {
        const stats = await syncType(mapping, defaultStrategy, quiet);

        globalStats.totalCopied += stats.md.copied + stats.assets.copied + stats.other.copied;
        globalStats.totalUpdated += stats.md.updated + stats.assets.updated + stats.other.updated;
        globalStats.totalSkipped += stats.md.skipped + stats.assets.skipped + stats.other.skipped;
        globalStats.totalErrors += stats.errors;
        globalStats.types++;
      } else {
        log.warn(`未找到配置: ${type}`);
      }
    }

    // 打印全局汇总
    if (!quiet || globalStats.totalErrors > 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log('');
      log.header('═'.repeat(60));
      log.header(`  ✅ 同步完成 (${elapsed}s)`);
      log.header('═'.repeat(60));

      const summary = [];
      if (globalStats.totalCopied > 0) summary.push(`${colors.green}+${globalStats.totalCopied} 新增${colors.reset}`);
      if (globalStats.totalUpdated > 0) summary.push(`${colors.cyan}↻ ${globalStats.totalUpdated} 更新${colors.reset}`);
      if (globalStats.totalSkipped > 0) summary.push(`${colors.dim}⏭ ${globalStats.totalSkipped} 跳过${colors.reset}`);
      if (globalStats.totalErrors > 0) summary.push(`${colors.red}❌ ${globalStats.totalErrors} 错误${colors.reset}`);

      console.log('');
      console.log(`  📊 总计: ${summary.join('  ')}`);
      console.log('');
    }

    process.exit(globalStats.totalErrors > 0 ? 1 : 0);
  }

  // 交互模式
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const strategyOptions = [
    { id: 1, value: 'skip', name: '跳过已存在', desc: '只复制新文件' },
    { id: 2, value: 'incremental', name: '增量同步', desc: '源文件较新时才更新' },
    { id: 3, value: 'force', name: '强制覆盖', desc: '覆盖所有文件' },
  ];

  const typeOptions = [
    { id: 1, name: '同步文章', mappings: ['文章'] },
    { id: 2, name: '同步动态', mappings: ['动态'] },
    { id: 3, name: '同步记录', mappings: ['记录'] },
    { id: 4, name: '同步生活', mappings: ['生活'] },
    { id: 5, name: '同步相册', mappings: ['相册'] },
    { id: 6, name: '同步弹幕', mappings: ['弹幕'] },
    { id: 7, name: '同步导航', mappings: ['导航'] },
    { id: 8, name: '同步友链', mappings: ['友链'] },
    { id: 9, name: '同步资源', mappings: ['资源'] },
    { id: 10, name: '同步全部', mappings: null },
    { id: 11, name: '退出', type: 'exit' },
  ];

  let currentStrategy = defaultStrategy;

  async function selectStrategy() {
    console.log('请选择同步策略:\n');
    strategyOptions.forEach(opt => {
      console.log(`  ${opt.id}. ${opt.name}  - ${opt.desc}`);
    });
    console.log('');

    const choice = await askQuestion('请输入选项 (1-3): ', rl);
    const selected = strategyOptions.find(opt => opt.id === parseInt(choice));

    if (selected) {
      currentStrategy = selected.value;
      log.success(`已选择策略: ${selected.name}`);
      return true;
    } else {
      log.error('无效选项，请重新输入');
      return false;
    }
  }

  async function selectType() {
    const strategyLabel = {
      'skip': '跳过已存在',
      'incremental': '增量同步',
      'force': '强制覆盖'
    };

    console.log('\n' + '─'.repeat(60));
    console.log(`📋 当前策略: ${strategyLabel[currentStrategy] || currentStrategy}`);
    console.log('\n请选择要同步的内容类型:\n');
    typeOptions.forEach(opt => {
      console.log(`  ${opt.id}. ${opt.name}`);
    });
    console.log('');

    const choice = await askQuestion('请输入选项 (1-11): ', rl);
    const selected = typeOptions.find(opt => opt.id === parseInt(choice));

    if (!selected) {
      log.error('无效选项，请重新输入');
      return { continue: true };
    }

    if (selected.type === 'exit') {
      console.log('\n👋 再见!');
      rl.close();
      process.exit(0);
    }

    const startTime = Date.now();

    if (selected.id === 10) {
      // 同步全部
      console.log('\n🔄 开始同步所有内容...\n');
      for (const mapping of config.mappings) {
        const stats = await syncType(mapping, currentStrategy, false);
        globalStats.totalCopied += stats.md.copied + stats.assets.copied + stats.other.copied;
        globalStats.totalUpdated += stats.md.updated + stats.assets.updated + stats.other.updated;
        globalStats.totalSkipped += stats.md.skipped + stats.assets.skipped + stats.other.skipped;
        globalStats.totalErrors += stats.errors;
        globalStats.types++;
      }
    } else if (selected.mappings) {
      const mapping = config.mappings.find(m => m.type === selected.mappings[0]);
      if (mapping) {
        const stats = await syncType(mapping, currentStrategy, false);
        globalStats.totalCopied += stats.md.copied + stats.assets.copied + stats.other.copied;
        globalStats.totalUpdated += stats.md.updated + stats.assets.updated + stats.other.updated;
        globalStats.totalSkipped += stats.md.skipped + stats.assets.skipped + stats.other.skipped;
        globalStats.totalErrors += stats.errors;
        globalStats.types++;
      } else {
        log.warn(`未找到配置: ${selected.mappings[0]}`);
      }
    }

    // 打印全局汇总
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '─'.repeat(60));
    log.info(`本次同步耗时: ${elapsed}s`);

    const summary = [];
    if (globalStats.totalCopied > 0) summary.push(`${colors.green}+${globalStats.totalCopied} 新增${colors.reset}`);
    if (globalStats.totalUpdated > 0) summary.push(`${colors.cyan}↻ ${globalStats.totalUpdated} 更新${colors.reset}`);
    if (globalStats.totalErrors > 0) summary.push(`${colors.red}❌ ${globalStats.totalErrors} 错误${colors.reset}`);

    if (summary.length > 0) {
      console.log(`📊 本次: ${summary.join('  ')}`);
    }

    return { continue: true };
  }

  // 主循环
  while (true) {
    const strategySelected = await selectStrategy();
    if (!strategySelected) continue;

    while (true) {
      const result = await selectType();

      if (!result.continue) break;

      await new Promise((resolve) => {
        rl.question('\n按回车键继续...', resolve);
      });
    }
  }
}

// 辅助函数
function askQuestion(question, rl) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// 错误处理
process.on('unhandledRejection', (err) => {
  log.error(`发生未处理的错误: ${err.message}`);
  process.exit(1);
});

// 启动
main().catch((err) => {
  log.error(`启动失败: ${err.message}`);
  process.exit(1);
});
