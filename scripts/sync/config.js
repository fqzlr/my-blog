import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
  // ========================================
  // 主要配置 - 请根据你的实际情况修改
  // ========================================

  // Obsidian 笔记库路径（必须修改！）
  // Windows 示例: 'E:/Obsidian/Vault'
  // macOS/Linux 示例: '/Users/username/Obsidian/Vault'
  obsidianVaultPath: 'B:/GitHub/dumplingandcake_warehouse/网络笔记',

  // 博客项目 content 文件夹路径（通常不需要修改）
  projectContentPath: path.resolve(__dirname, '../../src/content'),

  // 是否在控制台输出详细信息
  verbose: true,

  // ========================================
  // 同步策略配置
  // ========================================
  // 可选值:
  // - 'skip': 跳过已存在的文件（默认）
  // - 'incremental': 仅当源文件较新时更新
  // - 'force': 强制覆盖所有文件
  syncStrategy: 'skip',

  // ========================================
  // 映射规则配置
  // ========================================

  mappings: [
    {
      type: '文章',
      obsidianFolder: 'posts',      // Obsidian 中存放文章的文件夹
      targetFolder: 'posts',        // 项目中对应的文件夹
      datePrefix: false,            // 是否在文件名前添加日期前缀
    },
    {
      type: '动态',
      obsidianFolder: 'moments',    // Obsidian 中存放动态的文件夹
      targetFolder: 'moments',      // 项目中对应的文件夹
      datePrefix: true,             // moments 需要日期前缀（YYYY-MM-DD）
      dateField: 'published',       // frontmatter 中的日期字段
      dateFormat: 'YYYY-MM-DD',     // 日期格式
    },
    {
      type: '记录',
      obsidianFolder: 'bangumi',    // Obsidian 中存放记录的文件夹
      targetFolder: 'bangumi',      // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '生活',
      obsidianFolder: 'life',       // Obsidian 中存放生活的文件夹
      targetFolder: 'life',         // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '相册',
      obsidianFolder: 'album',      // Obsidian 中存放相册的文件夹
      targetFolder: 'album',        // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '弹幕',
      obsidianFolder: 'danmu',     // Obsidian 中存放弹幕的文件夹
      targetFolder: 'danmu',       // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '导航',
      obsidianFolder: 'daohang',   // Obsidian 中存放导航的文件夹
      targetFolder: 'daohang',     // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '友链',
      obsidianFolder: 'friends',    // Obsidian 中存放友链的文件夹
      targetFolder: 'friends',     // 项目中对应的文件夹
      datePrefix: false,
    },
    {
      type: '资源',
      obsidianFolder: 'ziyuan',    // Obsidian 中存放资源的文件夹
      targetFolder: 'ziyuan',     // 项目中对应的文件夹
      datePrefix: false,
    },
  ],
};
