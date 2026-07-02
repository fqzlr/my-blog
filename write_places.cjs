const fs = require('fs');

const content = `---
import MainGridLayout from '@/layouts/MainGridLayout.astro';
import { getCollection } from 'astro:content';

const lifeEntries = await getCollection('life');

const isIn = (entryId: string, folder: string) =>
	entryId.replace(/\\\\\\\\/g, '/').startsWith(\`\${folder}/\`);

const now = new Date();
const currentYear = now.getFullYear();

const isSameYear = (date?: Date | string) => {
	if (!date) return false;
	const d = date instanceof Date ? date : new Date(String(date));
	if (Number.isNaN(d.getTime())) return false;
	return d.getFullYear() === currentYear;
};

const sum = (arr: number[]) => arr.reduce((acc, num) => acc + num, 0);

const visitedPlaces = lifeEntries
	.filter((entry) => isIn(entry.id, 'places'))
	.map((entry) => entry.data);

const sortedPlaces = [...visitedPlaces].sort((a, b) => {
	const aTime = a.date instanceof Date ? a.date.getTime() : 0;
	const bTime = b.date instanceof Date ? b.date.getTime() : 0;
	return bTime - aTime;
});

const visitedProvincesCount = new Set(sortedPlaces.map((p) => p.province).filter(Boolean)).size;
const totalVisitCount = sum(sortedPlaces.map((p) => p.visitCount || 1));
const thisYearVisitCount = sortedPlaces.filter((p) => isSameYear(p.date)).length;

const placesByProvince = {};
sortedPlaces.forEach((place) => {
	if (!place.province) return;
	if (!placesByProvince[place.province]) {
		placesByProvince[place.province] = [];
	}
	placesByProvince[place.province].push({
		province: place.province,
		city: place.city || '',
		district: place.district || '',
		experience: place.experience || '',
		visitCount: place.visitCount || 1,
		date: place.date instanceof Date ? place.date.toISOString().split('T')[0] : '',
	});
});

const clientSortedPlaces = sortedPlaces.map(p => ({
	province: p.province,
	city: p.city || '',
	district: p.district || '',
	experience: p.experience || '',
	visitCount: p.visitCount || 1,
	date: p.date instanceof Date ? p.date.toISOString().split('T')[0] : '',
}));
---
<MainGridLayout title='去过的地方' description='足迹地图与旅行记录'>
	<div class='life-page flex w-full flex-col gap-5'>
		<section class='life-section card-base rounded-[var(--radius-large)] p-6'>
			<h1 class='mb-2 text-3xl font-bold text-[var(--primary)]'>🗺️ 去过的地方</h1>
			<p class='text-sm text-[var(--content-meta)]'>在中国地图上标记你去过的城市。去过的地方会显示为红色区域覆盖，去的次数越多颜色越深。</p>
			<div class='mt-6 grid grid-cols-2 gap-3 md:grid-cols-4'>
				<div class='life-stat-card'>
					<div class='text-xs text-[var(--content-meta)]'>去过城市</div>
					<div class='mt-1 text-xl font-bold'>{sortedPlaces.filter(p => p.city).length || sortedPlaces.length}</div>
				</div>
				<div class='life-stat-card'>
					<div class='text-xs text-[var(--content-meta)]'>总到访次数</div>
					<div class='mt-1 text-xl font-bold'>{totalVisitCount}</div>
				</div>
				<div class='life-stat-card'>
					<div class='text-xs text-[var(--content-meta)]'>今年出行</div>
					<div class='mt-1 text-xl font-bold'>{thisYearVisitCount}</div>
				</div>
				<div class='life-stat-card'>
					<div class='text-xs text-[var(--content-meta)]'>总地点</div>
					<div class='mt-1 text-xl font-bold'>{sortedPlaces.length}</div>
				</div>
			</div>
		</section>
		<section class='life-section card-base rounded-[var(--radius-large)] p-6'>
			<h2 class='mb-4 text-xl font-bold text-[var(--text-color)]'>足迹地图</h2>
			<div id='life-map' class='h-[600px] w-full rounded-xl border border-[var(--line-divider)] bg-[var(--card-bg)] overflow-hidden'></div>
			<p class='mt-2 text-xs text-[var(--content-meta)] text-center'>地图由 Apache ECharts 提供 · 去过的地方会覆盖为红色</p>
		</section>
		<section class='life-section card-base rounded-[var(--radius-large)] p-6'>
			<h2 class='mb-4 text-xl font-bold text-[var(--text-color)]'>地点列表</h2>
			<div class='grid gap-3 md:grid-cols-2'>
				{sortedPlaces.length === 0 ? (
					<div class='col-span-2 rounded-xl border border-[var(--line-divider)] bg-[var(--card-bg)] p-6 text-center text-sm text-[var(--content-meta)]'>暂无地点记录，在 \`life/places/\` 下新建 md 即可添加。</div>
				) : (
					sortedPlaces.map((place) => (
						<article class='life-data-item rounded-xl border border-[var(--line-divider)] bg-[var(--card-bg)] p-4'>
							<div class='flex items-start justify-between'>
								<div>
									<h3 class='font-semibold'>{place.province || '未知省份'}{place.city ? \` - \${place.city}\` : ''}</h3>
									<p class='mt-1 text-sm text-[var(--content-meta)]'>{place.experience || '暂无体验记录'}</p>
								</div>
								<div class='text-right text-sm text-[var(--content-meta)]'>
									<div class='font-medium'>到访 {place.visitCount || 1} 次</div>
									<div class='text-xs'>{place.date instanceof Date ? place.date.toISOString().split('T')[0] : (typeof place.date === 'string' ? place.date : '未填写日期')}</div>
								</div>
							</div>
						</article>
					))
				)}
			</div>
		</section>
	</div>
</MainGridLayout>
<script is:inline define:vars={{ clientSortedPlaces }}>
(function() {
	var container = document.getElementById('life-map');
	if (!container) return;

	var placesWithCity = clientSortedPlaces.filter(function(p) { return p.city; });

	function normalizeCityName(name) {
		if (!name) return '';
		return name.replace(/市$/, '');
	}

	function loadECharts() {
		return new Promise(function(resolve, reject) {
			if (window.echarts) { resolve(window.echarts); return; }
			var script = document.createElement('script');
			script.src = 'https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js';
			script.onload = function() { resolve(window.echarts); };
			script.onerror = function() { reject(new Error('ECharts 加载失败')); };
			document.head.appendChild(script);
		});
	}

	function loadChinaMap() {
		return fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
			.then(function(res) { return res.json(); })
			.catch(function() {
				return fetch('https://cdn.jsdelivr.net/npm/echarts@5.4.3/map/json/china.json').then(function(res) { return res.json(); });
			});
	}

	function getProvinceAdcode(provinceName) {
		var adcodes = {
			'北京': 110000, '天津': 120000, '上海': 310000, '重庆': 500000,
			'河北': 130000, '山西': 140000, '辽宁': 210000, '吉林': 220000,
			'黑龙江': 230000, '江苏': 320000, '浙江': 330000, '安徽': 340000,
			'福建': 350000, '江西': 360000, '山东': 370000, '河南': 410000,
			'湖北': 420000, '湖南': 430000, '广东': 440000, '广西': 450000,
			'海南': 460000, '四川': 510000, '贵州': 520000, '云南': 530000,
			'西藏': 540000, '陕西': 610000, '甘肃': 620000, '青海': 630000,
			'宁夏': 640000, '新疆': 650000, '台湾': 710000,
			'内蒙古': 150000, '内蒙古自治区': 150000, '香港': 810000, '澳门': 820000
		};
		var normalized = provinceName.replace(/省|自治区|特别行政区/g, '');
		return adcodes[normalized] || adcodes[provinceName];
	}

	function loadProvinceCities(provinceAdcode) {
		return fetch('https://geo.datav.aliyun.com/areas_v3/bound/' + provinceAdcode + '_full.json')
			.then(function(res) { return res.json(); })
			.catch(function(err) { return null; });
	}

	function findCityInFeatures(features, cityName) {
		var normalizedCity = normalizeCityName(cityName);
		for (var i = 0; i < features.length; i++) {
			var feature = features[i];
			var name = feature.properties && feature.properties.name;
			if (!name) continue;
			var normalizedName = normalizeCityName(name);
			if (normalizedName === normalizedCity || name === cityName || name.includes(cityName) || cityName.includes(normalizedName)) {
				return { feature: feature, name: name };
			}
		}
		return null;
	}

	function initMap() {
		Promise.all([loadECharts(), loadChinaMap()]).then(function(results) {
			var echartsLib = results[0];
			var chinaMapData = results[1];

			if (!chinaMapData) {
				container.innerHTML = '<div class=h-full flex items-center justify-center text-[var(--content-meta)]>地图数据加载失败</div>';
				return;
			}

			echartsLib.registerMap('china', chinaMapData);
			var chart = echartsLib.init(container);

			var allCityFeatures = [];
			var cityPlaceMap = {};
			var maxVisits = 1;
			var processedProvinces = {};

			var promises = placesWithCity.map(function(place) {
				var adcode = getProvinceAdcode(place.province);
				if (!adcode || processedProvinces[adcode]) return Promise.resolve();
				processedProvinces[adcode] = true;
				return loadProvinceCities(adcode).then(function(cityData) {
					if (!cityData || !cityData.features) return;
					var matched = findCityInFeatures(cityData.features, place.city);
					if (matched) {
						var cityName = matched.name;
						allCityFeatures.push(matched.feature);
						if (!cityPlaceMap[cityName]) cityPlaceMap[cityName] = [];
						cityPlaceMap[cityName].push(place);
						var total = cityPlaceMap[cityName].reduce(function(s, p) { return s + (p.visitCount || 1); }, 0);
						if (total > maxVisits) maxVisits = total;
					}
				});
			});

			Promise.all(promises).then(function() {
				if (allCityFeatures.length > 0) {
					echartsLib.registerMap('cities', { type: 'FeatureCollection', features: allCityFeatures });
				}

				var baseData = (chinaMapData.features || []).map(function(f) {
					return { name: f.properties && f.properties.name, value: 0, places: [] };
				});

				var cityDataList = Object.keys(cityPlaceMap).map(function(cityName) {
					var places = cityPlaceMap[cityName];
					var total = places.reduce(function(s, p) { return s + (p.visitCount || 1); }, 0);
					return { name: cityName, value: total, places: places };
				});

				var option = {
					tooltip: {trigger: 'item', formatter: function(params) {
						if (params.value && params.value > 0) {
							var places = params.data && params.data.places ? params.data.places : [];
							var tip = '<strong>' + params.name + '</strong><br/>到访：' + params.value + '次';
							if (places.length > 0) {
								tip += "<br/><span style='font-size:11px;color:#888;'>";
								for (var n = 0; n < Math.min(places.length, 5); n++) {
									var loc = (places[n].district || '') || (places[n].city || '') || '该地区';
									tip += '<br/>• ' + loc + '(' + (places[n].visitCount || 1) + '次)';
								}
								if (places.length > 5) tip += '<br/>...等' + places.length + '处';
								tip += '</span>';
							}
							return tip;
						}
						return '<strong>' + params.name + '</strong><br/><span style=\\'color:#999;\\'>未到访</span>';
					}},
					visualMap: {type: 'piecewise', show: true, left: 20, bottom: 20, pieces: [
						{gt: Math.ceil(maxVisits * 0.8), color: '#cc0000'},
						{gt: Math.ceil(maxVisits * 0.5), lte: Math.ceil(maxVisits * 0.8), color: '#ff4444'},
						{gt: 1, lte: Math.ceil(maxVisits * 0.5), color: '#ff8888'},
						{value: 0, color: '#e8e8e8'}
					], textStyle: {color: 'var(--text-color)', fontSize: 12}},
					series: [
						{name: '省份', type: 'map', map: 'china', roam: true, zoom: 1.2, center: [105, 36], silent: true, itemStyle: {areaColor: '#f0f0f0', borderColor: '#ccc', borderWidth: 1}, emphasis: {itemStyle: {areaColor: '#e0e0e0'}, label: {show: false}}, select: {disabled: true}, data: baseData},
						{name: '城市', type: 'map', map: 'cities', roam: true, zoom: 1.2, center: [105, 36], silent: false, itemStyle: {areaColor: '#ff4444', borderColor: '#cc0000', borderWidth: 2}, emphasis: {itemStyle: {areaColor: '#ff6666', borderColor: '#ff0000', borderWidth: 3}, label: {show: true, color: '#fff', fontWeight: 'bold', fontSize: 14}}, select: {disabled: true}, data: cityDataList, z: 10}
					]
				};

				chart.setOption(option);

				chart.on('click', function(params) {
					if (params.value && params.value > 0) {
						var places = params.data && params.data.places ? params.data.places : [];
						if (places.length > 0) {
							var list = places.map(function(p, idx) {
								var loc = (p.district || '') || (p.city || '') || '未知';
								return (idx + 1) + '. ' + loc + '-到访' + (p.visitCount || 1) + '次' + (p.experience ? '\\n   ' + p.experience : '');
							}).join('\\n\\n');
							alert(params.name + '去过' + places.length + '处：\\n\\n' + list);
						}
					}
				});

				window.addEventListener('resize', function() { chart.resize(); });
			});
		}).catch(function(err) {
			container.innerHTML = '<div class=h-full flex items-center justify-center text-[var(--content-meta)]>加载失败:' + (err.message || '') + '</div>';
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initMap);
	} else {
		initMap();
	}
})();
</script>
<style>
	.life-section { border: 1px solid var(--life-border); box-shadow: 0 10px 30px rgb(0 0 0 / 6%); background: color-mix(in srgb, var(--card-bg) 92%, transparent); }
	.life-stat-card { border: 1px solid var(--life-border); background: linear-gradient(140deg, color-mix(in srgb, var(--primary) 9%, transparent) 0%, transparent 45%), var(--card-bg); padding: 0.75rem; border-radius: var(--radius-base); }
	.life-stat-card > div:first-child { font-size: 0.75rem; letter-spacing: 0.02em; text-transform: uppercase; opacity: 0.9; }
	.life-data-item { border-color: var(--life-border); }
	:global(html.dark) .life-section { box-shadow: 0 10px 26px rgb(0 0 0 / 28%); }
	:global(html.dark) .life-stat-card { background: linear-gradient(140deg, color-mix(in srgb, var(--primary) 12%, transparent) 0%, transparent 46%), color-mix(in srgb, var(--card-bg) 84%, #000); }
	.life-page { --life-border: color-mix(in srgb, var(--line-divider) 86%, transparent); }
</style>
`;

fs.writeFileSync('E:/GithubProgect/dumplingandcakeblog/src/pages/life/places.astro', content, 'utf8');
console.log('Done');
