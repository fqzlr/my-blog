/**
 * 文章目录文件夹图标配置
 * key: 文件夹名称（与 src/content/posts/ 下的文件夹名一致）
 * value: Iconify 图标名称（已安装的图标集：material-symbols, fa7-brands, fa7-regular, fa7-solid, simple-icons, mdi）
 *
 * 未配置的文件夹使用默认图标 ▸
 * 图标查询: https://icones.js.org/
 */
export const folderIconConfig: Record<string, string> = {
	// 顶级分类
	JavaWebAI: "material-symbols:code-blocks-outline",
	Java笔记本: "mdi:language-java",
	Java进阶: "material-symbols:school-outline",
	Java菜鸟: "material-symbols:child-care-outline",
	English笔记本: "material-symbols:translate",
	MySQL数据库: "simple-icons:mysql",
	MySQL进阶: "material-symbols:database-outline",
	前端基础: "simple-icons:html5",
	后端基础: "material-symbols:dns-outline",
	博客指南: "material-symbols:menu-book-outline",
	技术分享: "material-symbols:share-outline",
	资源整理: "material-symbols:folder-special-outline",
	测试文件: "material-symbols:science-outline",
};
