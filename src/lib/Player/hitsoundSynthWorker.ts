/**
 * Hitsound chunk synthesis worker.
 *
 * Main thread sends decoded hitsound channel data once ('init'), then per-chunk
 * jobs ('chunk'): mix all hits of a 10 s window into a stereo Float32Array and
 * transfer the buffers back (zero-copy). This keeps the (potentially billions of
 * sample operations) mixing off the main thread.
 */

interface InitBuffer {
  type: string;
  L: Float32Array;
  R: Float32Array;
}

interface InitMessage {
  type: 'init';
  sampleRate: number;
  buffers: InitBuffer[];
}

interface ChunkJob {
  type: string;
  volume: number;
  timestamps: Float64Array;
}

interface ChunkMessage {
  type: 'chunk';
  chunkIndex: number;
  chunkStart: number;
  bufferLength: number;
  maxHits: number;
  jobs: ChunkJob[];
}

let sampleRate = 44100;
const buffers: Map<string, { L: Float32Array; R: Float32Array; len: number }> = new Map();

/** 把一段命中音轨按 gain 叠加到输出（限幅交给后续 tanh，不做逐样本裁剪）。 */
const mixHit = (
  outL: Float32Array, outR: Float32Array,
  L: Float32Array, R: Float32Array,
  hitLen: number, startSample: number, gain: number, bufferLength: number
): void => {
  if (startSample < 0) return;
  const len = Math.min(hitLen, bufferLength - startSample);
  for (let i = 0; i < len; i++) {
    outL[startSample + i] += L[i] * gain;
    outR[startSample + i] += R[i] * gain;
  }
};

self.onmessage = (event: MessageEvent): void => {
  const msg = event.data as InitMessage | ChunkMessage;
  if (!msg) return;

  if (msg.type === 'init') {
    sampleRate = msg.sampleRate;
    buffers.clear();
    for (const b of msg.buffers) {
      buffers.set(b.type, { L: b.L, R: b.R, len: b.L.length });
    }
    self.postMessage({ type: 'ready' });
    return;
  }

  if (msg.type === 'chunk') {
    const { chunkIndex, chunkStart, bufferLength, jobs } = msg;
    const outL = new Float32Array(bufferLength);
    const outR = new Float32Array(bufferLength);

    // 1ms 密度桶：同一桶内的命中合并为一次混音、振幅 ×1/√k。
    const bucketSamples = Math.max(1, Math.floor(sampleRate * 0.001));

    // 进度上报用的总处理量（按桶数估算）
    let totalToProcess = 0;
    for (const job of jobs) {
      totalToProcess += Math.min(job.timestamps.length, Math.ceil(bufferLength / bucketSamples));
    }
    let processed = 0;
    let lastReport = performance.now();
    (self as any).postMessage({ type: 'progress', chunkIndex, progress: 0 });

    for (const job of jobs) {
      const buf = buffers.get(job.type);
      if (!buf) continue;
      const volScale = job.volume / 100;
      const ts = job.timestamps;
      const hitLen = buf.len;
      const L = buf.L;
      const R = buf.R;

      // ── 密度合并（不再按 stride 抽稀丢音）────────────────────────
      // 旧实现超过 maxHits 就 idx += stride，直接丢掉大量命中 → 高 BPM 漏音。
      // 现在同一 1ms 桶只混一次、振幅 ×1/√k：每桶至少有一击（不漏音），
      // CPU/峰值被桶数限制；低 BPM（间隔 >1ms）时与逐击混音完全一致。
      let curBucket = -1;
      let curCount = 0;
      let curSample = -1;
      for (let idx = 0; idx < ts.length; idx++) {
        const startSample = Math.floor((ts[idx] - chunkStart) * sampleRate);
        if (startSample < 0) continue;
        if (startSample >= bufferLength) break;
        const bucket = Math.floor(startSample / bucketSamples);
        if (bucket !== curBucket) {
          if (curCount > 0) {
            mixHit(outL, outR, L, R, hitLen, curSample, volScale / Math.sqrt(curCount), bufferLength);
            processed++;
          }
          curBucket = bucket;
          curCount = 1;
          curSample = startSample;
        } else {
          curCount++;
        }
        const now = performance.now();
        if (now - lastReport >= 100) {
          lastReport = now;
          (self as any).postMessage({
            type: 'progress',
            chunkIndex,
            progress: totalToProcess > 0 ? processed / totalToProcess : 1,
          });
        }
      }
      if (curCount > 0) {
        mixHit(outL, outR, L, R, hitLen, curSample, volScale / Math.sqrt(curCount), bufferLength);
        processed++;
      }
    }
    (self as any).postMessage({ type: 'progress', chunkIndex, progress: 1 });

    // 只测峰值供诊断；限幅交给主线程折叠后统一做（避免"每块饱和+整体再饱和"的双重失真）
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      const al = outL[i] < 0 ? -outL[i] : outL[i];
      if (al > peak) peak = al;
      const ar = outR[i] < 0 ? -outR[i] : outR[i];
      if (ar > peak) peak = ar;
    }

    (self as any).postMessage(
      { type: 'chunk', chunkIndex, L: outL.buffer, R: outR.buffer, length: bufferLength, peak },
      [outL.buffer, outR.buffer]
    );
  }
};

export {};
