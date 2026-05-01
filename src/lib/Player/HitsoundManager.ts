/**
 * Hitsound Manager
 * Pre-synthesizes all hitsounds at level load time for accurate timing
 * For very large hit counts, falls back to real-time playback mode
 */

// Static import of audio data JSON (Vite handles this at build time)
import audioData from '../../sounds/audio_data.json';
import { getSharedAudioContext } from './HTMLAudioMusic';

// Pre-synthesis mode only - real-time mode removed due to performance concerns

/**
 * Compress AudioBuffer to OGG format using MediaRecorder
 * This reduces memory usage significantly for large hit counts
 * @param buffer The AudioBuffer to compress
 * @param mimeType The MIME type for encoding (default: audio/ogg; codecs=opus)
 * @returns Promise<Blob> The compressed OGG blob
 */
async function compressAudioBufferToOGG(
  buffer: AudioBuffer,
  mimeType: string = 'audio/ogg;codecs=opus'
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const ctx = getSharedAudioContext();
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const duration = buffer.duration;

    // Create a new AudioBuffer for the offline context
    const offlineCtx = new OfflineAudioContext(numberOfChannels, buffer.length, sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineCtx.destination);
    source.start();

    // Render the audio
    offlineCtx.startRendering().then((renderedBuffer) => {
      // Create a MediaStreamDestination
      const destination = ctx.createMediaStreamDestination();
      const source2 = ctx.createBufferSource();
      source2.buffer = renderedBuffer;
      source2.connect(destination);
      source2.start();

      // Use MediaRecorder to record the audio
      const mediaRecorder = new MediaRecorder(destination.stream, {
        mimeType: mimeType,
        audioBitsPerSecond: 128000, // 128 kbps for good quality
      });

      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        resolve(blob);
      };

      mediaRecorder.onerror = (event) => {
        reject(new Error(`MediaRecorder error: ${event}`));
      };

      // Start recording
      mediaRecorder.start();

      // Stop recording when the audio finishes playing
      setTimeout(() => {
        mediaRecorder.stop();
        source2.stop();
      }, duration * 1000 + 100); // Add 100ms buffer
    }).catch((error) => {
      reject(error);
    });
  });
}

/**
 * Load OGG Blob as AudioBuffer
 * @param blob The OGG blob to load
 * @returns Promise<AudioBuffer> The decoded AudioBuffer
 */
async function loadOGGBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  return getSharedAudioContext().decodeAudioData(arrayBuffer);
}

/**
 * Soft clipping function - shared across all processing paths
 * Uses polynomial approximation of tanh for smooth saturation
 * @param x Input sample value
 * @returns Soft-clipped output in range [-1, 1]
 */
const softClip = (x: number): number => {
  const absX = x < 0 ? -x : x;
  if (absX < 0.5) return x;  // Linear region - no distortion
  if (absX < 1.5) return x * (1 - x * x / 3);  // Soft clipping region
  return x < 0 ? -1 : 1;  // Hard limit for extreme values
};

// Available hitsound types
export type HitsoundType =
  | 'Kick'
  | 'KickHouse'
  | 'KickChroma'
  | 'KickRupture'
  | 'Snare'
  | 'SnareHouse'
  | 'SnareVapor'
  | 'Clap'
  | 'ClapHit'
  | 'ClapHitEcho'
  | 'Hat'
  | 'HatHouse'
  | 'Chuck'
  | 'Hammer'
  | 'Shaker'
  | 'ShakerLoud'
  | 'Sidestick'
  | 'Stick'
  | 'ReverbClack'
  | 'ReverbClap'
  | 'Squareshot'
  | 'FireTile'
  | 'IceTile'
  | 'PowerUp'
  | 'PowerDown'
  | 'VehiclePositive'
  | 'VehicleNegative'
  | 'Sizzle'
  | 'None';

