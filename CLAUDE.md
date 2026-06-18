# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FFmask Picker is a browser-based visual tool for creating FFmpeg `drawbox` filter parameters. Users upload a video, draw rectangles on frames, configure properties (color, opacity, thickness, time ranges), and export the resulting FFmpeg filter strings or JSON config files. The UI is in Chinese (zh-CN).

## Commands

```bash
pnpm dev       # Start Vite dev server
pnpm typecheck # Type-check (tsc)
pnpm build     # build → dist/ffmask-picker.html (single file, all assets inlined)
pnpm preview   # Preview production build
```

No test runner or linter is configured. TypeScript strict mode is the primary quality check (`tsc` with `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`).

## Architecture

Vanilla TypeScript, no framework. Single HTML entry point (`index.html`) with all UI defined inline; scripts and styles are in `src/`.

### State Management (`src/state.ts`)

Custom pub/sub store with a **split-state design**:

- **`GlobalState`** — non-undoable: video info, zoom/pan, draw/select mode, current color
- **`HistoryState`** — undoable: `rectangles[]` and `selectedId`. Backed by a history stack (max 50 entries) for undo/redo.

`pushHistory()` must be called **explicitly after discrete actions** (add, delete, move-end, resize-end, property change). Do NOT call it during continuous operations (slider drag, mouse move, opacity slide). `updateRectangle()` silently updates state (no history, no notify); callers must follow with `pushHistory()` (which notifies) or call `notify()` directly for non-history updates. `addRectangle()`/`removeRectangle()` auto-push history.

Consumers use `subscribe(listener)` to react to state changes. `getState()` returns the merged `AppState` (GlobalState + HistoryState).

### Module Responsibilities

| Module | Role |
|---|---|
| `state.ts` | Central store, undo/redo, rectangle CRUD, drag state |
| `canvas.ts` | Canvas rendering loop, video frame display, coordinate transforms (`screenToFrame`/`frameToScreen`), minimap, hit testing |
| `interaction.ts` | Mouse/keyboard handlers: draw mode (drag to create rect), select mode (click to select, drag to move/resize), wheel zoom, pan, keyboard shortcuts |
| `toolbar.ts` | Toolbar UI wiring: upload, playback control, time slider (ms), color picker, speed selector, undo/redo buttons |
| `drawer.ts` | Side panel: rectangle list, property editing (position, size, color, opacity, thickness, filled, time range), export buttons |
| `export.ts` | Generate FFmpeg `drawbox` filter strings, full ffmpeg command, JSON config; clipboard and file download helpers |
| `timecode.ts` | Time formatting (`formatTime`) and user input parsing (`parseTimeInput`) |
| `types.ts` | `Rectangle`, `GlobalState`, `HistoryState`, `AppState`, `Listener` types |
| `toast.ts` | Simple toast notification |

### Coordinate System

All rectangle coordinates are in **video-frame pixel space** (natural resolution of the video). Canvas rendering converts to screen space via `frameToScreen()` considering zoom and pan. When creating or resizing rectangles, screen coordinates are converted back via `screenToFrame()`.

### Build

Vite 8 + `vite-plugin-singlefile` produces a single self-contained HTML file with all JS/CSS/assets inlined. The build script renames `dist/index.html` → `dist/ffmask-picker.html`.

## Known Issues

See `issues.txt` for tracked problems including zoom center point offset and UI sizing.
