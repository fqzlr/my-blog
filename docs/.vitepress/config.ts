import { defineConfig } from 'vitepress'

/**
 * Firefly Blog VitePress 文档配置
 * 
 * 这是一个基于 Astro 框架构建的现代化个人博客主题的文档站点配置
 * 使用 VitePress 作为静态文档生成器
 */
export default defineConfig({
  // 站点基础信息配置
  title: 'Firefly Blog',
  description: '基于 Astro 框架的清新美观现代化个人博客主题文档',
  lang: 'zh-CN',
  
  // 头部配置 - 引入字体等资源
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
  ],

  // 主题配置
  themeConfig: {
    // 站点Logo
    logo: '/logo.png',
    
    // 导航栏配置
    nav: [
      { text: '指南', link: '/zh/guide/getting-started', activeMatch: '/zh/guide/' },
      { text: '配置', link: '/zh/config/site-config', activeMatch: '/zh/config/' },
      { text: '组件', link: '/zh/components/music-player', activeMatch: '/zh/components/' },
      { 
        text: '相关链接', 
        items: [
          { text: 'GitHub', link: 'https://github.com/fqzlr/my-blog' },
          { text: 'Astro 官方文档', link: 'https://astro.build' },
          { text: 'VitePress 官方文档', link: 'https://vitepress.dev' }
        ]
      }
    ],

    // 侧边栏配置
    sidebar: {
      '/zh/guide/': [
        {
          text: '入门指南',
          items: [
            { text: '快速开始', link: '/zh/guide/getting-started' },
            { text: '项目结构', link: '/zh/guide/project-structure' },
            { text: '部署指南', link: '/zh/guide/deployment' }
          ]
        },
        {
          text: '功能指南',
          items: [
            { text: '音乐播放器', link: '/zh/guide/music-player' },
            { text: '3D音乐可视化', link: '/zh/guide/music-visualizer' },
            { text: '文章写作', link: '/zh/guide/writing-posts' },
            { text: '评论系统', link: '/zh/guide/comments' },
            { text: 'CMS后台管理', link: '/zh/guide/admin-panel' }
          ]
        }
      ],
      '/zh/config/': [
        {
          text: '基础配置',
          items: [
            { text: '站点配置', link: '/zh/config/site-config' },
            { text: '导航栏配置', link: '/zh/config/navbar-config' },
            { text: '侧边栏配置', link: '/zh/config/sidebar-config' },
            { text: '个人资料配置', link: '/zh/config/profile-config' }
          ]
        },
        {
          text: '功能配置',
          items: [
            { text: '背景壁纸配置', link: '/zh/config/background-wallpaper' },
            { text: '评论系统配置', link: '/zh/config/comment-config' },
            { text: '音乐播放器配置', link: '/zh/config/music-config' },
            { text: '字体配置', link: '/zh/config/font-config' },
            { text: '封面图片配置', link: '/zh/config/cover-image-config' }
          ]
        },
        {
          text: '扩展配置',
          items: [
            { text: '页脚配置', link: '/zh/config/footer-config' },
            { text: '许可证配置', link: '/zh/config/license-config' },
            { text: '赞助配置', link: '/zh/config/sponsor-config' },
            { text: '广告配置', link: '/zh/config/ad-config' },
            { text: '公告配置', link: '/zh/config/announcement-config' }
          ]
        },
        {
          text: '内容管理',
          items: [
            { text: '友链配置', link: '/zh/config/friends-config' },
            { text: '说说动态配置', link: '/zh/config/moments-config' },
            { text: '笔记配置', link: '/zh/config/notebooks-config' },
            { text: '影视追番配置', link: '/zh/config/bangumi-config' },
            { text: '相册配置', link: '/zh/config/gallery-config' }
          ]
        },
        {
          text: '高级配置',
          items: [
            { text: '代码块配置', link: '/zh/config/expressive-code' },
            { text: '看板娘配置', link: '/zh/config/pio-config' },
            { text: '技能图标配置', link: '/zh/config/skills-config' },
            { text: '日历配置', link: '/zh/config/calendar-config' },
            { text: 'AI搜索配置', link: '/zh/config/ai-search-config' }
          ]
        }
      ],
      '/zh/components/': [
        {
          text: '核心组件',
          items: [
            { text: '音乐播放器组件', link: '/zh/components/music-player' },
            { text: '3D音乐可视化组件', link: '/zh/components/music-visualizer' },
            { text: 'Live2D看板娘组件', link: '/zh/components/live2d-widget' }
          ]
        }
      ]
    },

    // 社交链接
    socialLinks: [
      { icon: 'github', link: 'https://github.com/fqzlr/my-blog' }
    ],

    // 页脚配置
    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2024-present Firefly Blog'
    },

    // 搜索配置
    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索文档',
                buttonAriaLabel: '搜索文档'
              },
              modal: {
                noResultsText: '没有找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换'
                }
              }
            }
          }
        }
      }
    },

    // 文档页面配置
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },

    // 大纲配置
    outline: {
      level: [2, 3],
      label: '目录'
    },

    // 最后更新时间
    lastUpdated: {
      text: '最后更新于',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    }
  },

  // Markdown 配置
  markdown: {
    lineNumbers: true,
    theme: 'github-dark'
  }
})