// Map hitsound type to JSON key
const hitsoundKeyMap: Record<HitsoundType, string> = {
  'Kick': 'sndKick',
  'KickHouse': 'sndKickHouse',
  'KickChroma': 'sndKickChroma',
  'KickRupture': 'sndKickRupture',
  'Snare': 'sndSnareAcoustic2',
  'SnareHouse': 'sndSnareHouse',
  'SnareVapor': 'sndSnareVapor',
  'Clap': 'sndClapHit',
  'ClapHit': 'sndClapHit',
  'ClapHitEcho': 'sndClapHitEcho',
  'Hat': 'sndHat',
  'HatHouse': 'sndHatHouse',
  'Chuck': 'sndChuck',
  'Hammer': 'sndHammer',
  'Shaker': 'sndShaker',
  'ShakerLoud': 'sndShakerLoud',
  'Sidestick': 'sndSidestick',
  'Stick': 'sndStick',
  'ReverbClack': 'sndReverbClack',
  'ReverbClap': 'sndReverbClap',
  'Squareshot': 'sndSquareshot',
  'FireTile': 'sndFireTile',
  'IceTile': 'sndIceTile',
  'PowerUp': 'sndPowerUp',
  'PowerDown': 'sndPowerDown',
  'VehiclePositive': 'sndVehiclePositive',
  'VehicleNegative': 'sndVehicleNegative',
  'Sizzle': 'sndSizzle',
  'None': '',
};

// Audio buffer cache using AudioContext
const audioBufferCache: Map<string, AudioBuffer> = new Map();

// Load audio buffer from dataURL in JSON
async function loadAudioBuffer(key: string): Promise<AudioBuffer | null> {
  if (!key) return null;
  if (audioBufferCache.has(key)) {
    return audioBufferCache.get(key)!;
  }

  try {
    const dataURL = (audioData as Record<string, string>)[key];
    if (!dataURL) {
      console.warn(`[HitsoundManager] Sound "${key}" not found in audio_data.json`);
      return null;
    }

    // Extract base64 data from dataURL
    const base64Match = dataURL.match(/^data:audio\/\w+;base64,(.+)$/);
    if (!base64Match) {
      console.warn(`[HitsoundManager] Invalid dataURL format for "${key}"`);
      return null;
    }

    const base64 = base64Match[1];
    const binary = atob(base64);
    const arrayBuffer = new ArrayBuffer(binary.length);
    const uint8Array = new Uint8Array(arrayBuffer);
    for (let i = 0; i < binary.length; i++) {
      uint8Array[i] = binary.charCodeAt(i);
    }

    const audioBuffer = await getSharedAudioContext().decodeAudioData(arrayBuffer);
    audioBufferCache.set(key, audioBuffer);
    console.log(`[HitsoundManager] Loaded "${key}" from JSON dataURL`);
    return audioBuffer;
  } catch (e) {
    console.warn(`[HitsoundManager] Failed to load audio buffer: ${key}`, e);
    return null;
  }
}

/**
 * Hitsound Manager class
 * Pre-synthesizes hitsounds at load time for perfect timing
 * Supports OGG compression to reduce memory usage
 */
export class HitsoundManager {
  private hitsoundType: HitsoundType = 'Kick';
  private volume: number = 100; // 0-100
  private enabled: boolean = true;
  private currentBuffer: AudioBuffer | null = null;
  private gainNode: GainNode | null = null;

  // Pre-synthesized hitsound track
  private synthesizedBuffer: AudioBuffer | null = null;
  private synthesizedSource: AudioBufferSourceNode | null = null;
  private scheduledTimestamps: number[] = [];
  private totalDuration: number = 0;

  // OGG compression
  private useOGGCompression: boolean = false;
  private compressedOGGBlob: Blob | null = null;
  private compressedBuffer: AudioBuffer | null = null;

  constructor(hitsoundType: HitsoundType = 'Kick', volume: number = 100, useOGGCompression: boolean = false) {
    this.hitsoundType = hitsoundType;
    this.volume = volume;
    this.useOGGCompression = useOGGCompression;
    this.preloadHitsound(hitsoundType);
  }

  /**
   * Set whether to use OGG compression for synthesized hitsounds
   */
  setOGGCompression(enabled: boolean): void {
    this.useOGGCompression = enabled;
  }

  /**
   * Check if OGG compression is enabled
   */
  isOGGCompressionEnabled(): boolean {
    return this.useOGGCompression;
  }

