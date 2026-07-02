/**
 * @fileoverview 音频分析器模块
 *
 * 使用 Web Audio API 对音频进行实时频谱分析，提取各频段能量数据，
 * 并通过节拍检测算法驱动3D地形可视化效果。
 *
 * 核心功能：
 * 1. 连接HTMLAudioElement进行音频捕获
 * 2. FFT频谱分析，提取8个频段的能量值
 * 3. 节拍检测（beat detection）触发涟漪效果
 * 4. 流星事件检测（高频触发）
 * 5. 音频特征计算（亮度、温暖度、密度等）
 *
 * @author Firefly Blog
 */

import * as THREE from "three";

/**
 * 音频分析数据接口
 * 包含从音频中提取的各频段能量值和音频特征
 */
export interface AudioData {
	/** 低音 (约 60-250Hz) - 鼓点、贝斯等低频打击乐 */
	bass: number;
	/** 中音 (约 500-2000Hz) - 人声、吉他等主要旋律 */
	mid: number;
	/** 高音 (约 4000-20000Hz) - 镲片、高频装饰音 */
	treble: number;
	/** 整体能量 - 所有频段平均能量 */
	energy: number;
	/** 超低音 (20-60Hz) - 底鼓、低频轰鸣 */
	subBass: number;
	/** 中低音 (250-500Hz) - 贝斯基频、人声胸腔共鸣 */
	lowMid: number;
	/** 中高音 (2000-4000Hz) - 人声辅音、钢琴高音区 */
	highMid: number;
	/** 存在感 (4000-6000Hz) - 人声清晰度、吉他拨弦 */
	presence: number;
	/** 明亮度 (6000-12000Hz) - 齿音、镲片泛音 */
	brilliance: number;
	/** 空气感 (12000-20000Hz) - 高频泛音、空间感 */
	air: number;
	/** 温暖度 - 低频占比，值越大声音越温暖 */
	warmth: number;
	/** 亮度 - 高频占比，值越大声音越明亮 */
	brightness: number;
	/** 尖锐度 - 亮度的变化率，用于检测瞬态 */
	sharpness: number;
	/** 平滑度 - 频谱变化的平滑程度 */
	smoothness: number;
	/** 密度 - 活跃频段的比例，表示音乐的丰满度 */
	density: number;
	/** 频谱质心 - 频谱能量的"重心"位置，越高声音越明亮 */
	spectralCentroid: number;
}

/**
 * 涟漪效果数据接口
 * 用于3D地形上的水波扩散效果
 */
interface Ripple {
	/** 涟漪中心位置 (x, z平面坐标) */
	pos: THREE.Vector2;
	/** 涟漪创建时间 */
	time: number;
	/** 涟漪强度 (0-4) */
	strength: number;
	/** 涟漪是否激活 */
	isActive: number;
	/** 涟漪类型 (0=普通, 1=白色高亮) */
	rippleType: number;
}

/**
 * 音频分析器事件回调接口
 * 当检测到特定音频事件时触发对应的回调函数
 */
export interface AudioAnalyzerEvents {
	/**
	 * 涟漪事件 - 检测到节拍或用户点击时触发
	 * @param x 涟漪中心X坐标
	 * @param z 涟漪中心Z坐标
	 * @param strength 涟漪强度
	 * @param isWhite 是否为白色高亮涟漪
	 */
	onRipple?: (x: number, z: number, strength: number, isWhite: boolean) => void;

	/**
	 * 流星事件 - 检测到高频能量爆发时触发
	 * @param strength 流星强度 (0-1)
	 */
	onMeteor?: (strength: number) => void;

	/**
	 * 节拍事件 - 检测到低频节拍时触发
	 * @param strength 节拍强度 (0-4)
	 */
	onBeat?: (strength: number) => void;
}

