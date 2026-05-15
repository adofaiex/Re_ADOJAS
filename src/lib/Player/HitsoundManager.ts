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

export class HitsoundManager {
  private enabled: boolean = true;
  private gainNode: GainNode | null = null;

  private synthesizedBuffer: AudioBuffer | null = null;
  private synthesizedSource: AudioBufferSourceNode | null = null;
  private totalDuration: number = 0;

  private useOGGCompression: boolean = false;
  private compressedOGGBlob: Blob | null = null;
  private compressedBuffer: AudioBuffer | null = null;

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
    if (this.synthesizedSource) {
      try { this.synthesizedSource.stop(); this.synthesizedSource.disconnect(); } catch (e) { }
      this.synthesizedSource = null;
    }
  }

  isSynthesized(): boolean {
    return this.synthesizedBuffer !== null || this.compressedBuffer !== null;
  }

  dispose(): void {
    this.stop();
    this.synthesizedBuffer = null;
    this.compressedBuffer = null;
    this.compressedOGGBlob = null;
    this.gainNode = null;
  }
}