  private getGainNode(): GainNode {
    if (!this.gainNode) {
      const ctx = getSharedAudioContext();
      this.gainNode = ctx.createGain();
      this.gainNode.connect(ctx.destination);
    }
    this.gainNode.gain.value = this.volume / 100;
    return this.gainNode;
  }

  /**
   * Preload a hitsound
   */
  private async preloadHitsound(type: HitsoundType): Promise<void> {
    if (type === 'None') return;

    const key = hitsoundKeyMap[type];
    if (key) {
      this.currentBuffer = await loadAudioBuffer(key);
      console.log(`[HitsoundManager] Preloaded hitsound type "${type}", buffer:`, !!this.currentBuffer);
    }
  }

  /**
   * Set the hitsound type
   */
  setHitsoundType(type: HitsoundType): void {
    if (this.hitsoundType === type) return;
    this.hitsoundType = type;
    this.preloadHitsound(type);
  }

  /**
   * Set volume (0-100)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(100, volume));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume / 100;
    }
  }

  /**
   * Enable or disable hitsounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stop();
    }
  }

  /**
   * Check if hitsounds are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the current hitsound type
   */
  getHitsoundType(): HitsoundType {
    return this.hitsoundType;
  }

  /**
   * Pre-synthesize hitsound track at level load time
   * @param timestamps Array of times (in seconds) to play hitsounds
   * @param totalDuration Total duration of the level in seconds
   * @param onProgress Optional progress callback (0-100)
   */
  async preSynthesize(timestamps: number[], totalDuration: number, onProgress?: (percent: number) => void): Promise<void> {
    console.log('[HitsoundManager] preSynthesize called, timestamps:', timestamps.length, 'duration:', totalDuration);

    // Skip if disabled or hitsound type is None
    if (!this.enabled || this.hitsoundType === 'None') {
      console.log('[HitsoundManager] Skipping - enabled:', this.enabled, 'type:', this.hitsoundType);
      if (onProgress) onProgress(100);
      return;
    }

    // Store timestamps
    this.scheduledTimestamps = [...timestamps].sort((a, b) => a - b);
    this.totalDuration = totalDuration;

    // Wait for buffer to load if not ready
    if (!this.currentBuffer) {
      console.log('[HitsoundManager] Waiting for buffer to load...');
      if (onProgress) onProgress(1);
      const key = hitsoundKeyMap[this.hitsoundType];
      if (key) {
        this.currentBuffer = await loadAudioBuffer(key);
      }
    }

    if (!this.currentBuffer) {
      console.warn('[HitsoundManager] No currentBuffer');
      this.synthesizedBuffer = null;
      return;
    }

    const ctx = getSharedAudioContext();
    const sampleRate = ctx.sampleRate;
    const hitBuffer = this.currentBuffer;
    const hitDuration = hitBuffer.duration;
    const numChannels = hitBuffer.numberOfChannels;

    console.log('[HitsoundManager] Synthesizing - sampleRate:', sampleRate, 'hitDuration:', hitDuration, 'numChannels:', numChannels, 'hits:', this.scheduledTimestamps.length);

    // Calculate total buffer length (add some padding at the end for last hitsound)
    const bufferLength = Math.ceil((totalDuration + hitDuration + 1) * sampleRate);

    // Check if buffer is too large (Chrome limit is around 2^31 samples ~ 13 hours at 44.1kHz)
    const maxBufferSize = 2147483647; // 2^31 - 1
    if (bufferLength > maxBufferSize) {
      console.error('[HitsoundManager] Buffer too large:', bufferLength, 'max:', maxBufferSize);
      this.synthesizedBuffer = null;
      if (onProgress) onProgress(100);
      return;
    }

    console.log('[HitsoundManager] Buffer length:', bufferLength, 'samples, ~', (bufferLength / sampleRate / 60).toFixed(2), 'minutes');

    if (onProgress) onProgress(5);

    const startTime = performance.now();

    // Create the output buffer
    this.synthesizedBuffer = ctx.createBuffer(numChannels, bufferLength, sampleRate);

    // Get source channel data
    const hitChannelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      hitChannelData.push(hitBuffer.getChannelData(ch));
    }