/**
 * 音频分析器类
 *
 * 使用 Web Audio API 的 AnalyserNode 进行实时频谱分析，
 * 将音频信号分解为多个频段，并通过算法检测节拍等音乐事件。
 *
 * @example
 * ```typescript
 * const analyzer = new AudioAnalyzer();
 * analyzer.connect(audioElement);
 * analyzer.setEvents({
 *   onBeat: (strength) => console.log('Beat!', strength),
 *   onRipple: (x, z, s) => console.log('Ripple at', x, z),
 * });
 *
 * // 在动画循环中调用
 * function animate() {
 *   const audioData = analyzer.update(16);
 *   // 使用 audioData 更新可视化...
 *   requestAnimationFrame(animate);
 * }
 * ```
 */
export class AudioAnalyzer {
	/** Web Audio API 上下文 */
	public audioCtx: AudioContext | null = null;
	/** 频谱分析节点 - 用于获取FFT数据 */
	private analyser: AnalyserNode | null = null;
	/** 媒体元素源节点 - 连接HTMLAudioElement */
	private source: MediaElementAudioSourceNode | null = null;
	/** 音量控制节点 */
	private gainNode: GainNode | null = null;
	/** 绑定的HTML音频元素 */
	private audioElement: HTMLAudioElement | null = null;
	/** 原始频谱数据数组 (Uint8Array, 0-255) */
	private dataArray = new Uint8Array(512);
	/** 上一帧的频谱数据，用于计算频谱通量 */
	private prevData: number[] = new Array(512).fill(0);
	/** 上一帧的亮度值，用于计算尖锐度 */
	private prevBrightness = 0;
	/** 是否已连接到音频元素 */
	private connected = false;
	/** 事件回调集合 */
	private events: AudioAnalyzerEvents = {};

	/**
	 * 平滑后的音频数据
	 * 使用低通滤波使数据变化更平滑，避免可视化效果抖动
	 */
	private smoothedData: AudioData = {
		bass: 0,
		mid: 0,
		treble: 0,
		energy: 0,
		subBass: 0,
		lowMid: 0,
		highMid: 0,
		presence: 0,
		brilliance: 0,
		air: 0,
		warmth: 0,
		brightness: 0,
		sharpness: 0,
		smoothness: 0,
		density: 0,
		spectralCentroid: 0,
	};

	/** 节拍冷却计时器 - 防止连续触发 */
	private beatCooldown = 0;
	/** 节拍历史数据 - 用于自适应阈值检测 */
	private beatHistory: number[] = new Array(40).fill(0);
	/** 节拍历史环形缓冲区索引 */
	private beatHistoryIndex = 0;
	/** 流星冷却计时器 */
	private meteorCooldown = 0;

	constructor() {}

	/**
	 * 设置事件回调
	 * @param events 包含各种音频事件回调的对象
	 */
	setEvents(events: AudioAnalyzerEvents) {
		this.events = events;
	}

	/**
	 * 连接到HTML音频元素
	 *
	 * 创建AudioContext并建立音频节点连接：
	 * AudioElement -> GainNode -> AnalyserNode -> Destination
	 *
	 * @param audioEl HTMLAudioElement 音频元素
	 */
	connect(audioEl: HTMLAudioElement) {
		// 避免重复连接
		if (this.connected && this.audioElement === audioEl) return;
		this.audioElement = audioEl;

		// 如果已有上下文，只恢复（浏览器自动播放策略要求用户交互后resume）
		if (this.audioCtx) {
			if (this.audioCtx.state === "suspended") {
				this.audioCtx.resume();
			}
			return;
		}

		// 创建 AudioContext（兼容 webkit 前缀）
		const AC: typeof AudioContext =
			window.AudioContext ||
			(window as unknown as { webkitAudioContext: typeof AudioContext })
				.webkitAudioContext;
		this.audioCtx = new AC();
		this.analyser = this.audioCtx.createAnalyser();

		// FFT大小 - 影响频率分辨率，1024提供较好的低频分辨率
		this.analyser.fftSize = 1024;
		// 平滑时间常数 - 0-1之间，值越大频谱变化越平滑
		this.analyser.smoothingTimeConstant = 0.8;

		// 创建音量节点
		this.gainNode = this.audioCtx.createGain();
		this.gainNode.gain.value = 1;

		try {
			// 建立音频节点连接图
			this.source = this.audioCtx.createMediaElementSource(audioEl);
			this.source.connect(this.gainNode);
			this.gainNode.connect(this.audioCtx.destination); // 输出到扬声器
			this.gainNode.connect(this.analyser); // 同时输出到分析器
			this.connected = true;
		} catch (e) {
			console.warn("AudioAnalyzer: Failed to connect to audio element", e);
		}

		// 根据实际频率bin数量调整数据数组
		this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
	}

