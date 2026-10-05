/**
 * Hitsound Manager
 * Pre-synthesizes all hitsounds at level load time for accurate timing
 * Supports multiple hitsound types via per-tile overrides (SetHitsound)
 * and on-demand PlayHitsound events.
 */

import audioData from '../../sounds/audio_data.json';
import { getSharedAudioContext } from './HTMLAudioMusic';

async function compressAudioBufferToOGG(
  buffer: AudioBuffer,
  mimeType: string = 'audio/ogg;codecs=opus'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = getSharedAudioContext();
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration;

    const offlineCtx = new OfflineAudioContext(numberOfChannels, buffer.length, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    offlineCtx.startRendering().then((renderedBuffer) => {
      const destination = ctx.createMediaStreamDestination();
      const source2 = ctx.createBufferSource();
      source2.buffer = renderedBuffer;
      source2.connect(destination);
      source2.start();

      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000,
      });

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event}`));
      };

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
        source2.stop();
      }, duration * 1000 + 100);
    }).catch((error) => reject(error));
  });
}

async function loadOGGBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return getSharedAudioContext().decodeAudioData(arrayBuffer);
}

/** 把一段命中音轨按 gain 叠加到输出（限幅交给后续 tanh，不做逐样本裁剪）。 */
function mixHitInto(
  outL: Float32Array, outR: Float32Array,
  srcL: Float32Array, srcR: Float32Array,
  hitLen: number, startSample: number, gain: number, bufferLength: number
): void {
  if (startSample < 0) return;
  const len = Math.min(hitLen, bufferLength - startSample);
  for (let i = 0; i < len; i++) {
    outL[startSample + i] += srcL[i] * gain;
    outR[startSample + i] += srcR[i] * gain;
  }
}

/**
 * 离线包络限幅器（linked stereo）：阈值 TH，快 attack（2ms）、慢 release（80ms）。
 * 只在超出阈值时平滑压低增益，不产生 tanh 硬饱和那种持续削波失真
 * （"音质炸"的根因：密集段被 tanh 压成恒定 ±0.9 的饱和墙）。
 */
function limitBuffer(L: Float32Array, R: Float32Array, len: number, sampleRate: number, TH: number = 0.9): number {
  const attackCoef = 1 - Math.exp(-1 / Math.max(1, Math.floor(sampleRate * 0.002)));
  const releaseCoef = 1 - Math.exp(-1 / Math.max(1, Math.floor(sampleRate * 0.080)));
  let env = 0;
  let peak = 0;
  for (let i = 0; i < len; i++) {
    const l = L[i], r = R[i];
    const al = l < 0 ? -l : l;
    const ar = r < 0 ? -r : r;
    const a = al > ar ? al : ar;
    if (a > peak) peak = a;
    env = a > env ? env + (a - env) * attackCoef : env + (a - env) * releaseCoef;
    const g = env > TH ? TH / env : 1;
    if (g < 1) { L[i] = l * g; R[i] = r * g; }
  }
  return peak;
}

export type HitsoundType =
  | 'Kick' | 'KickHouse' | 'KickChroma' | 'KickRupture'
  | 'Snare' | 'SnareHouse' | 'SnareVapor'
  | 'Clap' | 'ClapHit' | 'ClapHitEcho'
  | 'Hat' | 'HatHouse'
  | 'Chuck' | 'Hammer'
  | 'Shaker' | 'ShakerLoud'
  | 'Sidestick' | 'Stick'
  | 'ReverbClack' | 'ReverbClap'
  | 'Squareshot'
  | 'FireTile' | 'IceTile'
  | 'PowerUp' | 'PowerDown'
  | 'VehiclePositive' | 'VehicleNegative'
  | 'Sizzle' | 'None';

const hitsoundKeyMap: Record<HitsoundType, string> = {
  'Kick': 'sndKick', 'KickHouse': 'sndKickHouse', 'KickChroma': 'sndKickChroma',
  'KickRupture': 'sndKickRupture', 'Snare': 'sndSnareAcoustic2',
  'SnareHouse': 'sndSnareHouse', 'SnareVapor': 'sndSnareVapor',
  'Clap': 'sndClapHit', 'ClapHit': 'sndClapHit', 'ClapHitEcho': 'sndClapHitEcho',
  'Hat': 'sndHat', 'HatHouse': 'sndHatHouse',
  'Chuck': 'sndChuck', 'Hammer': 'sndHammer',
  'Shaker': 'sndShaker', 'ShakerLoud': 'sndShakerLoud',
  'Sidestick': 'sndSidestick', 'Stick': 'sndStick',
  'ReverbClack': 'sndReverbClack', 'ReverbClap': 'sndReverbClap',
  'Squareshot': 'sndSquareshot',
  'FireTile': 'sndFireTile', 'IceTile': 'sndIceTile',
  'PowerUp': 'sndPowerUp', 'PowerDown': 'sndPowerDown',
  'VehiclePositive': 'sndVehiclePositive', 'VehicleNegative': 'sndVehicleNegative',
  'Sizzle': 'sndSizzle', 'None': '',
};

const audioBufferCache: Map<string, AudioBuffer> = new Map();

async function loadAudioBuffer(key: string): Promise<AudioBuffer | null> {
  if (!key) return null;
  if (audioBufferCache.has(key)) return audioBufferCache.get(key)!;

  try {
    const dataURL = (audioData as Record<string, string>)[key];
    if (!dataURL) {
      console.warn(`[HitsoundManager] Sound "${key}" not found`);
      return null;
    }

    const base64Match = dataURL.match(/^data:audio\/\w+;base64,(.+)$/);
    if (!base64Match) return null;

    const binary = atob(base64Match[1]);
    const arrayBuffer = new ArrayBuffer(binary.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binary.length; i++) uint8Array[i] = binary.charCodeAt(i);

    const audioBuffer = await getSharedAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(key, audioBuffer);
    return audioBuffer;
  } catch (e) {
    console.warn(`[HitsoundManager] Failed to load: ${key}`, e);
    return null;
  }
}

export interface TimestampGroup {
  type: HitsoundType;
  volume: number; // 0-100
  timestamps: number[]; // in seconds
}

/** 单个 worker 的当前状态（加载窗口 pacman 风格列表用）。 */
export interface HitsoundWorkerStatus {
  /** 1-based worker 序号 */
  worker: number;
  /** 正在合成的块号；-1 = 空闲 */
  chunkIndex: number;
  /** 当前块内进度 0..1 */
  progress: number;
}

/** worker 池整体状态。 */
export interface HitsoundSynthStatus {
  totalWorkers: number;
  activeWorkers: number;
  totalChunks: number;
  completedChunks: number;
  workers: HitsoundWorkerStatus[];
}

/** 二分：第一个 >= t 的下标（timestamps 升序）。 */
function lowerBoundTime(arr: number[], t: number): number {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid] < t) lo = mid + 1; else hi = mid;
  }
  return lo;
}

export class HitsoundManager {
  private enabled: boolean = true;
  private gainNode: GainNode | null = null;

  private synthesizedBuffer: AudioBuffer | null = null;
  private synthesizedSource: AudioBufferSourceNode | null = null;
  private totalDuration: number = 0;

  private useOGGCompression: boolean = false;
  private compressedOGGBlob: Blob | null = null;
  private compressedBuffer: AudioBuffer | null = null;

  // ── 超大物量谱的分块按需合成 ───────────────────────────────
  // 100 万砖的谱面（Singularity 99.7 万）整曲逐采样混音是数十亿次运算，主线程
  // 直接卡死；OGG 压缩只减小存储、救不了合成。命中数/时长超限时改为按 10s 块
  // 合成：每块只混该窗口内的命中（并限制密度），随播放进度调度，内存/CPU 有界。
  private chunkMode: boolean = false;
  private chunkGroups: TimestampGroup[] = [];
  private chunkDuration: number = 0;
  private chunkSources: AudioBufferSourceNode[] = [];
  private chunkGeneration: number = 0;
  private chunkTypeBuffers: Map<HitsoundType, AudioBuffer> = new Map();
  private static readonly CHUNK_SEC = 10;
  private static readonly MAX_HITS_PER_CHUNK = 6000;
  private static readonly CHUNK_MODE_HIT_THRESHOLD = 250000;
  private static readonly CHUNK_MODE_DURATION_THRESHOLD = 900; // 15 分钟
  /** 加载期预合成并缓存的块数上限（10s/块 → 400s）。超出的块播放时按需合成。 */
  private static readonly CHUNK_CACHE_MAX = 40;
  /** 按需调度前瞻块数：只合成/调度播放头前方这么多块（每块 10s）。 */
  private static readonly SCHEDULE_LOOKAHEAD_CHUNKS = 3;

  // 分块合成的 worker 池：把逐采样混音移出主线程（每块 10s 窗口一个 job，
  // 最多 pool 个块并行合成）。初始化失败时降级为主线程同步合成。
  private workers: Worker[] | null = null;
  private workersReady: boolean = false;
  private workerInitPromise: Promise<boolean> | null = null;
  private nextWorker: number = 0;
  private workerSampleRate: number = 0;
  private workerMaxHitDuration: number = 0;

  // 进度上报（UI 列表）
  private onWorkerStatus: ((s: HitsoundSynthStatus) => void) | null = null;
  private workerSlots: { chunkIndex: number; progress: number }[] = [];
  private synthTotalChunks: number = 0;
  private synthCompletedChunks: number = 0;
  private lastWorkerStatusEmit: number = 0;
  // 调度诊断计数（__adojasHitsound）
  private _jobsPosted: number = 0;
  private _jobsDone: number = 0;
  private _scheduledSources: number = 0;
  private _syncFallbackUsed: boolean = false;
  private _syncChunksMixed: number = 0;
  private _schedActive: boolean = false;
  /** 按需调度状态（startChunked 建立；stop/seek 置空）。 */
  private _schedState: {
    gen: number;
    offset: number;
    startWall: number;
    nextChunk: number;
    playheadChunk: number;
    totalChunks: number;
  } | null = null;
  /** 加载期预合成的块缓存（播放时直接取用；播放中按窗口淘汰）。 */
  private chunkCache: Map<number, AudioBuffer> = new Map();
  /** 最近若干块的峰值（诊断高 BPM 段是否被削平/异常）。 */
  private _chunkPeaks: { chunk: number; peak: number }[] = [];
  /** 全量合成下因播放头追上而丢弃的迟到块数（诊断；正常应为 0）。 */
  private _lateChunksDropped: number = 0;

  constructor(private defaultType: HitsoundType = 'Kick', private defaultVolume: number = 100, useOGGCompression: boolean = false) {
    this.useOGGCompression = useOGGCompression;
  }

  setOGGCompression(enabled: boolean): void { this.useOGGCompression = enabled; }
  isOGGCompressionEnabled(): boolean { return this.useOGGCompression; }

  private getGainNode(): GainNode {
    if (!this.gainNode) {
      const ctx = getSharedAudioContext();
      this.gainNode = ctx.createGain();
      this.gainNode.connect(ctx.destination);
    }
    return this.gainNode;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stop();
  }
  isEnabled(): boolean { return this.enabled; }

  /**
   * Load a hitsound AudioBuffer by type
   */
  private async loadByType(type: HitsoundType): Promise<AudioBuffer | null> {
    if (type === 'None') return null;
    const key = hitsoundKeyMap[type];
    return key ? loadAudioBuffer(key) : null;
  }

  /**
   * Pre-synthesize hitsounds from grouped timestamps.
   * Each group has a hitsound type and volume. All groups are mixed into one buffer.
   */
  async preSynthesize(groups: TimestampGroup[], totalDuration: number, onProgress?: (percent: number) => void, onWorkerStatus?: (s: HitsoundSynthStatus) => void): Promise<void> {
    this.onWorkerStatus = onWorkerStatus ?? null;
    if (!this.enabled) {
      if (onProgress) onProgress(100);
      return;
    }

    // Filter out None groups and empty groups
    const activeGroups = groups.filter(g => g.type !== 'None' && g.timestamps.length > 0);
    if (activeGroups.length === 0) {
      console.log('[HitsoundManager] No active hitsound groups, skipping');
      this.synthesizedBuffer = null;
      if (onProgress) onProgress(100);
      return;
    }

    this.totalDuration = totalDuration;

    const ctx = getSharedAudioContext();
    const sampleRate = ctx.sampleRate;
    const numChannels = 2; // Always stereo for mixing

    // Calculate total buffer length
    let maxHitDuration = 0;
    const typeBuffers: Map<HitsoundType, AudioBuffer> = new Map();

    // Load ALL needed buffers first
    for (const group of activeGroups) {
      const buf = await this.loadByType(group.type);
      if (!buf) {
        console.warn(`[HitsoundManager] Could not load buffer for type "${group.type}", skipping group`);
        group.type = 'None'; // Mark for skipping
        continue;
      }
      typeBuffers.set(group.type, buf);
      if (buf.duration > maxHitDuration) maxHitDuration = buf.duration;
    }

    const stillActive = activeGroups.filter(g => g.type !== 'None');
    if (stillActive.length === 0) {
      this.synthesizedBuffer = null;
      if (onProgress) onProgress(100);
      return;
    }

    const bufferLength = Math.ceil((totalDuration + maxHitDuration + 1) * sampleRate);
    const maxBufferSize = 2147483647;
    if (bufferLength > maxBufferSize) {
      console.error('[HitsoundManager] Buffer too large:', bufferLength);
      this.synthesizedBuffer = null;
      if (onProgress) onProgress(100);
      return;
    }

    console.log(`[HitsoundManager] Synthesizing ${stillActive.length} type groups, buffer=${bufferLength} samples`);
    if (onProgress) onProgress(5);

    const startTime = performance.now();
    const outputBuffer = ctx.createBuffer(numChannels, bufferLength, sampleRate);
    const outputData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      outputData.push(outputBuffer.getChannelData(ch));
    }

    // Count total hits across all groups for progress tracking
    let totalHits = 0;
    for (const group of stillActive) totalHits += group.timestamps.length;

    // 超大物量保护：整曲逐采样混音是 hits × 采样长 × 声道 的运算量（百万砖谱
    // 可达数十亿次），会卡死主线程；OGG 压缩只减小存储，救不了合成。命中数或
    // 时长超限时切换为分块按需合成（见字段注释）。
    if (totalHits > HitsoundManager.CHUNK_MODE_HIT_THRESHOLD
        || totalDuration > HitsoundManager.CHUNK_MODE_DURATION_THRESHOLD) {
      // ── 并行分块合成 → 折叠成一条连续 buffer ─────────────────────
      // 之前"按需调度/流式调度"的竞态反复出问题（轮到某块没合成→静音；
      // 迟到块 max(now,when) 叠播→爆音）。这里换最简单的思路：
      //   把整首谱按 10s 切块，轮流丢给 worker 池并行合成；
      //   每块合成完按 10s 时间线叠加进唯一的连续 buffer；
      //   最后统一限幅一次；播放就是普通单个 AudioBuffer。
      // 不存在任何播放期合成/调度，因而结构上不可能缺段。
      this.chunkMode = false;
      this.chunkGroups = stillActive;
      this.chunkDuration = totalDuration;
      this.chunkTypeBuffers = typeBuffers;
      this.synthTotalChunks = Math.ceil(totalDuration / HitsoundManager.CHUNK_SEC) + 1;
      this.synthCompletedChunks = 0;

      const foldBuffer = ctx.createBuffer(numChannels, bufferLength, sampleRate);
      const foldL = foldBuffer.getChannelData(0);
      const foldR = foldBuffer.getChannelData(1);
      const useWorkers = await this.ensureWorkers();
      const chunkCount = this.synthTotalChunks;
      const wave = useWorkers ? Math.max(1, this.workers?.length ?? 1) : 1;
      console.log(`[HitsoundManager] Parallel chunk synthesis → fold: ${totalHits} hits, ${totalDuration.toFixed(1)}s, chunks=${chunkCount}, workers=${this.workers?.length ?? 0}`);

      for (let base = 0; base < chunkCount; base += wave) {
        const jobs: Promise<AudioBuffer | null>[] = [];
        const end = Math.min(base + wave, chunkCount);
        for (let k = base; k < end; k++) {
          jobs.push(useWorkers ? this.synthesizeChunkWorker(k) : Promise.resolve(this.synthesizeChunk(k)));
        }
        const results = await Promise.all(jobs);
        for (let i = 0; i < results.length; i++) {
          const buf = results[i];
          if (!buf) continue;
          const at = Math.floor((base + i) * HitsoundManager.CHUNK_SEC * sampleRate);
          const len = Math.min(buf.length, bufferLength - at);
          if (len <= 0) continue;
          const l = buf.getChannelData(0);
          const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l;
          for (let j = 0; j < len; j++) {
            foldL[at + j] += l[j];
            foldR[at + j] += r[j];
          }
        }
        this.synthCompletedChunks = end;
        this.emitWorkerStatus(true);
        if (onProgress) onProgress(5 + (end / chunkCount) * 90);
        await new Promise(r => setTimeout(r, 0));
      }

      // 整条 buffer 统一包络限幅（平滑压增益，无 tanh 饱和失真）
      const foldPeak = limitBuffer(foldL, foldR, bufferLength, sampleRate);
      this.synthesizedBuffer = foldBuffer;
      this.compressedBuffer = null;
      this.compressedOGGBlob = null;
      this.onWorkerStatus = null;
      console.log(`[HitsoundManager] Fold complete, peak=${foldPeak.toFixed(2)}`);
      if (onProgress) onProgress(100);
      return;
    }
    this.chunkMode = false;
    this.chunkGroups = [];
    this.onWorkerStatus = null;

    let processedHits = 0;
    let peakAmplitude = 0;
    const CHUNK_SIZE = 100000;

    // Process each type group
    for (const group of stillActive) {
      const buf = typeBuffers.get(group.type)!;
      const volScale = group.volume / 100;
      const hitSrcData: Float32Array[] = [];
      for (let ch = 0; ch < Math.min(buf.numberOfChannels, numChannels); ch++) {
        hitSrcData.push(buf.getChannelData(ch));
      }
      const hitLen = Math.floor(buf.duration * sampleRate);
      const timestamps = group.timestamps;

      // Process in chunks for large groups
      for (let chunkStart = 0; chunkStart < timestamps.length; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, timestamps.length);

        for (let idx = chunkStart; idx < chunkEnd; idx++) {
          const t = timestamps[idx];
          if (t < 0) continue;
          const startSample = Math.floor(t * sampleRate);
          const len = Math.min(hitLen, bufferLength - startSample);

          for (let ch = 0; ch < numChannels; ch++) {
            const src = hitSrcData[Math.min(ch, hitSrcData.length - 1)];
            const dst = outputData[ch];
            for (let i = 0; i < len; i++) {
              const val = dst[startSample + i] + src[i] * volScale;
              dst[startSample + i] = val;
              const absVal = val < 0 ? -val : val;
              if (absVal > peakAmplitude) peakAmplitude = absVal;
            }
          }
        }

        processedHits += (chunkEnd - chunkStart);
        if (onProgress) {
          onProgress(5 + (processedHits / totalHits) * 85);
        }
        if (timestamps.length > CHUNK_SIZE) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
      }
    }

    console.log(`[HitsoundManager] Mixed ${processedHits} hits in ${((performance.now() - startTime) / 1000).toFixed(2)}s, peak=${peakAmplitude.toFixed(2)}`);

    // 整曲包络限幅（平滑压增益，无 tanh 饱和失真）
    if (onProgress) onProgress(95);
    limitBuffer(outputData[0], outputData[1], bufferLength, sampleRate);

    this.synthesizedBuffer = outputBuffer;

    // OGG compression
    if (this.useOGGCompression && this.synthesizedBuffer) {
      try {
        console.log('[HitsoundManager] Compressing to OGG...');
        this.compressedOGGBlob = await compressAudioBufferToOGG(this.synthesizedBuffer);
        this.compressedBuffer = await loadOGGBlob(this.compressedOGGBlob);
        this.synthesizedBuffer = null;
      } catch (error) {
        console.error('[HitsoundManager] OGG compression failed:', error);
      }
    }

    if (onProgress) onProgress(100);
    console.log(`[HitsoundManager] Pre-synthesis complete, duration=${totalDuration.toFixed(2)}s`);
  }

  start(delay: number = 0): void {
    if (!this.enabled) return;
    this.stop();

    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if (this.chunkMode) {
      this.startChunked(0, delay);
      return;
    }

    const playBuf = this.compressedBuffer || this.synthesizedBuffer;
    if (!playBuf) return;

    this.synthesizedSource = ctx.createBufferSource();
    this.synthesizedSource.buffer = playBuf;
    this.synthesizedSource.connect(this.getGainNode());
    this.synthesizedSource.onended = () => {
      if (this.synthesizedSource) {
        try { this.synthesizedSource.disconnect(); } catch (e) { }
        this.synthesizedSource = null;
      }
    };
    this.synthesizedSource.start(ctx.currentTime + delay);
  }

  startAtOffset(offset: number): void {
    if (!this.enabled) return;
    this.stop();

    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if (this.chunkMode) {
      this.startChunked(Math.max(0, offset), 0);
      return;
    }

    const playBuf = this.compressedBuffer || this.synthesizedBuffer;
    if (!playBuf) return;

    const remaining = playBuf.duration - offset;
    if (remaining <= 0) return;

    this.synthesizedSource = ctx.createBufferSource();
    this.synthesizedSource.buffer = playBuf;
    this.synthesizedSource.connect(this.getGainNode());
    this.synthesizedSource.onended = () => {
      if (this.synthesizedSource) {
        try { this.synthesizedSource.disconnect(); } catch (e) { }
        this.synthesizedSource = null;
      }
    };
    this.synthesizedSource.start(0, offset, remaining);
  }

  stop(): void {
    // 取消分块调度循环并停掉所有块音源
    this.chunkGeneration++;
    this._schedState = null;
    if (this.chunkSources.length > 0) {
      for (const s of this.chunkSources) {
        try { s.stop(); s.disconnect(); } catch (e) { }
      }
      this.chunkSources = [];
    }
    if (this.synthesizedSource) {
      try { this.synthesizedSource.stop(); this.synthesizedSource.disconnect(); } catch (e) { }
      this.synthesizedSource = null;
    }
  }

  isSynthesized(): boolean {
    if (this.chunkMode) return this.chunkGroups.length > 0;
    return this.synthesizedBuffer !== null || this.compressedBuffer !== null;
  }

  /**
   * 分块模式播放：从 offset（秒）开始，第一块在 currentTime+delay 出声。
   * 逐块合成并在后台连续调度；stop()/seek 通过 chunkGeneration 取消。
   */
  private startChunked(offset: number, delay: number): void {
    const ctx = getSharedAudioContext();
    const gen = ++this.chunkGeneration;
    const startWall = ctx.currentTime + Math.max(0, delay);
    const firstChunk = Math.max(0, Math.floor(offset / HitsoundManager.CHUNK_SEC));
    this._schedState = {
      gen,
      offset,
      startWall,
      nextChunk: firstChunk,
      playheadChunk: firstChunk,
      totalChunks: Math.ceil(this.chunkDuration / HitsoundManager.CHUNK_SEC),
    };
    void this.pumpChunkScheduling();
  }

  /** 播放推进时调用（每帧）：把调度泵到 playhead + 前瞻块数。 */
  public update(timeInLevelSec: number): void {
    const st = this._schedState;
    if (!st || !this.chunkMode) return;
    st.playheadChunk = Math.floor(timeInLevelSec / HitsoundManager.CHUNK_SEC);
    // 已领先于前瞻：什么都不做（否则每帧空跑 pump → 每帧 emitWorkerStatus →
    // 加载窗口的 setLoadingWorkers 会在播放期每帧触发一次整页 React 重渲染）。
    const limit = Math.min(st.totalChunks, st.playheadChunk + HitsoundManager.SCHEDULE_LOOKAHEAD_CHUNKS);
    if (st.nextChunk > limit) return;
    if (!this._schedActive) {
      void this.pumpChunkScheduling();
    }
  }

  /**
   * 按需调度：只合成/调度播放头前方 SCHEDULE_LOOKAHEAD_CHUNKS 块。
   * 旧实现从播放开始就把整首谱的块全部合成并创建音源（长谱 = 启动 CPU 爆发、
   * 大量常驻 AudioBuffer、worker 长时间占满 CPU）；现在随播放推进逐块泵，
   * 空闲时 worker 完全不工作。
   */
  private async pumpChunkScheduling(): Promise<void> {
    const st = this._schedState;
    if (!st || this._schedActive) return;
    this._schedActive = true;
    try {
      const useWorkers = await this.ensureWorkers();
      let didWork = false;
      // 全量合成：不再只看播放头前方 N 块，后台一路合成到结尾并按时排好。
      // （按需合成在密集段"轮到该块时还没合成出来"会整段静音；全量合成把该风险归零。）
      while (this._schedState === st && st.gen === this.chunkGeneration) {
        if (st.nextChunk >= st.totalChunks) break;
        didWork = true;
        const k = st.nextChunk;
        let buf: AudioBuffer | null = this.chunkCache.get(k) ?? null;
        if (!buf) {
          if (useWorkers) {
            buf = await this.synthesizeChunkWorker(k);
          } else {
            this._syncFallbackUsed = true;
            buf = this.synthesizeChunk(k);
            if (buf) this._syncChunksMixed++;
          }
        }
        if (this._schedState !== st || st.gen !== this.chunkGeneration) break;
        st.nextChunk = k + 1;
        if (buf) this.scheduleChunkSource(k, buf, st.offset, st.startWall);
        // 播放窗口外的旧块淘汰，限制内存
        if (k >= 3) this.chunkCache.delete(k - 3);
        // 让出主线程，避免连续合成造成长阻塞（worker 路径的 await 已让出）
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      if (didWork) this.emitWorkerStatus(true);
    } finally {
      this._schedActive = false;
    }
  }

  /** 懒加载 worker 池。返回 false 表示应走主线程同步合成。 */
  private ensureWorkers(): Promise<boolean> {
    if (this.workerInitPromise) return this.workerInitPromise;
    this.workerInitPromise = (async () => {
      try {
        if (typeof Worker === 'undefined' || this.chunkTypeBuffers.size === 0) return false;
        const cores = (navigator as any)?.hardwareConcurrency || 4;
        const count = Math.max(1, Math.min(3, cores - 1));
        const sampleRate = getSharedAudioContext().sampleRate;
        let maxHitDuration = 0;
        for (const buf of this.chunkTypeBuffers.values()) {
          if (buf.duration > maxHitDuration) maxHitDuration = buf.duration;
        }
        this.workerSampleRate = sampleRate;
        this.workerMaxHitDuration = maxHitDuration;

        const workers: Worker[] = [];
        const ready: Promise<boolean>[] = [];
        for (let i = 0; i < count; i++) {
          const w = new Worker(new URL('./hitsoundSynthWorker.ts', import.meta.url), { type: 'module' });
          workers.push(w);
          ready.push(new Promise<boolean>((resolve) => {
            const onMsg = (e: MessageEvent): void => {
              if (e.data?.type === 'ready') {
                w.removeEventListener('message', onMsg);
                resolve(true);
              }
            };
            w.addEventListener('message', onMsg);
            w.addEventListener('error', () => {
              w.removeEventListener('message', onMsg);
              resolve(false);
            }, { once: true });
            // 每个 worker 需要自己的样本副本（同一个 ArrayBuffer 只能 transfer 一次）
            const buffers: { type: string; L: Float32Array; R: Float32Array }[] = [];
            const transfer: Transferable[] = [];
            for (const [type, buf] of this.chunkTypeBuffers) {
              const L = new Float32Array(buf.getChannelData(0));
              const R = new Float32Array(buf.numberOfChannels > 1 ? buf.getChannelData(1) : buf.getChannelData(0));
              buffers.push({ type, L, R });
              transfer.push(L.buffer, R.buffer);
            }
            w.postMessage({ type: 'init', sampleRate, buffers }, transfer);
          }));
        }
        const results = await Promise.all(ready);
        // 只保留 init 成功的 worker（否则 round-robin 派活会卡在死掉的 worker 上）
        const alive: Worker[] = [];
        for (let i = 0; i < workers.length; i++) {
          if (results[i]) alive.push(workers[i]);
          else { try { workers[i].terminate(); } catch (e) { } }
        }
        if (alive.length === 0) return false;
        this.workers = alive;
        this.workersReady = true;
        this.workerSlots = alive.map(() => ({ chunkIndex: -1, progress: 0 }));
        console.log(`[HitsoundManager] chunk synth workers ready: ${alive.length}`);
        this.emitWorkerStatus(true);
        return true;
      } catch (e) {
        console.warn('[HitsoundManager] worker pool init failed, falling back to sync synthesis', e);
        return false;
      }
    })();
    return this.workerInitPromise;
  }

  /**
   * 加载期预热：用 worker 池并行预合成前 CHUNK_CACHE_MAX 块并缓存。
   * onProgress 以 5→100 表示预热进度（映射到调用方加载条区间）。
   */
  private async warmUpChunks(onProgress?: (percent: number) => void): Promise<void> {
    const useWorkers = await this.ensureWorkers();
    if (!useWorkers) return; // 无 worker：播放时按同步路径合成
    const limit = Math.min(this.synthTotalChunks, HitsoundManager.CHUNK_CACHE_MAX);
    if (limit <= 0) return;
    const pool = Math.max(1, this.workers?.length ?? 1);
    let next = 0;
    let done = 0;
    const inFlight: Promise<void>[] = [];
    const launch = (): void => {
      while (inFlight.length < pool && next < limit) {
        const k = next++;
        inFlight.push(this.synthesizeChunkWorker(k).then((buf) => {
          if (buf) this.chunkCache.set(k, buf);
          done++;
          if (onProgress) onProgress(5 + (done / limit) * 95);
        }));
      }
    };
    launch();
    while (inFlight.length > 0) {
      await inFlight.shift();
      launch();
    }
  }

  /** 节流上报 worker 池状态（~100ms，防止 React 每条进度消息重渲染）。 */
  private emitWorkerStatus(force: boolean = false): void {
    const cb = this.onWorkerStatus;
    if (!cb) return;
    const now = performance.now();
    if (!force && now - this.lastWorkerStatusEmit < 100) return;
    this.lastWorkerStatusEmit = now;
    const workers = this.workerSlots.map((s, i) => ({
      worker: i + 1,
      chunkIndex: s.chunkIndex,
      progress: s.progress,
    }));
    cb({
      totalWorkers: workers.length,
      activeWorkers: workers.reduce((n, w) => n + (w.chunkIndex >= 0 ? 1 : 0), 0),
      totalChunks: this.synthTotalChunks,
      completedChunks: this.synthCompletedChunks,
      workers,
    });
  }

  private scheduleChunkSource(chunkIndex: number, buf: AudioBuffer, offset: number, startWall: number): void {
    const ctx = getSharedAudioContext();
    const when = startWall + (chunkIndex * HitsoundManager.CHUNK_SEC - offset);
    // 全量合成下唯一可能的异常：某块合成完成时它的起播时刻已经过去（播放头追上了）。
    // 这时直接丢弃——绝不能 max(now, when) 起播，否则多个迟到块会叠在一起（爆音）。
    if (when < ctx.currentTime - 0.05) {
      this._lateChunksDropped++;
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.getGainNode());
    this._scheduledSources++;
    src.onended = () => {
      try { src.disconnect(); } catch (e) { }
      const i = this.chunkSources.indexOf(src);
      if (i >= 0) this.chunkSources.splice(i, 1);
    };
    src.start(when);
    this.chunkSources.push(src);
  }

  /** 在 worker 里合成第 k 块，返回可直接播放的 AudioBuffer。 */
  private synthesizeChunkWorker(chunkIndex: number): Promise<AudioBuffer | null> {
    const workers = this.workers;
    if (!workers || workers.length === 0) return Promise.resolve(null);
    const workerIdx = this.nextWorker++ % workers.length;
    const w = workers[workerIdx];
    const CHUNK = HitsoundManager.CHUNK_SEC;
    const chunkStart = chunkIndex * CHUNK;
    const chunkEnd = chunkStart + CHUNK;

    const jobs: { type: string; volume: number; timestamps: Float64Array }[] = [];
    for (const group of this.chunkGroups) {
      const ts = group.timestamps;
      const start = lowerBoundTime(ts, chunkStart);
      const end = lowerBoundTime(ts, chunkEnd);
      if (end > start) {
        jobs.push({
          type: group.type,
          volume: group.volume,
          timestamps: Float64Array.from(ts.slice(start, end)),
        });
      }
    }
    if (jobs.length === 0) return Promise.resolve(null);

    const bufferLength = Math.ceil((CHUNK + this.workerMaxHitDuration + 0.1) * this.workerSampleRate);
    this._jobsPosted++;
    return new Promise<AudioBuffer | null>((resolve) => {
      const onMsg = (ev: MessageEvent): void => {
        if (ev.data?.chunkIndex !== chunkIndex) return;
        if (ev.data?.type === 'progress') {
          const slot = this.workerSlots[workerIdx];
          if (slot) {
            slot.chunkIndex = chunkIndex;
            slot.progress = ev.data.progress as number;
          }
          this.emitWorkerStatus();
          return;
        }
        if (ev.data?.type !== 'chunk') return;
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
        const slot = this.workerSlots[workerIdx];
        if (slot) {
          slot.progress = 1;
          slot.chunkIndex = -1;
        }
        this.synthCompletedChunks++;
        this.emitWorkerStatus(true);
        this.recordChunkPeak(chunkIndex, Number(ev.data.peak) || 0);
        this._jobsDone++;
        try {
          const ctx = getSharedAudioContext();
          const out = ctx.createBuffer(2, bufferLength, this.workerSampleRate);
          out.copyToChannel(new Float32Array(ev.data.L), 0);
          out.copyToChannel(new Float32Array(ev.data.R), 1);
          resolve(out);
        } catch (e) {
          resolve(null);
        }
      };
      // worker 崩溃时 resolve(null)：不能永远挂住按序等待的调度循环。
      const onErr = (): void => {
        w.removeEventListener('message', onMsg);
        const slot = this.workerSlots[workerIdx];
        if (slot) { slot.progress = 0; slot.chunkIndex = -1; }
        this.emitWorkerStatus(true);
        resolve(null);
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr, { once: true });
      w.postMessage({
        type: 'chunk',
        chunkIndex,
        chunkStart,
        bufferLength,
        maxHits: HitsoundManager.MAX_HITS_PER_CHUNK,
        jobs,
      });
    });
  }

  /** 合成第 k 块（10s 窗口 + 命中尾音），只混该窗口内的命中并限密度。 */
  private synthesizeChunk(chunkIndex: number): AudioBuffer | null {
    const ctx = getSharedAudioContext();
    const sampleRate = ctx.sampleRate;
    const CHUNK = HitsoundManager.CHUNK_SEC;
    const chunkStart = chunkIndex * CHUNK;
    const chunkEnd = chunkStart + CHUNK;

    let maxHitDuration = 0;
    for (const buf of this.chunkTypeBuffers.values()) {
      if (buf.duration > maxHitDuration) maxHitDuration = buf.duration;
    }

    const windows: { group: TimestampGroup; start: number; end: number }[] = [];
    for (const group of this.chunkGroups) {
      const ts = group.timestamps;
      const start = lowerBoundTime(ts, chunkStart);
      const end = lowerBoundTime(ts, chunkEnd);
      if (end > start) windows.push({ group, start, end });
    }
    if (windows.length === 0) return null;

    const bufferLength = Math.ceil((CHUNK + maxHitDuration + 0.1) * sampleRate);
    const outputBuffer = ctx.createBuffer(2, bufferLength, sampleRate);
    const outL = outputBuffer.getChannelData(0);
    const outR = outputBuffer.getChannelData(1);
    const bucketSamples = Math.max(1, Math.floor(sampleRate * 0.001)); // 1ms 密度桶

    for (const w of windows) {
      const buf = this.chunkTypeBuffers.get(w.group.type);
      if (!buf) continue;
      const volScale = w.group.volume / 100;
      const srcL = buf.getChannelData(0);
      const srcR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : srcL;
      const hitLen = Math.floor(buf.duration * sampleRate);
      const ts = w.group.timestamps;

      // 密度合并（与 worker 路径一致）：同一 1ms 桶只混一次、振幅 ×1/√k。
      // 不再按 stride 抽稀（那会直接漏音）；低 BPM（间隔 >1ms）逐击混音不变。
      let curBucket = -1;
      let curCount = 0;
      let curSample = -1;
      for (let idx = w.start; idx < w.end; idx++) {
        const t = ts[idx];
        if (t < chunkStart) continue;
        const startSample = Math.floor((t - chunkStart) * sampleRate);
        if (startSample >= bufferLength) break;
        const bucket = Math.floor(startSample / bucketSamples);
        if (bucket !== curBucket) {
          if (curCount > 0) {
            mixHitInto(outL, outR, srcL, srcR, hitLen, curSample, volScale / Math.sqrt(curCount), bufferLength);
          }
          curBucket = bucket;
          curCount = 1;
          curSample = startSample;
        } else {
          curCount++;
        }
      }
      if (curCount > 0) {
        mixHitInto(outL, outR, srcL, srcR, hitLen, curSample, volScale / Math.sqrt(curCount), bufferLength);
      }
    }

    // tanh 软限幅：峰值 ≤0.9 的块完全不动；超过则平滑饱和。
    // （旧逻辑按峰值整体缩放会把稀疏段一起压暗 → 听不到；只 softClip 会硬削波 → 爆音。）
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const al = outL[i] < 0 ? -outL[i] : outL[i];
      if (al > peak) peak = al;
      const ar = outR[i] < 0 ? -outR[i] : outR[i];
      if (ar > peak) peak = ar;
    }
    const TH = 0.9;
    if (peak > TH) {
      const invTH = 1 / TH;
      for (let i = 0; i < bufferLength; i++) {
        outL[i] = TH * Math.tanh(outL[i] * invTH);
        outR[i] = TH * Math.tanh(outR[i] * invTH);
      }
    }
    this.recordChunkPeak(chunkIndex, peak);

    return outputBuffer;
  }

  /** 记录块峰值（诊断用，保留最近 64 块）。 */
  private recordChunkPeak(chunk: number, peak: number): void {
    this._chunkPeaks.push({ chunk, peak });
    if (this._chunkPeaks.length > 64) this._chunkPeaks.shift();
  }

  /** 诊断快照：__adojasHitsound() 用（分块模式/缓存/音源/各块峰值）。 */
  public debugSnapshot(): any {
    return {
      chunkMode: this.chunkMode,
      durationSec: +this.chunkDuration.toFixed(1),
      totalChunks: this.synthTotalChunks,
      cachedChunks: this.chunkCache.size,
      activeSources: this.chunkSources.length,
      workers: this.workers?.length ?? 0,
      workersReady: this.workersReady,
      schedulingActive: this._schedActive,
      syncFallbackUsed: this._syncFallbackUsed,
      syncChunksMixed: this._syncChunksMixed,
      jobsPosted: this._jobsPosted,
      jobsDone: this._jobsDone,
      scheduledSources: this._scheduledSources,
      lastPeaks: this._chunkPeaks.slice(-16).map(p => `#${p.chunk}:${p.peak.toFixed(2)}`).join(' '),
    };
  }

  dispose(): void {
    this.stop();
    this.synthesizedBuffer = null;
    this.compressedBuffer = null;
    this.compressedOGGBlob = null;
    this.gainNode = null;
    this.chunkGroups = [];
    this.chunkTypeBuffers.clear();
    this.chunkCache.clear();
    if (this.workers) {
      for (const w of this.workers) { try { w.terminate(); } catch (e) { } }
      this.workers = null;
      this.workersReady = false;
    }
  }
}
