# Player Module Architecture

This directory contains the core player module for the ADOFAI level player.

## Current Structure

### Core Files
- **Player.ts** (~2750 lines) - Main player class that orchestrates all functionality
- **types.ts** - TypeScript interfaces and types

### Manager Classes (Existing)
- **CameraController.ts** - Camera movements and transitions
- **TileColorManager.ts** - Tile color configuration and events
- **DecorationManager.ts** - Decoration rendering
- **MoveTrackManager.ts** - MoveTrack event processing
- **PositionTrackManager.ts** - PositionTrack transforms
- **HitsoundManager.ts** - Hit sound synthesis and playback

### Manager Classes (New - Available for Future Refactoring)
- **TileRenderer.ts** (~450 lines) - Tile mesh creation, visibility, caching
- **VideoBackground.ts** (~230 lines) - Video background playback
- **InputHandler.ts** (~210 lines) - Mouse/touch input handling
- **EffectsManager.ts** (~440 lines) - Visual effects (Bloom, Flash, Recolor, CustomBG)

### Effects
- **BloomEffect.ts** - Bloom post-processing effect
- **FlashEffect.ts** - Flash overlay effect

### Other
- **Planet.ts** - Player planet mesh
- **PlanetTrail.ts** - Planet trail effect
- **Easing.ts** - Easing functions
- **HTMLAudioMusic.ts** - Audio playback with AudioContext sync

## Future Refactoring Guide

The Player.ts file has grown large due to accumulating features. To refactor:

1. **Tile Rendering** - Move to TileRenderer.ts:
   - updateVisibleTiles()
   - getOrCreateTileMesh()
   - cleanupTileCache()
   - buildSpatialIndex()
   - Variables: tiles, visibleTiles, spatialGrid, geometryCache

2. **Video Background** - Move to VideoBackground.ts:
   - loadVideo()
   - updateVideoSize()
   - syncVideo()
   - Variables: videoElement, videoTexture, videoMesh

3. **Input Handling** - Move to InputHandler.ts:
   - onMouseDown/Move/Up()
   - onWheel()
   - onTouchStart/Move/End()
   - Variables: isDragging, previousMousePosition, etc.

4. **Visual Effects** - Move to EffectsManager.ts:
   - buildBloomTimeline(), processBloomEvent()
   - buildFlashTimeline(), processFlashEvent()
   - buildRecolorTimeline(), processRecolorEvent()
   - Variables: bloomTimeline, flashTimeline, etc.

## Integration Pattern

When integrating, use delegation:

```typescript
class Player {
  private tileRenderer: TileRenderer;
  
  constructor() {
    this.tileRenderer = new TileRenderer(
      this.scene,
      this.camera,
      this.levelData,
      this.tileColorManager,
      this.positionTrackManager,
      this.tileEvents
    );
  }
  
  private updateVisibleTiles(): void {
    this.tileRenderer.setCameraPosition(this.cameraPosition);
    this.tileRenderer.updateVisibleTiles();
  }
}
```

## Why Not Refactored Yet?

The current Player.ts works correctly and is stable. Large-scale refactoring:
- Risks introducing bugs
- Requires extensive testing
- May break existing functionality

The new manager classes are provided as a **foundation** for future refactoring when:
- Time permits thorough testing
- The codebase needs architectural improvements
- Performance optimization is required

## Line Count Summary

| File | Lines | Purpose |
|------|-------|---------|
| Player.ts | ~2750 | Main orchestrator |
| TileRenderer.ts | ~450 | Tile rendering (new) |
| EffectsManager.ts | ~440 | Visual effects (new) |
| VideoBackground.ts | ~230 | Video playback (new) |
| InputHandler.ts | ~210 | Input handling (new) |

Total new modularized code: ~1330 lines

If fully integrated, Player.ts could be reduced from ~2750 to ~1500 lines.