	/**
	 * 断开音频连接并清理资源
	 */
	disconnect() {
		if (this.source) {
			this.source.disconnect();
			this.source = null;
		}
		if (this.gainNode) {
			this.gainNode.disconnect();
			this.gainNode = null;
		}
		if (this.analyser) {
			this.analyser.disconnect();
			this.analyser = null;
		}
		if (this.audioCtx) {
			this.audioCtx.close();
			this.audioCtx = null;
		}
		this.connected = false;
	}

	/**
	 * 检查是否已连接到音频元素
	 */
	isConnected() {
		return this.connected;
	}

	/**
	 * 恢复音频上下文
	 * 浏览器自动播放策略要求在用户交互后调用
	 */
	resume() {
		if (this.audioCtx?.state === "suspended") {
			this.audioCtx.resume();
		}
	}

	/**
	 * 更新音频分析数据（每帧调用）
	 *
	 * 执行以下操作：
	 * 1. 获取当前频谱数据
	 * 2. 计算各频段能量值
	 * 3. 计算音频特征（亮度、温暖度等）
	 * 4. 检测节拍和流星事件
	 * 5. 对数据进行平滑处理
	 *
	 * @param _delta 帧间隔时间(ms)
	 * @returns 平滑后的音频数据
	 */
	update(_delta: number): AudioData {
		if (!this.analyser) {
			return { ...this.smoothedData };
		}

		// 检查音频是否正在播放
		const isPlaying = this.audioElement
			? !this.audioElement.paused && !this.audioElement.ended
			: false;

		// 各频段累加器
		let energySum = 0;
		let centroidNum = 0;
		let centroidDen = 0;
		let subBassSum = 0; // 0-1 bins (约 0-43Hz)
		let bassSum = 0; // 2-3 bins (约 43-86Hz)
		let lowMidSum = 0; // 4-7 bins (约 86-172Hz)
		let midSum = 0; // 8-18 bins (约 172-400Hz)
		let highMidSum = 0; // 19-46 bins (约 400-1000Hz)
		let presenceSum = 0; // 47-93 bins (约 1-2kHz)
		let brillianceSum = 0; // 94-186 bins (约 2-4kHz)
		let airSum = 0; // 187-372 bins (约 4-8kHz)

		// 频谱变化相关变量
		let jumpVolatilitySum = 0;
		let fluxPulse = 0; // 低频通量 - 用于节拍检测
		let fluxMeteor = 0; // 高频通量 - 用于流星检测

		const binCount = this.dataArray.length;

		if (isPlaying) {
			// 获取当前频谱数据 (0-255)
			this.analyser.getByteFrequencyData(this.dataArray);

			// 遍历所有频率bin计算各频段能量
			for (let i = 0; i < binCount; i++) {
				const val = this.dataArray[i] / 255; // 归一化到 0-1
				energySum += val;

				// 计算频谱质心 (spectral centroid)
				centroidNum += i * val;
				centroidDen += val;

				// 计算频谱跳变 (spectral flux) - 与上一帧的差值
				const prevVal = this.prevData[i] || 0;
				jumpVolatilitySum += Math.abs(val - prevVal);

				// 低频段(0-16 bins)的正向变化 - 节拍检测
				if (i >= 0 && i <= 16) {
					const diff = val - prevVal;
					if (diff > 0) fluxPulse += diff;
				}

				// 高频段(159-174 bins 约 3.4-3.8kHz)的正向变化 - 流星检测
				if (i >= 159 && i <= 174) {
					const diff = val - prevVal;
					if (diff > 0) fluxMeteor += diff;
				}

				this.prevData[i] = val;

				// 按频率区间分配到各频段
				// 采样率44100Hz时，每个bin约 44100/1024 ≈ 43Hz
				if (i <= 1)
					subBassSum += val; // 0-43Hz
				else if (i <= 3)
					bassSum += val; // 43-86Hz
				else if (i <= 7)
					lowMidSum += val; // 86-172Hz
				else if (i <= 18)
					midSum += val; // 172-400Hz
				else if (i <= 46)
					highMidSum += val; // 400-1000Hz
				else if (i <= 93)
					presenceSum += val; // 1-2kHz
				else if (i <= 186)
					brillianceSum += val; // 2-4kHz
				else if (i <= 372) airSum += val; // 4-8kHz+
			}

			// 检测节拍和流星事件
			this.detectBeats(fluxPulse, fluxMeteor);
		} else {
			// 音频暂停时，让数据自然衰减
			for (let i = 0; i < binCount; i++) {
				this.dataArray[i] = Math.floor(this.dataArray[i] * 0.94);
				this.prevData[i] = 0;
			}
		}

		// 更新冷却计时器
		if (this.beatCooldown > 0) this.beatCooldown--;
		if (this.meteorCooldown > 0) this.meteorCooldown--;

		// 计算各频段归一化能量值
		const energy = energySum / binCount;
		const subBass = subBassSum / 2;
		const bass = bassSum / 2;
		const lowMid = lowMidSum / 4;
		const mid = midSum / 11;
		const highMid = highMidSum / 28;
		const presence = presenceSum / 47;
		const brilliance = brillianceSum / 93;
		const air = airSum / 186;

		// 传统三分频（低音/中音/高音）
		const oldBass = (subBassSum + bassSum + lowMidSum) / 8;
		const oldMid = (midSum + highMidSum) / 39;
		const oldTreble = (presenceSum + brillianceSum + airSum) / 326;

		// 计算音频特征
		// 温暖度 = 低频能量 / 总能量
		const warmth =
			energySum > 0
				? (subBassSum + bassSum + lowMidSum + midSum) / energySum
				: 0;
		// 亮度 = 高频能量 / 总能量
		const brightness =
			energySum > 0 ? (presenceSum + brillianceSum + airSum) / energySum : 0;
		// 尖锐度 = 亮度的正向变化率（检测瞬态）
		const sharpness = Math.max(0, brightness - this.prevBrightness) * 10;
		this.prevBrightness = brightness;

		// 平滑度 = 1 - 平均频谱跳变
		const smoothnessVal = Math.max(0, 1 - (jumpVolatilitySum / binCount) * 2);

		// 密度 = 活跃频段数量 / 总频段数
		const activeThreshold = energy * 1.5;
		let activeBands = 0;
		if (subBass > activeThreshold) activeBands++;
		if (bass > activeThreshold) activeBands++;
		if (lowMid > activeThreshold) activeBands++;
		if (mid > activeThreshold) activeBands++;
		if (highMid > activeThreshold) activeBands++;
		if (presence > activeThreshold) activeBands++;
		if (brilliance > activeThreshold) activeBands++;
		if (air > activeThreshold) activeBands++;
		const density = activeBands / 8;

		// 频谱质心
		const spectralCentroid = centroidDen > 0 ? centroidNum / centroidDen : 0;

		// 平滑系数 - 播放时响应更快，暂停时衰减更慢
		const dt = isPlaying ? 0.15 : 0.05;

		// 对所有数据应用低通平滑滤波
		this.smoothedData.bass += (oldBass - this.smoothedData.bass) * dt;
		this.smoothedData.mid += (oldMid - this.smoothedData.mid) * dt;
		this.smoothedData.treble += (oldTreble - this.smoothedData.treble) * dt;
		this.smoothedData.energy += (energy - this.smoothedData.energy) * dt;
		this.smoothedData.subBass += (subBass - this.smoothedData.subBass) * dt;
		this.smoothedData.lowMid += (lowMid - this.smoothedData.lowMid) * dt;
		this.smoothedData.highMid += (highMid - this.smoothedData.highMid) * dt;
		this.smoothedData.presence += (presence - this.smoothedData.presence) * dt;
		this.smoothedData.brilliance +=
			(brilliance - this.smoothedData.brilliance) * dt;
		this.smoothedData.air += (air - this.smoothedData.air) * dt;
		this.smoothedData.warmth += (warmth - this.smoothedData.warmth) * dt;
		this.smoothedData.brightness +=
			(brightness - this.smoothedData.brightness) * dt;
		this.smoothedData.sharpness +=
			(sharpness - this.smoothedData.sharpness) * dt;
		this.smoothedData.smoothness +=
			(smoothnessVal - this.smoothedData.smoothness) * dt;
		this.smoothedData.density += (density - this.smoothedData.density) * dt;
		this.smoothedData.spectralCentroid +=
			(spectralCentroid - this.smoothedData.spectralCentroid) * dt;

		return { ...this.smoothedData };
	}

