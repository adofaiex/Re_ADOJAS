import { Vector2, Vector3, Euler, Mesh, ShaderMaterial } from 'three';
import { getEasingFunction } from './WasmEasing';
import { isEventActive, isFieldEnabled } from './EventUtils';

export interface Keyframe {
    time: number;
    value: number;
    ease: string | null;
}

export class TimelineManager {
    private timelines: Map<string, Map<string, Keyframe[]>> = new Map();
    private triggerEvents: { time: number; event: any }[] = [];
    private _cameraEvents: { time: number; event: any; floor: number; angleOffset: number }[] = [];
    private lastTriggerIndex: number = -1;

    private _animatedTileIndices: Set<number> = new Set();
    private _tileRanges: { tileIdx: number; start: number; end: number }[] = [];
    private _tileRangesSorted: boolean = false;
    private tileStartTimes: number[];
    private tileBPM: number[];
    private totalTiles: number;

    // 离散时间轴：存储 string | boolean | number 的"即时"属性
    // （如 deco 的 visible / depth / decorationImage / maskingType 等）。
    // sampleDiscrete 返回 time<=t 时最新的值，不插值。
    private discreteTimelines: Map<string, Map<string, Array<{ time: number; value: string | boolean | number }>>> = new Map();

    constructor(
        actions: any[],
        tileStartTimes: number[],
        tileBPM: number[],
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
        totalTiles: number,
        settings?: any,
    ) {
        this.tileStartTimes = tileStartTimes;
        this.tileBPM = tileBPM;
        this.totalTiles = totalTiles;
        this.build(actions, basePositions, baseRotations, baseScales, baseOpacities, settings);
    }

    private build(
        actions: any[],
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
        settings?: any,
    ): void {
        const perTileMoveTrack: Map<number, {
            time: number; duration: number; event: any; floor: number
        }[]> = new Map();

        const triggerEntries: { time: number; event: any }[] = [];

        // Collect MoveTrack events per floor, then sort by id to match C# order
        const perFloorMoveTrack: Map<number, any[]> = new Map();
        for (const action of actions) {
            if (!isEventActive(action)) continue;
            if (action.eventType === 'MoveTrack') {
                const floor = action.floor ?? 0;
                if (!perFloorMoveTrack.has(floor)) perFloorMoveTrack.set(floor, []);
                perFloorMoveTrack.get(floor)!.push(action);
            }
        }
        for (const [, evts] of perFloorMoveTrack) {
            evts.sort((a, b) => (a.id ?? Infinity) - (b.id ?? Infinity));
        }

        const zeroOffsetTracker: Map<number, number> = new Map();

        // ── Build RepeatEvent table ──────────────────────────────
        // dict[floor][tag] → { repetitions, interval, executeOnCurrentFloor, gapLength }
        const repeatTable: Map<number, Map<string, {
            repetitions: number; interval: number; executeOnCurrentFloor: boolean; gapLength: number;
        }>> = new Map();
        for (const action of actions) {
            if (!isEventActive(action)) continue;
            if (action.eventType !== 'RepeatEvents') continue;
            const floor = action.floor ?? 0;
            if (!repeatTable.has(floor)) repeatTable.set(floor, new Map());
            const sub = repeatTable.get(floor)!;
            const isBeat = action.repeatType === 'Beat';
            const repetitions = isBeat ? (action.repetitions ?? 0) : (action.floorCount ?? 0);
            const interval = isBeat ? (action.interval ?? 1) : -1;
            const executeOnCurrentFloor = action.executeOnCurrentFloor ?? false;
            const gapLength = action.gapLength ?? 1;
            const tags = (action.tag ?? '').split(' ').filter((t: string) => t);
            for (const tag of tags) {
                sub.set(tag, { repetitions, interval, executeOnCurrentFloor, gapLength });
            }
        }

        for (const action of actions) {
            if (!isEventActive(action)) continue;
            if (action.eventType === 'RepeatEvents') continue;

            // ── Expand repeated events ────────────────────────────
            const eventsToProcess: { event: any; floor: number; angleOffset: number }[] = [];

            const eventTag = action.eventTag ?? '';
            const hasRepeat = eventTag && repeatTable.has(action.floor) && repeatTable.get(action.floor)!.has(eventTag);

            if (hasRepeat) {
                const info = repeatTable.get(action.floor)!.get(eventTag)!;
                const baseFloor = action.floor;
                const isBeatMode = info.interval > 0;

                for (let rep = 0; rep <= info.repetitions; rep++) {
                    const targetFloor = baseFloor + rep * info.gapLength;
                    if (targetFloor >= this.totalTiles) break;

                    let repAngleOffset: number;
                    let epFloor: number;
                    if (isBeatMode) {
                        // Beat mode: event stays on original floor, angle offset shifts time
                        epFloor = baseFloor;
                        repAngleOffset = info.interval * rep * 180;
                    } else {
                        // Floor mode
                        if (info.executeOnCurrentFloor) {
                            // Event moves to target floor
                            epFloor = targetFloor;
                            repAngleOffset = 0;
                        } else {
                            // Event stays on original floor, offset = beat difference
                            epFloor = baseFloor;
                            const baseTime = this.tileStartTimes[baseFloor] || 0;
                            const targetTime = this.tileStartTimes[targetFloor] || 0;
                            const bpm = this.tileBPM[baseFloor] || 100;
                            const secPerBeat = 60 / bpm;
                            const beatDiff = (targetTime - baseTime) / secPerBeat;
                            repAngleOffset = beatDiff * 180;
                        }
                    }

                    eventsToProcess.push({
                        event: action,
                        floor: epFloor,
                        angleOffset: (action.angleOffset || 0) + repAngleOffset,
                    });
                }
            } else {
                eventsToProcess.push({
                    event: action,
                    floor: action.floor ?? 0,
                    angleOffset: action.angleOffset || 0,
                });
            }

            for (const ep of eventsToProcess) {
                const floor = ep.floor;
                const bpm = this.tileBPM[floor] || 100;
                const secPerBeat = 60 / bpm;
                const startTime = this.tileStartTimes[floor] || 0;
                const angleOffset = ep.angleOffset;
                let timeOffset = (angleOffset / 180) * secPerBeat;

                // tileStartTimes 即 songposition 时间线（timeInLevel 0 = countdown 开始），
                // floor 0 事件天然在 countdown 开始触发（官方 songposition 0）。
                const eventTime = startTime + timeOffset;

            if (action.eventType === 'MoveTrack') {
                const startTile = this.parseTileReference(action.startTile, floor);
                const endTile = this.parseTileReference(action.endTile, floor);
                const start = Math.min(startTile, endTile);
                const end = Math.max(startTile, endTile);
                const gapLength = action.gapLength || 0;
                const rawDuration = (action.duration ?? 1) * secPerBeat;
                const duration = rawDuration || 1;

                for (let i = start; i <= end; i += 1 + gapLength) {
                    if (i < 0) continue;
                    if (!perTileMoveTrack.has(i)) perTileMoveTrack.set(i, []);
                    perTileMoveTrack.get(i)!.push({
                        time: eventTime, duration, event: action, floor,
                    });
                }
            } else if (action.eventType === 'MoveCamera') {
                this._cameraEvents.push({ time: eventTime, event: action, floor: ep.floor, angleOffset: ep.angleOffset });
            } else if (action.eventType !== 'SetHitsound' &&
                       action.eventType !== 'PlayHitsound') {
                triggerEntries.push({ time: eventTime, event: action });
            }
        } // end for eventsToProcess
        } // end for actions

        triggerEntries.sort((a, b) => {
            const dt = a.time - b.time;
            return Math.abs(dt) < 0.0001
                ? ((a.event.id ?? Infinity) - (b.event.id ?? Infinity))
                : (dt > 0 ? 1 : -1);
        });
        this.triggerEvents = triggerEntries;

        this._cameraEvents.sort((a, b) => {
            const dt = a.time - b.time;
            if (Math.abs(dt) < 0.0001) return (a.event.id ?? Infinity) - (b.event.id ?? Infinity);
            return dt > 0 ? 1 : -1;
        });

        // Build MoveTrack keyframes FIRST, then AnimateTrack (appear/disappear)
        // SECOND so AnimateTrack wins on conflicts (matching C# priority).
        // 应用顺序（C# ApplyEventsToFloors）：floor 升序，同 floor 按 id 升序。
        // 后处理的事件覆盖先处理的（RemoveKeyframes 删冲突区间）。
        for (const [tileIdx, events] of perTileMoveTrack) {
            events.sort((a, b) => {
                if (a.floor !== b.floor) return a.floor - b.floor;
                return (a.event.id ?? Infinity) - (b.event.id ?? Infinity);
            });
            this.buildTileMoveTrack(tileIdx, events, basePositions, baseRotations, baseScales, baseOpacities, tileIdx < this.tileStartTimes.length ? this.tileStartTimes[tileIdx] : 0);
        }

        // Build Appear/Disappear keyframes AFTER MoveTrack so AnimateTrack wins on conflicts.
        this.buildAnimateTrackKeyframes(actions, basePositions, baseRotations, baseScales, baseOpacities, settings);

        this._animatedTileIndices = this.computeAnimatedTileIndices();
        this.buildTileRanges();
    }

