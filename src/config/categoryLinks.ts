// bangumi 各分类/子分类的封面点击跳转链接
// 支持 {userId} 占位符，会自动替换为 siteConfig.douban.userId
// 留空则使用各页面的默认逻辑

export const categoryLinks: Record<string, string> = {
	// ── 按 category 分类 ──
	book: "", // 空 = 自动跳转书籍详情页 /books/{slug}/
	anime: "", // 空 = 走豆瓣链接 / 子分类链接
	game: "", // 空 = 走豆瓣链接
	music: "", // 空 = 音乐页面无跳转
	real: "", // 空 = 走豆瓣链接

	// ── 影视与游戏 子分类（优先级高于上面的 anime/game） ──
	movie: "https://www.douban.com/doulist/164100531/", // 电影点击链接
	tv: "https://www.douban.com/doulist/164102159/", // 电视剧点击链接
	anime_sub: "https://www.douban.com/doulist/164102173/", // 动漫点击链接
	documentary: "https://www.douban.com/doulist/164102165/", // 纪录片点击链接
	game_sub: "https://www.douban.com/doulist/164102168/", // 游戏点击链接
};
