/**
 * Level Loader Web Worker
 * Handles heavy computation (precomputation) for level loading in a separate thread.
 * Parsing is done on the main thread; this worker only does CPU-intensive data processing.
 */

// Worker message types
interface LoadMessage {
  type: 'load';
  levelData: {
    settings: any;
    tiles: any[];
    actions: any[];
    angleData: any[];
  };
}

interface ProgressMessage {
  type: 'progress';
  progress: number;
  status: string;
  stage: string;
  current: number;
  total: number;
}

interface ResultMessage {
  type: 'result';
  data: any;
}

interface ErrorMessage {
  type: 'error';
  error: string;
}

type WorkerMessage = LoadMessage;
type WorkerResponse = ProgressMessage | ResultMessage | ErrorMessage;

// Post message helper with type checking
function postMessage(message: WorkerResponse): void {
  self.postMessage(message);
}

// Main loading function
async function loadLevel(levelData: any): Promise<void> {
  try {
    postMessage({
      type: 'progress',
      progress: 90,
      status: 'Precomputing level data...',
      stage: 'complete',
      current: 0,
      total: 0,
    });

    // Precompute values
    const precomputed = precomputeLevelData(levelData);

    postMessage({
      type: 'result',
      data: {
        levelData,
        precomputed,
      }
    });

  } catch (error) {
    postMessage({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Precompute values that will be used during playback
 * This reduces per-frame calculations significantly
 */
function precomputeLevelData(levelData: any): any {
  const tiles = levelData.tiles || [];
  const actions = levelData.actions || [];
  const settings = levelData.settings || {};

  const precomputed = {
    // Cumulative rotations
    cumulativeRotations: [] as number[],
    tileStartTimes: [] as number[],
    tileDurations: [] as number[],
    tileExtraRotations: [] as number[],
    tileIsCW: [] as boolean[],
    tileBPM: [] as number[],
    tileStartAngle: [] as number[],
    tileTotalAngle: [] as number[],
    tileStartDist: [] as number[],
    tileEndDist: [] as number[],
    totalLevelRotation: 0,

    // Events indexed by floor
    tileEvents: {} as Record<number, any[]>,
    tileCameraEvents: {} as Record<number, any[]>,

    // Camera timeline
    cameraTimeline: [] as { time: number; event: any }[],
  };

  // Parse actions into tile events
  actions.forEach((action: any) => {
    const floor = action.floor;
    if (action.eventType === 'MoveCamera') {
      if (!precomputed.tileCameraEvents[floor]) {
        precomputed.tileCameraEvents[floor] = [];
      }
      precomputed.tileCameraEvents[floor].push(action);
    } else {
      if (!precomputed.tileEvents[floor]) {
        precomputed.tileEvents[floor] = [];
      }
      precomputed.tileEvents[floor].push(action);
    }
  });

  // Calculate cumulative rotations and timing
  let totalRotation = 0;
  let totalTime = 0;
  let currentBPM = settings.bpm || 100;
  let isCW = true;

  for (let i = 0; i < tiles.length - 1; i++) {
    let extraRotation = 0;

    // Process events
    if (precomputed.tileEvents[i]) {
      precomputed.tileEvents[i].forEach((event: any) => {
        if (event.eventType === 'Twirl') {
          isCW = !isCW;
        } else if (event.eventType === 'SetSpeed') {
          if (event.speedType === 'Multiplier') {
            currentBPM *= event.bpmMultiplier;
          } else {
            currentBPM = event.beatsPerMinute;
          }
        } else if (event.eventType === 'Pause') {
          extraRotation += (event.duration || 0) / 2.0;
        }
      });
    }

    precomputed.tileIsCW.push(isCW);
    precomputed.tileBPM.push(currentBPM);

    const pivot = tiles[i];
    const next = tiles[i + 1];

    // Calculate start angle
    let startAngle = 0;
    if (i === 0) {
      startAngle = ((settings.rotation || 0) + 180) * Math.PI / 180;
    } else {
      const prev = tiles[i - 1];
      startAngle = Math.atan2(
        prev.position[1] - pivot.position[1],
        prev.position[0] - pivot.position[0]
      );
    }

    // Calculate rotation angle
    const relativeAngle = (pivot.angle !== undefined) ? pivot.angle : 180;
    let totalAngle = (relativeAngle * Math.PI) / 180;
    if (isCW) {
      totalAngle = -totalAngle;
    }

    // Add extra rotation from Pause
    if (isCW) {
      totalAngle -= extraRotation * 2 * Math.PI;
    } else {
      totalAngle += extraRotation * 2 * Math.PI;
    }

    const rotationAmount = Math.abs(totalAngle) / (2 * Math.PI);
    const duration = (rotationAmount * 2) * (60 / currentBPM);

    totalRotation += rotationAmount;
    totalTime += duration;

    precomputed.tileStartAngle.push(startAngle);
    precomputed.tileTotalAngle.push(totalAngle);

    // Distance calculations
    let startDist = 1.0;
    if (i > 0) {
      const prev = tiles[i - 1];
      const pdx = prev.position[0] - pivot.position[0];
      const pdy = prev.position[1] - pivot.position[1];
      startDist = Math.sqrt(pdx * pdx + pdy * pdy);
    }
    precomputed.tileStartDist.push(startDist);

    const edx = next.position[0] - pivot.position[0];
    const edy = next.position[1] - pivot.position[1];
    precomputed.tileEndDist.push(Math.sqrt(edx * edx + edy * edy));

    precomputed.cumulativeRotations.push(totalRotation);
    precomputed.tileDurations.push(duration);
    precomputed.tileExtraRotations.push(extraRotation);
    precomputed.tileStartTimes.push(totalTime);
  }

  // Shift tileStartTimes
  if (precomputed.tileStartTimes.length > 1) {
    const shift = precomputed.tileStartTimes[1];
    for (let i = 0; i < precomputed.tileStartTimes.length; i++) {
      precomputed.tileStartTimes[i] -= shift;
    }
  }

  // Handle last tile
  if (tiles.length > 0) {
    const lastIndex = tiles.length - 1;
    let extraRotation = 0;

    if (precomputed.tileEvents[lastIndex]) {
      precomputed.tileEvents[lastIndex].forEach((event: any) => {
        if (event.eventType === 'Twirl') {
          isCW = !isCW;
        } else if (event.eventType === 'SetSpeed') {
          if (event.speedType === 'Multiplier') {
            currentBPM *= event.bpmMultiplier;
          } else {
            currentBPM = event.beatsPerMinute;
          }
        } else if (event.eventType === 'Pause') {
          extraRotation += (event.duration || 0) / 2.0;
        }
      });
    }

    precomputed.tileIsCW.push(isCW);
    precomputed.tileBPM.push(currentBPM);
    precomputed.tileExtraRotations.push(extraRotation);
  }

  precomputed.totalLevelRotation = totalRotation;

  return precomputed;
}

// Handle messages from main thread
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  if (message.type === 'load') {
    loadLevel(message.levelData);
  }
};

export {};