    // Get output channel data
    const outputChannelData: Float32Array[] = [];
    for (let ch = 0; ch < numChannels; ch++) {
      outputChannelData.push(this.synthesizedBuffer.getChannelData(ch));
    }

    const hitLengthSamples = Math.floor(hitDuration * sampleRate);
    const totalHits = this.scheduledTimestamps.length;

    // For very large hit counts, use chunked processing with yield
    const CHUNK_SIZE = 100000; // Process 100k hits per chunk
    const isLargeHitCount = totalHits > CHUNK_SIZE;

    if (isLargeHitCount) {
      // Chunked processing for large hit counts
      console.log('[HitsoundManager] Using chunked processing for', totalHits, 'hits');

      const processChunk = (startIdx: number, endIdx: number): number => {
        let localPeak = 0;

        for (let idx = startIdx; idx < endIdx; idx++) {
          const t = this.scheduledTimestamps[idx];
          if (t < 0) continue;

          const startSample = Math.floor(t * sampleRate);
          const hitLen = Math.min(hitLengthSamples, bufferLength - startSample);

          // Use TypedArray operations for each channel
          for (let ch = 0; ch < numChannels; ch++) {
            const hitData = hitChannelData[ch];
            const outputData = outputChannelData[ch];

            // Inline mixing loop with peak tracking
            for (let i = 0; i < hitLen; i++) {
              const newVal = outputData[startSample + i] + hitData[i];
              outputData[startSample + i] = newVal;
              const absVal = newVal < 0 ? -newVal : newVal;
              if (absVal > localPeak) localPeak = absVal;
            }
          }
        }

        return localPeak;
      };

      let peakAmplitude = 0;
      let processedHits = 0;

      // Process in chunks with async yields
      for (let chunkStart = 0; chunkStart < totalHits; chunkStart += CHUNK_SIZE) {
        const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalHits);

        // Process this chunk
        const chunkPeak = processChunk(chunkStart, chunkEnd);
        if (chunkPeak > peakAmplitude) peakAmplitude = chunkPeak;

        processedHits += (chunkEnd - chunkStart);

        // Yield to main thread and update progress
        if (onProgress) {
          const progress = 5 + (processedHits / totalHits) * 85;
          onProgress(Math.min(90, Math.round(progress)));
        }

        // Yield to main thread every chunk to prevent UI freeze
        await new Promise(resolve => setTimeout(resolve, 0));
      }

      console.log('[HitsoundManager] Processed', processedHits, 'hits in', ((performance.now() - startTime) / 1000).toFixed(2), 's, peak:', peakAmplitude.toFixed(2));

      // Apply normalization and soft clipping (using shared softClip function)
      if (onProgress) onProgress(95);

      const TARGET_HEADROOM = 0.9;
      const gainReduction = peakAmplitude > TARGET_HEADROOM ? TARGET_HEADROOM / peakAmplitude : 1.0;

      // Apply to all channels in chunks to yield
      for (let ch = 0; ch < numChannels; ch++) {
        const outputData = outputChannelData[ch];
        const APPLY_CHUNK = 500000; // Process 500k samples per chunk

        for (let i = 0; i < outputData.length; i += APPLY_CHUNK) {
          const end = Math.min(i + APPLY_CHUNK, outputData.length);

          if (gainReduction < 1.0) {
            for (let j = i; j < end; j++) {
              outputData[j] = softClip(outputData[j] * gainReduction);
            }
          } else {
            for (let j = i; j < end; j++) {
              const val = outputData[j];
              const absVal = val < 0 ? -val : val;
              if (absVal > 0.5) {
                outputData[j] = softClip(val);
              }
            }
          }

          // Yield periodically
          if (i % (APPLY_CHUNK * 4) === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
          }
        }
      }

