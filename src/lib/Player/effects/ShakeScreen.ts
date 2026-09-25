import { Vector2 } from 'three';
import { EasingFunctions } from '../Easing';

interface ShakeState {
    active: boolean;
    startTime: number;
    duration: number;
    strength: number;
    intensity: number;
    fadeOut: boolean;
    ease: string;
    vibrato: number;
}

export class ShakeScreen {
    private fgState: ShakeState = ShakeScreen.createInactive();
    private bgState: ShakeState = ShakeScreen.createInactive();
    private shakeOffset: Vector2 = new Vector2(0, 0);

    private static createInactive(): ShakeState {
        return {
            active: false,
            startTime: 0,
            duration: 0,
            strength: 0,
            intensity: 0,
            fadeOut: false,
            ease: 'Linear',
            vibrato: 0,
        };
    }

    startShake(
        currentTime: number,
        strength: number,
        intensity: number,
        duration: number,
        ease: string,
        fadeOut: boolean,
        plane: 'FG' | 'BG',
    ): void {
        const state = plane === 'FG' ? this.fgState : this.bgState;
        state.active = true;
        state.startTime = currentTime;
        state.strength = strength;
        state.intensity = intensity;
        state.duration = duration;
        state.ease = ease || 'Linear';
        state.fadeOut = fadeOut;
        state.vibrato = Math.max(1, Math.round(20 * intensity));
    }

    update(currentTime: number): Vector2 {
        if (!this.fgState.active && !this.bgState.active) {
            this.shakeOffset.set(0, 0);
            return this.shakeOffset;
        }

        let offsetX = 0;
        let offsetY = 0;

        for (const state of [this.fgState, this.bgState]) {
            if (!state.active) continue;

            const elapsed = currentTime - state.startTime;
            let progress = state.duration > 0 ? elapsed / state.duration : 1;
            if (progress >= 1) {
                state.active = false;
                continue;
            }
            if (progress < 0) progress = 0;

            // Compute envelope multiplier based on ease
            let envelope: number;
            const easeName = state.ease || 'Linear';
            if (easeName === 'Linear') {
                envelope = 1;
            } else if (easeName.startsWith('InOut')) {
                // 0 → 1 → 0
                const t = EasingFunctions[easeName] ? EasingFunctions[easeName](progress) : progress;
                envelope = t < 0.5 ? t * 2 : 2 - t * 2;
            } else if (easeName.startsWith('Out')) {
                // 1 → 0
                const t = EasingFunctions[easeName] ? EasingFunctions[easeName](progress) : progress;
                envelope = 1 - t;
            } else {
                // 0 → 1 (multiplier tween from 0→1 for In/Back/etc.)
                const t = EasingFunctions[easeName] ? EasingFunctions[easeName](progress) : progress;
                envelope = t;
            }

            // fadeOut: additional decay
            if (state.fadeOut) {
                envelope *= (1 - progress);
            }

            const amp = state.strength * envelope;
            const vibrato = state.vibrato;
            const phase = progress * vibrato * Math.PI * 2;

            // Deterministic shake: sine waves at two frequencies
            const seed = state.startTime * 1000;
            offsetX += amp * Math.sin(phase * 1.3 + seed * 0.1);
            offsetY += amp * Math.sin(phase * 0.7 + seed * 0.3 + 1.2);
        }

        this.shakeOffset.set(offsetX, offsetY);
        return this.shakeOffset;
    }

    getShakeOffset(): Vector2 {
        return this.shakeOffset;
    }

    stop(): void {
        this.fgState.active = false;
        this.bgState.active = false;
        this.shakeOffset.set(0, 0);
    }
}