    private computeAnimatedTileIndices(): Set<number> {
        const indices = new Set<number>();
        for (const [entity, props] of this.timelines) {
            if (!entity.startsWith('tile:')) continue;
            const tileIdx = parseInt(entity.slice(5), 10);
            if (isNaN(tileIdx)) continue;
            for (const kfs of props.values()) {
                const last = kfs[kfs.length - 1];
                if (last && last.time > 1e-9) {
                    indices.add(tileIdx);
                    break;
                }
            }
        }
        return indices;
    }

    /**
     * Pre-compute time ranges for each animated tile.
     * Used to avoid iterating ALL animated tiles per frame — we only process tiles
     * whose animation time window covers the current game time.
     */
    private buildTileRanges(): void {
        this._tileRanges = [];
        for (const tileIdx of this._animatedTileIndices) {
            const props = this.timelines.get(`tile:${tileIdx}`);
            if (!props) continue;
            let start = Infinity, end = -Infinity;
            for (const kfs of props.values()) {
                if (kfs.length > 0) {
                    if (kfs[0].time < start) start = kfs[0].time;
                    if (kfs[kfs.length - 1].time > end) end = kfs[kfs.length - 1].time;
                }
            }
            if (end >= start) {
                this._tileRanges.push({ tileIdx, start, end });
            }
        }
        // 必须按 end 排序：getActiveTileIndicesAt 的二分查找用 end 作查找键，
        // 若按 start 排序而 end 不单调（长动画 tile 排前面），二分会错误跳过
        // 前面 start 小但 end 大的 tile（表现为部分/全部 MoveTrack 不触发）。
        this._tileRanges.sort((a, b) => a.end - b.end);
        this._tileRangesSorted = true;
    }

    /**
     * Returns tile indices whose last keyframe is after the given time.
     * Matches the original isTileActive semantics: tile is "active" if
     * time < last keyframe time (animation hasn't fully finished yet).
     * Uses binary search on the sorted _tileRanges array — O(log n) to find
     * the first unfinished tile, then O(k) linear scan for k unfinished tiles.
     *
     * Tiles whose animation finished (end <= time) are excluded, which
     * eliminates the O(n) scan of ALL animated tiles every frame.
     */
    public getActiveTileIndicesAt(time: number): number[] {
        if (!this._tileRangesSorted || this._tileRanges.length === 0) {
            return Array.from(this._animatedTileIndices);
        }
        const ranges = this._tileRanges;
        let lo = 0, hi = ranges.length;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if (ranges[mid].end > time) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        // lo = first index with end > time (animation unfinished)
        const result: number[] = [];
        for (let i = lo; i < ranges.length; i++) {
            result.push(ranges[i].tileIdx);
        }
        return result;
    }