      if (onProgress) onProgress(100);
      console.log(`[HitsoundManager] Pre-synthesized ${processedHits} hitsounds in ${((performance.now() - startTime) / 1000).toFixed(2)}s, duration: ${totalDuration.toFixed(2)}s, gain: ${gainReduction.toFixed(3)}`);

    } else {
      // Original processing for smaller hit counts
      const progressUpdateInterval = Math.max(100, Math.floor(totalHits / 30));
      let placedCount = 0;
      let peakAmplitude = 0;

      for (const t of this.scheduledTimestamps) {
        if (t < 0) continue;

        const startSample = Math.floor(t * sampleRate);
        const hitLen = Math.min(hitLengthSamples, bufferLength - startSample);

        for (let ch = 0; ch < numChannels; ch++) {
          const hitData = hitChannelData[ch];
          const outputData = outputChannelData[ch];

          for (let i = 0; i < hitLen; i++) {
            const newVal = outputData[startSample + i] + hitData[i];
            outputData[startSample + i] = newVal;
            const absVal = newVal < 0 ? -newVal : newVal;
            if (absVal > peakAmplitude) peakAmplitude = absVal;
          }
        }

        placedCount++;

        if (onProgress && placedCount % progressUpdateInterval === 0) {
          const copyPercent = 10 + (placedCount / totalHits) * 80;
          onProgress(Math.min(90, copyPercent));
        }
      }

      console.log('[HitsoundManager] Copied', placedCount, 'hitsounds in', (performance.now() - startTime).toFixed(2), 'ms, peak:', peakAmplitude.toFixed(2));

      // Apply normalization and soft clipping (using shared softClip function)
      if (onProgress) onProgress(95);

      const TARGET_HEADROOM = 0.9;
      const gainReduction = peakAmplitude > TARGET_HEADROOM ? TARGET_HEADROOM / peakAmplitude : 1.0;

      for (let ch = 0; ch < numChannels; ch++) {
        const outputData = outputChannelData[ch];
        if (gainReduction < 1.0) {
          for (let i = 0; i < outputData.length; i++) {
            outputData[i] = softClip(outputData[i] * gainReduction);
          }
        } else {
          for (let i = 0; i < outputData.length; i++) {
            const val = outputData[i];
            const absVal = val < 0 ? -val : val;
            if (absVal > 0.5) {
              outputData[i] = softClip(val);
            }
          }
        }
      }

      if (onProgress) onProgress(100);
      console.log(`[HitsoundManager] Pre-synthesized ${placedCount} hitsounds in ${((performance.now() - startTime) / 1000).toFixed(2)}s, duration: ${totalDuration.toFixed(2)}s, gain: ${gainReduction.toFixed(3)}`);
    }

    // Compress to OGG if enabled and buffer exists
    if (this.useOGGCompression && this.synthesizedBuffer) {
      try {
        console.log('[HitsoundManager] Compressing hitsounds to OGG format...');
        const compressionStartTime = performance.now();

        this.compressedOGGBlob = await compressAudioBufferToOGG(this.synthesizedBuffer);

        const compressionTime = (performance.now() - compressionStartTime) / 1000;
        const originalSize = this.synthesizedBuffer.length * this.synthesizedBuffer.numberOfChannels * 4; // 4 bytes per sample
        const compressedSize = this.compressedOGGBlob.size;
        const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        console.log(`[HitsoundManager] OGG compression complete in ${compressionTime.toFixed(2)}s`);
        console.log(`[HitsoundManager] Original size: ${(originalSize / 1024 / 1024).toFixed(2)} MB, Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${compressionRatio}% reduction)`);

        // Load compressed buffer for playback
        this.compressedBuffer = await loadOGGBlob(this.compressedOGGBlob);

        // Free up the large uncompressed buffer
        this.synthesizedBuffer = null;

        if (onProgress) onProgress(100);
      } catch (error) {
        console.error('[HitsoundManager] OGG compression failed, falling back to uncompressed:', error);
        // Keep the uncompressed buffer if compression fails
      }
    }
  }

  /**
   * Start playing the pre-synthesized hitsound track
   * @param delay Delay in seconds before starting playback
   */
  start(delay: number = 0): void {
    console.log('[HitsoundManager] start called, delay:', delay, 'enabled:', this.enabled);

    if (!this.enabled) {
      console.warn('[HitsoundManager] Cannot start - disabled');
      return;
    }

    this.stop();

    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') {
      console.log('[HitsoundManager] Resuming suspended AudioContext');
      ctx.resume();
    }

    if (this.compressedBuffer) {
      // Pre-synthesized mode with OGG compression: play the compressed buffer
      this.synthesizedSource = ctx.createBufferSource();
      this.synthesizedSource.buffer = this.compressedBuffer;
      this.synthesizedSource.connect(this.getGainNode());

      this.synthesizedSource.onended = () => {
        if (this.synthesizedSource) {
          try {
            this.synthesizedSource.disconnect();
          } catch (e) { }
          this.synthesizedSource = null;
        }
      };

      const startTime = ctx.currentTime + delay;
      console.log('[HitsoundManager] Starting compressed OGG playback at', startTime);
      this.synthesizedSource.start(startTime);
    } else if (this.synthesizedBuffer) {
      // Pre-synthesized mode: play the buffer
      this.synthesizedSource = ctx.createBufferSource();
      this.synthesizedSource.buffer = this.synthesizedBuffer;
      this.synthesizedSource.connect(this.getGainNode());

      this.synthesizedSource.onended = () => {
        if (this.synthesizedSource) {
          try {
            this.synthesizedSource.disconnect();
          } catch (e) { }
          this.synthesizedSource = null;
        }
      };

      const startTime = ctx.currentTime + delay;
      console.log('[HitsoundManager] Starting pre-synthesized playback at', startTime);
      this.synthesizedSource.start(startTime);
    } else {
      console.warn('[HitsoundManager] Cannot start - no synthesized or compressed buffer');
    }
  }

  /**
   * Start playing from a specific offset (for resume after pause)
   * @param offset Offset in seconds from the beginning of the track
   */
  startAtOffset(offset: number): void {
    if (!this.enabled) return;

    this.stop();

    const ctx = getSharedAudioContext();
    if (ctx.state === 'suspended') ctx.resume();

    if (this.compressedBuffer) {
      // Compressed OGG mode
      this.synthesizedSource = ctx.createBufferSource();
      this.synthesizedSource.buffer = this.compressedBuffer;
      this.synthesizedSource.connect(this.getGainNode());

      this.synthesizedSource.onended = () => {
        if (this.synthesizedSource) {
          try {
            this.synthesizedSource.disconnect();
          } catch (e) { }
          this.synthesizedSource = null;
        }
      };

      const remainingDuration = this.compressedBuffer.duration - offset;
      if (remainingDuration > 0) {
        this.synthesizedSource.start(0, offset, remainingDuration);
      }
    } else if (this.synthesizedBuffer) {
      this.synthesizedSource = ctx.createBufferSource();
      this.synthesizedSource.buffer = this.synthesizedBuffer;
      this.synthesizedSource.connect(this.getGainNode());

      this.synthesizedSource.onended = () => {
        if (this.synthesizedSource) {
          try {
            this.synthesizedSource.disconnect();
          } catch (e) { }
          this.synthesizedSource = null;
        }
      };

      const remainingDuration = this.synthesizedBuffer.duration - offset;
      if (remainingDuration > 0) {
        this.synthesizedSource.start(0, offset, remainingDuration);
      }
    }
  }

  /**
   * Stop playing
   */
  stop(): void {
    // Stop pre-synthesized playback
    if (this.synthesizedSource) {
      try {
        this.synthesizedSource.stop();
        this.synthesizedSource.disconnect();
      } catch (e) { }
      this.synthesizedSource = null;
    }
  }

  /**
   * Check if hitsounds are pre-synthesized or ready for real-time playback
   */
  isSynthesized(): boolean {
    return this.synthesizedBuffer !== null || this.compressedBuffer !== null;
  }

  /**
   * Dispose and clear
   */
  dispose(): void {
    this.stop();
    this.currentBuffer = null;
    this.synthesizedBuffer = null;
    this.compressedBuffer = null;
    this.compressedOGGBlob = null;
    this.scheduledTimestamps = [];
    this.gainNode = null;
  }
}
