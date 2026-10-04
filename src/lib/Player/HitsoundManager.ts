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

const softClip = (x: number): number => {
  const absX = x < 0 ? -x : x;
  if (absX < 0.5) return x;
  if (absX < 1.5) return x * (1 - x * x / 3);
  return x < 0 ? -1 : 1;
};

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
  async preSynthesize(groups: TimestampGroup[], totalDuration: number, onProgress?: (percent: number) => void): Promise<void> {
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
      this.chunkMode = true;
      this.chunkGroups = stillActive;
      this.chunkDuration = totalDuration;
      this.chunkTypeBuffers = typeBuffers;
      this.synthesizedBuffer = null;
      this.compressedBuffer = null;
      this.compressedOGGBlob = null;
      console.log(`[HitsoundManager] Chunked synthesis mode: ${totalHits} hits, ${totalDuration.toFixed(1)}s, ${stillActive.length} groups`);
      if (onProgress) onProgress(100);
      return;
    }
    this.chunkMode = false;
    this.chunkGroups = [];

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

    // Normalize
    if (onProgress) onProgress(95);
    const TARGET_HEADROOM = 0.9;
    const gain = peakAmplitude > TARGET_HEADROOM ? TARGET_HEADROOM / peakAmplitude : 1.0;
    for (let ch = 0; ch < numChannels; ch++) {
      const d = outputData[ch];
      if (gain < 1.0) {
        for (let i = 0; i < d.length; i++) d[i] = softClip(d[i] * gain);
      } else {
        for (let i = 0; i < d.length; i++) {
          const absVal = d[i] < 0 ? -d[i] : d[i];
          if (absVal > 0.5) d[i] = softClip(d[i]);
        }
      }
    }

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
    void this.scheduleChunksFrom(firstChunk, offset, startWall, gen);
  }

  private async scheduleChunksFrom(firstChunk: number, offset: number, startWall: number, gen: number): Promise<void> {
    const totalChunks = Math.ceil(this.chunkDuration / HitsoundManager.CHUNK_SEC);
    for (let k = firstChunk; k <= totalChunks; k++) {
      if (gen !== this.chunkGeneration) return;
      const buf = this.synthesizeChunk(k);
      if (buf) {
        const ctx = getSharedAudioContext();
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(this.getGainNode());
        src.onended = () => {
          try { src.disconnect(); } catch (e) { }
          const i = this.chunkSources.indexOf(src);
          if (i >= 0) this.chunkSources.splice(i, 1);
        };
        const when = startWall + (k * HitsoundManager.CHUNK_SEC - offset);
        src.start(Math.max(ctx.currentTime, when));
        this.chunkSources.push(src);
      }
      // 让出主线程，避免一次性合成全部块造成长阻塞；合成速度通常远快于实时。
      await new Promise(resolve => setTimeout(resolve, 0));
      if (gen !== this.chunkGeneration) return;
    }
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
    let windowHits = 0;
    for (const group of this.chunkGroups) {
      const ts = group.timestamps;
      const start = lowerBoundTime(ts, chunkStart);
      const end = lowerBoundTime(ts, chunkEnd);
      if (end > start) {
        windows.push({ group, start, end });
        windowHits += (end - start);
      }
    }
    if (windowHits === 0) return null;

    const stride = Math.max(1, Math.ceil(windowHits / HitsoundManager.MAX_HITS_PER_CHUNK));
    const bufferLength = Math.ceil((CHUNK + maxHitDuration + 0.1) * sampleRate);
    const outputBuffer = ctx.createBuffer(2, bufferLength, sampleRate);
    const outL = outputBuffer.getChannelData(0);
    const outR = outputBuffer.getChannelData(1);

    for (const w of windows) {
      const buf = this.chunkTypeBuffers.get(w.group.type);
      if (!buf) continue;
      const volScale = w.group.volume / 100;
      const srcL = buf.getChannelData(0);
      const srcR = buf.numberOfChannels > 1 ? buf.getChannelData(1) : srcL;
      const hitLen = Math.floor(buf.duration * sampleRate);
      const ts = w.group.timestamps;
      for (let idx = w.start; idx < w.end; idx += stride) {
        const t = ts[idx];
        if (t < chunkStart) continue;
        const startSample = Math.floor((t - chunkStart) * sampleRate);
        if (startSample >= bufferLength) break;
        const len = Math.min(hitLen, bufferLength - startSample);
        for (let i = 0; i < len; i++) {
          outL[startSample + i] += srcL[i] * volScale;
          outR[startSample + i] += srcR[i] * volScale;
        }
      }
    }

    // 限密度 + 固定软削波：避免极密段落削爆，也不做全局归一化（分块无法全局统计）。
    const softClipChunk = (d: Float32Array): void => {
      for (let i = 0; i < d.length; i++) {
        const v = d[i];
        const a = v < 0 ? -v : v;
        if (a > 0.5) d[i] = softClip(v);
      }
    };
    softClipChunk(outL);
    softClipChunk(outR);

    return outputBuffer;
  }

  dispose(): void {
    this.stop();
    this.synthesizedBuffer = null;
    this.compressedBuffer = null;
    this.compressedOGGBlob = null;
    this.gainNode = null;
    this.chunkGroups = [];
    this.chunkTypeBuffers.clear();
  }
}