    private buildTileMoveTrack(
        tileIdx: number,
        events: { time: number; duration: number; event: any; floor: number }[],
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
        tileStartTime: number,
    ): void {
        const baseX = tileIdx >= 0 && tileIdx < basePositions.length ? basePositions[tileIdx].x : 0;
        const baseY = tileIdx >= 0 && tileIdx < basePositions.length ? basePositions[tileIdx].y : 0;
        const baseRot = tileIdx >= 0 && tileIdx < baseRotations.length ? baseRotations[tileIdx] : 0;
        const baseSX = tileIdx >= 0 && tileIdx < baseScales.length ? baseScales[tileIdx].x : 1;
        const baseSY = tileIdx >= 0 && tileIdx < baseScales.length ? baseScales[tileIdx].y : 1;
        const baseOp = tileIdx >= 0 && tileIdx < baseOpacities.length ? baseOpacities[tileIdx] : 1;

        // base keyframes 在 time 0（songposition 0 = countdown 开始，官方位置）。
        // 负时间（countdown 期间）事件会 removeAfter 删除它们，startVal 归零渐现——官方行为。
        this.addKeyframe(`tile:${tileIdx}`, 'positionX', 0, baseX, null);
        this.addKeyframe(`tile:${tileIdx}`, 'positionY', 0, baseY, null);
        this.addKeyframe(`tile:${tileIdx}`, 'rotation', 0, baseRot, null);
        this.addKeyframe(`tile:${tileIdx}`, 'scaleX', 0, baseSX, null);
        this.addKeyframe(`tile:${tileIdx}`, 'scaleY', 0, baseSY, null);
        this.addKeyframe(`tile:${tileIdx}`, 'opacity', 0, baseOp, null);

        let accX = baseX, accY = baseY, accRot = baseRot, accSX = baseSX, accSY = baseSY, accOp = baseOp;

        for (const entry of events) {
            const { event, time: eventTime, duration: eventDuration, floor } = entry;

            // 不 clamp 到 0：负时间（countdown 期间）动画正常触发，
            // 与官方 songposition 时间线（timeInLevel - cd）一致。
            const clampedTime = eventTime;

            const positionUsed = event.positionOffset !== undefined && isFieldEnabled(event, 'positionOffset');
            const rotationUsed = event.rotationOffset !== undefined && isFieldEnabled(event, 'rotationOffset');
            const scaleUsed = event.scale !== undefined && isFieldEnabled(event, 'scale');
            const opacityUsed = event.opacity != null && isFieldEnabled(event, 'opacity');

            const ease = event.ease || 'Linear.easeNone';

            const offsetX = positionUsed && event.positionOffset[0] != null ? event.positionOffset[0] : null;
            const offsetY = positionUsed && event.positionOffset[1] != null ? event.positionOffset[1] : null;

            let rotationOffset: number | null = null;
            if (rotationUsed) rotationOffset = (event.rotationOffset || 0) * Math.PI / 180;

            let scaleX: number | null = null, scaleY: number | null = null;
            if (scaleUsed && event.scale) {
                if (Array.isArray(event.scale)) {
                    scaleX = event.scale[0] != null ? event.scale[0] / 100 : null;
                    scaleY = event.scale[1] != null ? event.scale[1] / 100 : null;
                } else {
                    scaleX = scaleY = event.scale / 100;
                }
            }

            const opacity = opacityUsed ? event.opacity / 100 : null;

            const targetX = offsetX != null ? baseX + offsetX : accX;
            const targetY = offsetY != null ? baseY + offsetY : accY;
            const targetRot = rotationOffset != null ? baseRot + rotationOffset : accRot;
            const targetSX = scaleX != null ? scaleX : accSX;
            const targetSY = scaleY != null ? scaleY : accSY;
            const targetOp = opacity != null ? opacity : accOp;

            if (eventDuration <= 0) {
                if (offsetX != null) this.instantKeyframe(`tile:${tileIdx}`, 'positionX', clampedTime, targetX);
                if (offsetY != null) this.instantKeyframe(`tile:${tileIdx}`, 'positionY', clampedTime, targetY);
                if (rotationOffset != null) this.instantKeyframe(`tile:${tileIdx}`, 'rotation', clampedTime, targetRot);
                if (scaleX != null) this.instantKeyframe(`tile:${tileIdx}`, 'scaleX', clampedTime, targetSX);
                if (scaleY != null) this.instantKeyframe(`tile:${tileIdx}`, 'scaleY', clampedTime, targetSY);
                if (opacity != null) this.instantKeyframe(`tile:${tileIdx}`, 'opacity', clampedTime, targetOp);
            } else {
                const endTime = clampedTime + eventDuration;
                const props: [string, number][] = [];
                if (offsetX != null) props.push(['positionX', targetX]);
                if (offsetY != null) props.push(['positionY', targetY]);
                if (rotationOffset != null) props.push(['rotation', targetRot]);
                if (scaleX != null) props.push(['scaleX', targetSX]);
                if (scaleY != null) props.push(['scaleY', targetSY]);
                if (opacity != null) props.push(['opacity', targetOp]);

                for (const [prop, target] of props) {
                    // Official ffxMoveFloorPlus: floors share one moveTweens dict, and a
                    // new event Kill(complete:true)s the previous tween of the same
                    // property — the old tween instantly jumps to ITS end value at
                    // clampedTime and the new tween eases from there.
                    const kfs0 = this.timelines.get(`tile:${tileIdx}`)!.get(prop)!;
                    const fallback = kfs0.length > 0 ? kfs0[0].value : 0;
                    this.addTweenKillComplete(`tile:${tileIdx}`, prop, clampedTime, endTime, fallback, target, ease);
                }
            }

            if (offsetX != null) accX = targetX;
            if (offsetY != null) accY = targetY;
            if (rotationOffset != null) accRot = targetRot;
            if (scaleX != null) accSX = targetSX;
            if (scaleY != null) accSY = targetSY;
            if (opacity != null) accOp = targetOp;
        }
    }