	/**
	 * 节拍检测算法
	 *
	 * 使用频谱通量(spectral flux)结合自适应阈值进行节拍检测：
	 * 1. 计算低频段的频谱通量（仅正向变化）
	 * 2. 维护历史窗口计算平均通量和标准差
	 * 3. 当当前通量超过 (平均值 + 1.5*标准差) 时判定为节拍
	 * 4. 添加冷却时间防止过度触发
	 *
	 * @param fluxPulse 低频频谱通量（节拍）
	 * @param fluxMeteor 高频频谱通量（流星）
	 */
	private detectBeats(fluxPulse: number, fluxMeteor: number) {
		const smoothedFlux = fluxPulse;
		// 将当前通量值存入历史环形缓冲区
		this.beatHistory[this.beatHistoryIndex] = smoothedFlux;
		this.beatHistoryIndex =
			(this.beatHistoryIndex + 1) % this.beatHistory.length;

		// 计算历史窗口平均通量
		let avgFlux = 0;
		for (let i = 0; i < this.beatHistory.length; i++)
			avgFlux += this.beatHistory[i];
		avgFlux /= this.beatHistory.length;

		// 计算通量标准差
		let fluxVariance = 0;
		for (let i = 0; i < this.beatHistory.length; i++) {
			fluxVariance += (this.beatHistory[i] - avgFlux) ** 2;
		}
		fluxVariance /= this.beatHistory.length;
		const fluxStdDev = Math.sqrt(fluxVariance);

		// 自适应阈值 = 平均值 + 1.5倍标准差
		// 这是一种经典的节拍检测阈值算法，能适应不同音量和音乐类型
		const threshold = Math.max(0.05, avgFlux + fluxStdDev * 1.5);

		// 节拍检测：超过阈值且在冷却期外
		if (
			this.beatCooldown <= 0 &&
			smoothedFlux > threshold &&
			smoothedFlux > 0.02
		) {
			const strength = Math.min(smoothedFlux * 3, 4);
			// 在地形上随机位置生成涟漪
			const angle = Math.random() * Math.PI * 2;
			const dist = Math.random() * 20;
			const rx = Math.cos(angle) * dist;
			const rz = Math.sin(angle) * dist;
			this.events.onRipple?.(rx, rz, strength, false);
			this.events.onBeat?.(strength);
			this.beatCooldown = 20; // 约20帧冷却（~330ms @60fps）
		}

		// 流星检测：高频能量爆发
		if (this.meteorCooldown <= 0 && fluxMeteor > 0.08) {
			const strength = Math.min(fluxMeteor * 2, 1);
			this.events.onMeteor?.(strength);
			// 随机冷却 40-100 帧
			this.meteorCooldown = 40 + Math.random() * 60;
		}
	}

	/**
	 * 创建涟漪对象数组（对象池模式）
	 * 预分配对象避免GC开销
	 * @param count 涟漪数量
	 */
	static getRipplesArray(): Ripple[] {
		return new Array(10).fill(null).map(() => ({
			pos: new THREE.Vector2(),
			time: -100,
			strength: 0,
			isActive: 0,
			rippleType: 0,
		}));
	}

	/**
	 * 添加用户点击触发的涟漪
	 * @param x 点击位置X坐标
	 * @param z 点击位置Z坐标
	 */
	addClickRipple(x: number, z: number) {
		this.events.onRipple?.(x, z, 1.5, false);
	}
}
