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

const softClip = (x: number): number => {
  const absX = x < 0 ? -x : x;
  if (absX < 0.5) return x;
  if (absX < 1.5) return x * (1 - x * x / 3);
  return x < 0 ? -1 : 1;
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
    const { chunkIndex, chunkStart, bufferLength, maxHits, jobs } = msg;
    const outL = new Float32Array(bufferLength);
    const outR = new Float32Array(bufferLength);

    for (const job of jobs) {
      const buf = buffers.get(job.type);
      if (!buf) continue;
      const volScale = job.volume / 100;
      const ts = job.timestamps;
      const stride = Math.max(1, Math.ceil(ts.length / maxHits));
      const hitLen = buf.len;
      const L = buf.L;
      const R = buf.R;
      for (let idx = 0; idx < ts.length; idx += stride) {
        const startSample = Math.floor((ts[idx] - chunkStart) * sampleRate);
        if (startSample < 0 || startSample >= bufferLength) continue;
        const len = Math.min(hitLen, bufferLength - startSample);
        for (let i = 0; i < len; i++) {
          outL[startSample + i] += L[i] * volScale;
          outR[startSample + i] += R[i] * volScale;
        }
      }
    }

    for (let i = 0; i < bufferLength; i++) {
      const vl = outL[i];
      const al = vl < 0 ? -vl : vl;
      if (al > 0.5) outL[i] = softClip(vl);
      const vr = outR[i];
      const ar = vr < 0 ? -vr : vr;
      if (ar > 0.5) outR[i] = softClip(vr);
    }

    (self as any).postMessage(
      { type: 'chunk', chunkIndex, L: outL.buffer, R: outR.buffer, length: bufferLength },
      [outL.buffer, outR.buffer]
    );
  }
};

export {};