    private ensureTimeline(entity: string, property: string): Keyframe[] {
        let props = this.timelines.get(entity);
        if (!props) {
            props = new Map();
            this.timelines.set(entity, props);
        }
        let kfs = props.get(property);
        if (!kfs) {
            kfs = [];
            props.set(property, kfs);
        }
        return kfs;
    }

    private instantKeyframe(entity: string, property: string, time: number, value: number): void {
        const kfs = this.timelines.get(entity)?.get(property);
        if (!kfs) return;

        this.removeAfter(kfs, time + 1e-9);
        const idx = this.findKeyframeIndex(kfs, time);
        if (idx >= 0 && Math.abs(kfs[idx].time - time) < 1e-9) {
            kfs[idx].value = value;
            kfs[idx].ease = null;
        } else {
            kfs.push({ time, value, ease: null });
            kfs.sort((a, b) => a.time - b.time);
        }
    }

    private removeAfter(kfs: Keyframe[], time: number): void {
        for (let i = kfs.length - 1; i >= 0; i--) {
            if (kfs[i].time >= time) kfs.splice(i, 1);
        }
    }

    private findKeyframeIndex(kfs: Keyframe[], time: number): number {
        if (kfs.length === 0) return -1;
        let lo = 0, hi = kfs.length - 1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            if (kfs[mid].time < time) lo = mid + 1;
            else if (kfs[mid].time > time) hi = mid - 1;
            else return mid;
        }
        return hi;
    }

    /* ── 公开 API ────────────────────────────────────────────────── */

    public sample(entity: string, property: string, time: number): number | undefined {
        const kfs = this.timelines.get(entity)?.get(property);
        if (!kfs || kfs.length === 0) return undefined;

        // Before the first keyframe there is no state yet: return undefined so the
        // caller falls back to the entity's base value. (Matches sampleDiscrete.)
        const idx = this.findKeyframeIndex(kfs, time);
        if (idx < 0) return undefined;
        if (idx >= kfs.length - 1) return kfs[kfs.length - 1].value;

        const left = kfs[idx];
        const right = kfs[idx + 1];
        return this.interpolateTimelinePair(left, right, time);
    }

    public sampleStep(entity: string, property: string, time: number): number | undefined {
        const kfs = this.timelines.get(entity)?.get(property);
        if (!kfs || kfs.length === 0) return undefined;
        const idx = this.findKeyframeIndex(kfs, time);
        if (idx < 0) return undefined; // before first keyframe: no state yet
        return kfs[idx].value;
    }

    /* ── 离散时间轴（即时属性 / 字符串 / 布尔） ─────────────────── */

    public ensureDiscreteTimeline(entity: string, property: string): Array<{ time: number; value: string | boolean | number }> {
        let props = this.discreteTimelines.get(entity);
        if (!props) {
            props = new Map();
            this.discreteTimelines.set(entity, props);
        }
        let kfs = props.get(property);
        if (!kfs) {
            kfs = [];
            props.set(property, kfs);
        }
        return kfs;
    }

    public addDiscreteKeyframe(entity: string, property: string, time: number, value: string | boolean | number): void {
        const kfs = this.ensureDiscreteTimeline(entity, property);
        // 同时间覆盖
        for (let i = 0; i < kfs.length; i++) {
            if (Math.abs(kfs[i].time - time) < 1e-9) {
                kfs[i].value = value;
                return;
            }
        }
        kfs.push({ time, value });
        if (kfs.length > 1) kfs.sort((a, b) => a.time - b.time);
    }

    public sampleDiscrete(entity: string, property: string, time: number): string | boolean | number | undefined {
        const kfs = this.discreteTimelines.get(entity)?.get(property);
        if (!kfs || kfs.length === 0) return undefined;
        // 二分找 <= time 的最新
        let lo = 0, hi = kfs.length - 1, idx = -1;
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1;
            if (kfs[mid].time <= time) { idx = mid; lo = mid + 1; }
            else hi = mid - 1;
        }
        if (idx < 0) return undefined; // time 早于第一条 → 无状态
        return kfs[idx].value;
    }

    public hasDiscreteTimeline(entity: string, property: string): boolean {
        return !!this.discreteTimelines.get(entity)?.has(property);
    }

    public samplePosition(entity: string, time: number): { x: number; y: number } | null {
        const x = this.sample(entity, 'positionX', time);
        const y = this.sample(entity, 'positionY', time);
        if (x === undefined || y === undefined) return null;
        return { x, y };
    }

    private interpolateTimeline(kfs: Keyframe[], idx: number, time: number): number {
        const left = kfs[idx];
        if (idx >= kfs.length - 1) return left.value;
        return this.interpolateTimelinePair(left, kfs[idx + 1], time);
    }

    private interpolateTimelinePair(left: Keyframe, right: Keyframe, time: number): number {
        if (time <= left.time) return left.value;
        if (time >= right.time) return right.value;

        const range = right.time - left.time;
        if (range <= 1e-12) return right.value;

        // ease=null marks an instant (zero-duration) keyframe: the value snaps at
        // left.time and holds until the next event. Official MoveDecorations/MoveCamera
        // with duration 0 set the target immediately, so never interpolate from one.
        if (left.ease == null) return left.value;

        let progress = (time - left.time) / range;
        if (left.ease !== 'Linear.easeNone' && left.ease !== 'Linear') {
            const fn = getEasingFunction(left.ease);
            progress = fn(progress);
        }

        return left.value + (right.value - left.value) * progress;
    }

    public *sampleAllPosition(time: number): IterableIterator<[number, { x: number; y: number }]> {
        for (const [entity, props] of this.timelines) {
            if (!entity.startsWith('tile:')) continue;
            const tileIdx = parseInt(entity.slice(5), 10);
            if (isNaN(tileIdx)) continue;
            const pos = this.samplePosition(entity, time);
            if (pos) yield [tileIdx, pos];
        }
    }

    public isRewound(time: number): boolean {
        return this.lastTriggerIndex >= 0 &&
               time < this.triggerEvents[this.lastTriggerIndex]?.time;
    }

    public getTriggered(time: number): any[] {
        if (this.isRewound(time)) {
            this.reset();
            return [];
        }
        const result: any[] = [];
        while (
            this.lastTriggerIndex + 1 < this.triggerEvents.length &&
            this.triggerEvents[this.lastTriggerIndex + 1].time <= time
        ) {
            this.lastTriggerIndex++;
            result.push(this.triggerEvents[this.lastTriggerIndex].event);
        }
        return result;
    }

    public hasTimeline(entity: string, property: string): boolean {
        return !!this.timelines.get(entity)?.has(property);
    }

    public hasAnyTimeline(entity: string): boolean {
        return this.timelines.has(entity) || this.discreteTimelines.has(entity);
    }

    public reset(): void {
        this.lastTriggerIndex = -1;
    }

    public getAllTileIndices(): Set<number> {
        const indices = new Set<number>();
        for (const entity of this.timelines.keys()) {
            if (!entity.startsWith('tile:')) continue;
            const idx = parseInt(entity.slice(5), 10);
            if (!isNaN(idx)) indices.add(idx);
        }
        return indices;
    }

    public getAnimatedTileIndices(): Set<number> {
        return this._animatedTileIndices;
    }

    /**
     * Returns true if any property of this tile has keyframes that span
     * across the given time — meaning the tile's values can change at this time.
     * If all keyframes are entirely before or after `time`, the tile is static.
     */
    public isTileActive(tileIdx: number, time: number): boolean {
        const props = this.timelines.get(`tile:${tileIdx}`);
        if (!props) return false;
        for (const kfs of props.values()) {
            if (kfs.length < 2) continue;
            if (time < kfs[kfs.length - 1].time) return true;
        }
        return false;
    }

    /* ── 通用 keyframe 添加（给 Camera/Decoration 用） ────────────── */

    public addKeyframe(entity: string, property: string, time: number, value: number, ease: string | null): void {
        const kfs = this.ensureTimeline(entity, property);
        const prevIdx = this.findKeyframeIndex(kfs, time);
        if (prevIdx >= 0 && Math.abs(kfs[prevIdx].time - time) < 1e-9) {
            kfs[prevIdx].value = value;
            kfs[prevIdx].ease = ease;
            return;
        }
        kfs.push({ time, value, ease });
        if (kfs.length > 1) kfs.sort((a, b) => a.time - b.time);
    }

    public addTween(entity: string, property: string, startTime: number, endTime: number, startValue: number, endValue: number, ease: string): void {
        const kfs = this.ensureTimeline(entity, property);
        const prevIdx = this.findKeyframeIndex(kfs, startTime);
        const actualStart = prevIdx >= 0
            ? this.interpolateTimeline(kfs, prevIdx, startTime)
            : (kfs[0]?.value ?? startValue);
        this.removeAfter(kfs, startTime + 1e-9);
        kfs.push({ time: startTime, value: actualStart, ease });
        kfs.push({ time: endTime, value: endValue, ease: null });
        if (kfs.length > 1) kfs.sort((a, b) => a.time - b.time);
    }

    /**
     * Instant event landing on a float timeline (official DOTween semantics for
     * zero-duration MoveDecorations fields): the previous ACTIVE tween of this
     * property is killed with complete:true (its end value is applied), then the
     * new value is set immediately and holds. Everything after `time` is wiped,
     * so a superseded tween's endpoint can never "resurrect" later.
     */
    public addInstantEvent(entity: string, property: string, time: number, value: number): void {
        this.instantKeyframe(entity, property, time, value);
    }

    /**
     * Tween entry with official ffxMoveDecorationsPlus DOTween semantics:
     * before creating the new tween, the previous tween of the same property is
     * killed with complete:true — it INSTANTLY jumps to its own end value at
     * `startTime`, and the new tween eases FROM that value (a visible mid-flight
     * discontinuity, unlike a smooth takeover).
     * The old curve is preserved up to startTime (severed there), then the snap
     * and the new eased segment follow.
     */
    public addTweenKillComplete(entity: string, property: string, startTime: number, endTime: number, fallbackStart: number, endValue: number, ease: string): void {
        const kfs = this.ensureTimeline(entity, property);
        const prevIdx = this.findKeyframeIndex(kfs, startTime);

        let actualStart: number;
        let severedTail: Keyframe | null = null;
        if (prevIdx >= 0 && prevIdx < kfs.length - 1) {
            const left = kfs[prevIdx];
            const right = kfs[prevIdx + 1];
            const insideActive = left.ease !== null
                && left.time <= startTime + 1e-9
                && right.time > startTime + 1e-9;
            if (insideActive) {
                // Kill(complete:true): old tween jumps to its end at startTime.
                actualStart = right.value;
                if (left.time < startTime - 1e-9) {
                    // Keep the old curve playable up to the snap point.
                    severedTail = { time: startTime, value: this.interpolateTimeline(kfs, prevIdx, startTime), ease: left.ease };
                }
            } else {
                actualStart = Math.abs(kfs[prevIdx].time - startTime) < 1e-9 ? kfs[prevIdx].value : this.interpolateTimeline(kfs, prevIdx, startTime);
            }
        } else if (prevIdx >= 0) {
            actualStart = kfs[prevIdx].value;
        } else {
            actualStart = kfs[0]?.value ?? fallbackStart;
        }

        this.removeAfter(kfs, startTime + 1e-9);
        if (severedTail) kfs.push(severedTail);
        kfs.push({ time: startTime, value: actualStart, ease });
        kfs.push({ time: endTime, value: endValue, ease: null });
        if (kfs.length > 1) kfs.sort((a, b) => a.time - b.time);
    }

    /**
     * Like addTween but does NOT remove keyframes after endTime.
     * Only removes keyframes BETWEEN startTime and endTime, preserving
     * existing keyframes after endTime (e.g. MoveTrack keyframes that
     * should take effect after a disappear animation completes).
     * Uses addKeyframe to handle duplicates at start/end times.
     */
    private pushTween(entity: string, property: string, startTime: number, endTime: number, endValue: number, ease: string): void {
        const kfs = this.ensureTimeline(entity, property);
        const prevIdx = this.findKeyframeIndex(kfs, startTime);
        const actualStart = prevIdx >= 0
            ? this.interpolateTimeline(kfs, prevIdx, startTime)
            : (kfs[0]?.value ?? 0);

        // Only remove keyframes strictly between start and end
        for (let i = kfs.length - 1; i >= 0; i--) {
            if (kfs[i].time > startTime + 1e-9 && kfs[i].time < endTime) {
                kfs.splice(i, 1);
            }
        }

        this.addKeyframe(entity, property, startTime, actualStart, ease);
        this.addKeyframe(entity, property, endTime, endValue, null);
    }

    private removeBetween(kfs: Keyframe[], start: number, end: number): void {
        for (let i = kfs.length - 1; i >= 0; i--) {
            if (kfs[i].time > start && kfs[i].time < end) {
                kfs.splice(i, 1);
            }
        }
    }

    /* ── 查询所有 entity 类型 ─────────────────────────────────────── */

    public get cameraEvents(): { time: number; event: any; floor: number; angleOffset: number }[] {
        return this._cameraEvents;
    }

    public getTriggerEvents(): { time: number; event: any }[] {
        return this.triggerEvents;
    }

    public getAllEntitiesByPrefix(prefix: string): string[] {
        const result: string[] = [];
        for (const entity of this.timelines.keys()) {
            if (entity.startsWith(prefix)) result.push(entity);
        }
        return result;
    }

    /* ── 工具 ────────────────────────────────────────────────────── */

    private parseTileReference(ref: any, currentFloor: number): number {
        if (Array.isArray(ref) && ref.length >= 2) {
            const offset = Number(ref[0]) || 0;
            const relativeTo = ref[1];
            if (relativeTo === 'ThisTile' || relativeTo === 0) {
                return currentFloor + offset;
            } else if (relativeTo === 'Start' || relativeTo === 1) {
                return offset;
            } else if (relativeTo === 'End' || relativeTo === 2) {
                    return (this.totalTiles - 1) + offset;
            }
        }
        return Number(ref) || currentFloor;
    }

    /* ── 批量应用到 mesh ─────────────────────────────────────────── */

    public applyToTileMesh(tileIdx: number, mesh: Mesh, time: number): boolean {
        const entity = `tile:${tileIdx}`;
        let dirty = false;

        const x = this.sample(entity, 'positionX', time);
        const y = this.sample(entity, 'positionY', time);
        const rot = this.sample(entity, 'rotation', time);
        const sx = this.sample(entity, 'scaleX', time);
        const sy = this.sample(entity, 'scaleY', time);
        const op = this.sample(entity, 'opacity', time);

        if (x !== undefined) { mesh.position.x = x; dirty = true; }
        if (y !== undefined) { mesh.position.y = y; dirty = true; }
        if (rot !== undefined) { mesh.rotation.z = rot; dirty = true; }
        if (sx !== undefined) { mesh.scale.x = sx; dirty = true; }
        if (sy !== undefined) { mesh.scale.y = sy; dirty = true; }
        if (op !== undefined) {
            mesh.userData.opacity = op;
            if (mesh.material) {
                if (mesh.material instanceof ShaderMaterial && mesh.material.uniforms?.opacity) {
                    mesh.material.uniforms.opacity.value = op;
                } else {
                    (mesh.material as any).opacity = op;
                }
                (mesh.material as any).transparent = op < 0.999;
            }
            mesh.visible = op > 0.001;
            mesh.traverse((child) => {
                if (child !== mesh && (child as any).material?.opacity !== undefined) {
                    (child as any).material.opacity = op;
                }
            });
            dirty = true;
        }

        return dirty;
    }

    /* ── AnimateTrack (Appear/Disappear) ─────────────────────────── */

    private buildAnimateTrackKeyframes(
        actions: any[],
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
        settings?: any,
    ): void {
        const animateTrackEvents: { floor: number; event: any; id: number }[] = [];
        for (const action of actions) {
            if (!isEventActive(action)) continue;
            if (action.eventType === 'AnimateTrack') {
                animateTrackEvents.push({
                    floor: action.floor ?? 0,
                    event: action,
                    id: action.id ?? Infinity,
                });
            }
        }
        animateTrackEvents.sort((a, b) => {
            if (a.floor !== b.floor) return a.floor - b.floor;
            return a.id - b.id;
        });

        let appearType: string = settings?.trackAnimation || 'None';
        let disappearType: string = settings?.trackDisappearAnimation || 'None';
        let beatsAhead: number = settings?.beatsAhead ?? 3;
        let beatsBehind: number = settings?.beatsBehind ?? 4;

        // C# ApplyEventsToFloors speed ratio tracking (num5/num6)
        // num5 = tileBPM at the AT event before the most recent
        // num6 = tileBPM at the most recent AT event
        // flag2 = whether the most recent AT event had trackAnimation enabled
        const baseTileBPM = this.tileBPM[0] || 100;
        let num5 = baseTileBPM;
        let num6 = baseTileBPM;
        let flag2 = false;

        let eventIdx = 0;
        for (let floor = 0; floor < this.totalTiles; floor++) {
            let hadAnimateTrack = false;
            let floorFlag2 = false;

            while (eventIdx < animateTrackEvents.length && animateTrackEvents[eventIdx].floor === floor) {
                const evt = animateTrackEvents[eventIdx].event;
                const hasTrackAnim = isFieldEnabled(evt, 'trackAnimation');
                const hasTrackDisappear = isFieldEnabled(evt, 'trackDisappearAnimation');

                if (hasTrackAnim) {
                    appearType = evt.trackAnimation || 'None';
                    if (evt.beatsAhead != null) beatsAhead = evt.beatsAhead;
                }
                if (hasTrackDisappear) {
                    disappearType = evt.trackDisappearAnimation || 'None';
                    if (evt.beatsBehind != null) beatsBehind = evt.beatsBehind;
                }

                // Update flag2 from this AT event (always, per C#)
                floorFlag2 = hasTrackAnim;
                hadAnimateTrack = true;
                eventIdx++;
            }

            if (hadAnimateTrack) {
                num5 = num6;
                num6 = this.tileBPM[floor] || baseTileBPM;
                flag2 = floorFlag2;
            }

            // Speed ratio scaling: beatsAhead *= speed / (flag2 ? num6 : num5)
            const speed = this.tileBPM[floor] || baseTileBPM;
            const refBPM = flag2 ? num6 : num5;
            const speedRatio = speed / refBPM;
            const scaledBeatsAhead = beatsAhead * speedRatio;
            const scaledBeatsBehind = beatsBehind * speedRatio;

            if (appearType !== 'None' && scaledBeatsAhead > 0) {
                this.buildAppearKeyframes(floor, appearType, scaledBeatsAhead, basePositions, baseRotations, baseScales, baseOpacities);
            }
            if (disappearType !== 'None' && scaledBeatsBehind > 0 && floor < this.totalTiles - 1) {
                const nextEntryTime = this.tileStartTimes[floor + 1] ?? 0;
                this.buildDisappearKeyframes(floor, disappearType, scaledBeatsBehind, nextEntryTime, basePositions, baseRotations, baseScales, baseOpacities);
            }
        }
    }

    private buildAppearKeyframes(
        floor: number,
        animType: string,
        beatsAhead: number,
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
    ): void {
        const entryTime = this.tileStartTimes[floor] || 0;
        const bpm = this.tileBPM[floor] || 100;
        const secPerBeat = 60 / bpm;

        const isDropOrRise = animType === 'Drop' || animType === 'Rise';
        const tiles = isDropOrRise ? beatsAhead * 2 : beatsAhead;
        const appearStartTime = Math.max(entryTime - tiles * secPerBeat, 0);

        const appearDuration = isDropOrRise
            ? secPerBeat * beatsAhead
            : Math.min(secPerBeat * 0.5, 0.5);
        const appearEndTime = appearStartTime + appearDuration;

        const baseX = basePositions[floor]?.x ?? 0;
        const baseY = basePositions[floor]?.y ?? 0;
        const baseRot = baseRotations[floor] ?? 0;
        const baseSX = baseScales[floor]?.x ?? 1;
        const baseSY = baseScales[floor]?.y ?? 1;
        const baseOp = baseOpacities[floor] ?? 1;

        const entity = `tile:${floor}`;
        const ease = isDropOrRise ? 'Linear.easeNone' : 'Quad.easeOut';

        switch (animType) {
            case 'Extend': {
                const prevX = floor > 0 ? (basePositions[floor - 1]?.x ?? baseX) : baseX;
                const prevY = floor > 0 ? (basePositions[floor - 1]?.y ?? baseY) : baseY;
                // Set initial state at time 0 and appearStartTime without removing
                // subsequent keyframes — MoveTrack keyframes after the appear
                // animation must be preserved (was: instantKeyframe + addTween
                // wiped them out, so MoveTrack never took effect after appear).
                this.addKeyframe(entity, 'positionX', 0, prevX, null);
                this.addKeyframe(entity, 'positionY', 0, prevY, null);
                this.addKeyframe(entity, 'scaleX', 0, 0, null);
                this.addKeyframe(entity, 'scaleY', 0, 0, null);
                this.addKeyframe(entity, 'positionX', appearStartTime, prevX, null);
                this.addKeyframe(entity, 'positionY', appearStartTime, prevY, null);
                this.addKeyframe(entity, 'scaleX', appearStartTime, 0, null);
                this.addKeyframe(entity, 'scaleY', appearStartTime, 0, null);
                this.pushTween(entity, 'positionX', appearStartTime, appearEndTime, baseX, ease);
                this.pushTween(entity, 'positionY', appearStartTime, appearEndTime, baseY, ease);
                this.pushTween(entity, 'scaleX', appearStartTime, appearEndTime, baseSX, ease);
                this.pushTween(entity, 'scaleY', appearStartTime, appearEndTime, baseSY, ease);
                break;
            }
            case 'Assemble':
            case 'Assemble_Far': {
                const range = animType === 'Assemble_Far' ? 8 : 4;
                const rotRange = 75;
                const seed = floor * 7919;
                const dx = this.seededRandom(seed) * range * 2 - range;
                const dy = this.seededRandom(seed + 1) * range * 2 - range;
                const dr = (this.seededRandom(seed + 2) * rotRange * 2 - rotRange) * Math.PI / 180;
                this.addKeyframe(entity, 'positionX', 0, baseX + dx, null);
                this.addKeyframe(entity, 'positionY', 0, baseY + dy, null);
                this.addKeyframe(entity, 'rotation', 0, baseRot + dr, null);
                this.addKeyframe(entity, 'positionX', appearStartTime, baseX + dx, null);
                this.addKeyframe(entity, 'positionY', appearStartTime, baseY + dy, null);
                this.addKeyframe(entity, 'rotation', appearStartTime, baseRot + dr, null);
                this.pushTween(entity, 'positionX', appearStartTime, appearEndTime, baseX, ease);
                this.pushTween(entity, 'positionY', appearStartTime, appearEndTime, baseY, ease);
                this.pushTween(entity, 'rotation', appearStartTime, appearEndTime, baseRot, ease);
                break;
            }
            case 'Grow': {
                this.addKeyframe(entity, 'scaleX', 0, 0, null);
                this.addKeyframe(entity, 'scaleY', 0, 0, null);
                this.addKeyframe(entity, 'scaleX', appearStartTime, 0, null);
                this.addKeyframe(entity, 'scaleY', appearStartTime, 0, null);
                this.pushTween(entity, 'scaleX', appearStartTime, appearEndTime, baseSX, ease);
                this.pushTween(entity, 'scaleY', appearStartTime, appearEndTime, baseSY, ease);
                break;
            }
            case 'Grow_Spin': {
                this.addKeyframe(entity, 'scaleX', 0, 0, null);
                this.addKeyframe(entity, 'scaleY', 0, 0, null);
                this.addKeyframe(entity, 'rotation', 0, baseRot - Math.PI, null);
                this.addKeyframe(entity, 'scaleX', appearStartTime, 0, null);
                this.addKeyframe(entity, 'scaleY', appearStartTime, 0, null);
                this.addKeyframe(entity, 'rotation', appearStartTime, baseRot - Math.PI, null);
                this.pushTween(entity, 'scaleX', appearStartTime, appearEndTime, baseSX, ease);
                this.pushTween(entity, 'scaleY', appearStartTime, appearEndTime, baseSY, ease);
                this.pushTween(entity, 'rotation', appearStartTime, appearEndTime, baseRot, ease);
                break;
            }
            case 'Fade': {
                this.addKeyframe(entity, 'opacity', 0, 0, null);
                this.addKeyframe(entity, 'opacity', appearStartTime, 0, null);
                this.pushTween(entity, 'opacity', appearStartTime, appearEndTime, baseOp, ease);
                break;
            }
            case 'Drop': {
                const scaleDur = appearDuration / 8;
                this.addKeyframe(entity, 'positionY', 0, baseY + 8, null);
                this.addKeyframe(entity, 'scaleX', 0, 0, null);
                this.addKeyframe(entity, 'scaleY', 0, 0, null);
                this.addKeyframe(entity, 'positionY', appearStartTime, baseY + 8, null);
                this.addKeyframe(entity, 'scaleX', appearStartTime, 0, null);
                this.addKeyframe(entity, 'scaleY', appearStartTime, 0, null);
                this.pushTween(entity, 'positionY', appearStartTime, appearEndTime, baseY, ease);
                this.pushTween(entity, 'scaleX', appearStartTime, appearStartTime + scaleDur, baseSX, 'Quad.easeOut');
                this.pushTween(entity, 'scaleY', appearStartTime, appearStartTime + scaleDur, baseSY, 'Quad.easeOut');
                break;
            }
            case 'Rise': {
                const scaleDur = appearDuration / 8;
                this.addKeyframe(entity, 'positionY', 0, baseY - 8, null);
                this.addKeyframe(entity, 'scaleX', 0, 0, null);
                this.addKeyframe(entity, 'scaleY', 0, 0, null);
                this.addKeyframe(entity, 'positionY', appearStartTime, baseY - 8, null);
                this.addKeyframe(entity, 'scaleX', appearStartTime, 0, null);
                this.addKeyframe(entity, 'scaleY', appearStartTime, 0, null);
                this.pushTween(entity, 'positionY', appearStartTime, appearEndTime, baseY, ease);
                this.pushTween(entity, 'scaleX', appearStartTime, appearStartTime + scaleDur, baseSX, 'Quad.easeOut');
                this.pushTween(entity, 'scaleY', appearStartTime, appearStartTime + scaleDur, baseSY, 'Quad.easeOut');
                break;
            }
        }
    }

    private buildDisappearKeyframes(
        floor: number,
        animType: string,
        beatsBehind: number,
        nextEntryTime: number,
        basePositions: Vector2[],
        baseRotations: number[],
        baseScales: Vector2[],
        baseOpacities: number[],
    ): void {
        const bpm = this.tileBPM[floor] || 100;
        const secPerBeat = 60 / bpm;
        const disappearStartTime = nextEntryTime + beatsBehind * secPerBeat;
        const disappearDuration = Math.min(secPerBeat * 0.5, 0.5);
        const disappearEndTime = disappearStartTime + disappearDuration;

        const baseX = basePositions[floor]?.x ?? 0;
        const baseY = basePositions[floor]?.y ?? 0;
        const baseRot = baseRotations[floor] ?? 0;
        const baseSX = baseScales[floor]?.x ?? 1;
        const baseSY = baseScales[floor]?.y ?? 1;
        const baseOp = baseOpacities[floor] ?? 1;

        const entity = `tile:${floor}`;
        const ease = 'Quad.easeOut';

        switch (animType) {
            case 'Scatter':
            case 'Scatter_Far': {
                const range = animType === 'Scatter_Far' ? 8 : 4;
                const seed = floor * 3571 + 1000;
                const dx = this.seededRandom(seed) * range * 2 - range;
                const dy = this.seededRandom(seed + 1) * range * 2 - range;
                const dr = (this.seededRandom(seed + 2) * 150 - 75) * Math.PI / 180;
                this.pushTween(entity, 'positionX', disappearStartTime, disappearEndTime, baseX + dx, ease);
                this.pushTween(entity, 'positionY', disappearStartTime, disappearEndTime, baseY + dy, ease);
                this.pushTween(entity, 'rotation', disappearStartTime, disappearEndTime, baseRot + dr, ease);
                break;
            }
            case 'Retract': {
                const nextX = basePositions[floor + 1]?.x ?? baseX;
                const nextY = basePositions[floor + 1]?.y ?? baseY;
                this.pushTween(entity, 'positionX', disappearStartTime, disappearEndTime, nextX, ease);
                this.pushTween(entity, 'positionY', disappearStartTime, disappearEndTime, nextY, ease);
                this.pushTween(entity, 'scaleX', disappearStartTime, disappearEndTime, 0, ease);
                this.pushTween(entity, 'scaleY', disappearStartTime, disappearEndTime, 0, ease);
                break;
            }
            case 'Shrink': {
                this.pushTween(entity, 'scaleX', disappearStartTime, disappearEndTime, 0, ease);
                this.pushTween(entity, 'scaleY', disappearStartTime, disappearEndTime, 0, ease);
                break;
            }
            case 'Shrink_Spin': {
                this.pushTween(entity, 'scaleX', disappearStartTime, disappearEndTime, 0, ease);
                this.pushTween(entity, 'scaleY', disappearStartTime, disappearEndTime, 0, ease);
                this.pushTween(entity, 'rotation', disappearStartTime, disappearEndTime, baseRot - Math.PI, ease);
                break;
            }
            case 'Fade': {
                this.pushTween(entity, 'opacity', disappearStartTime, disappearEndTime, 0, ease);
                break;
            }
        }
    }

    private seededRandom(seed: number): number {
        const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
        return x - Math.floor(x);
    }
}
