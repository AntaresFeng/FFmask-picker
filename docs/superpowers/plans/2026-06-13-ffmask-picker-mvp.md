# FFmask Picker MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based tool for drawing rectangles on video frames and generating FFmpeg drawbox filter parameters, output as a single HTML file.

**Architecture:** Immersive layout with full-screen canvas, top toolbar, and collapsible right drawer panel. Hidden `<video>` element for decoding, canvas for rendering frames and rectangles. Pub-sub state management with snapshot-based undo/redo. All modules share a central `AppState` via subscribe/notify pattern.

**Tech Stack:** Vanilla TypeScript, Vite 8, vite-plugin-singlefile, no framework, no test framework.

**Spec:** `docs/superpowers/specs/2026-06-13-ffmask-picker-mvp-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/types.ts` | Shared type definitions (Rectangle, AppState, Color) |
| `src/timecode.ts` | Timecode conversion utilities (seconds ↔ HH:MM:SS:FF) |
| `src/export.ts` | FFmpeg drawbox parameter generation, clipboard copy, JSON export |
| `src/state.ts` | Central state management, pub-sub notifications, undo/redo snapshots |
| `src/style.css` | Global dark theme styles, toolbar/drawer/canvas layout |
| `index.html` | App shell: video element, canvas, toolbar container, drawer container |
| `src/canvas.ts` | Canvas rendering loop: frame drawing, rectangle drawing, minimap |
| `src/toolbar.ts` | Toolbar UI: upload, playback, mode/color buttons, export dropdown |
| `src/drawer.ts` | Drawer panel: rectangle list, property editor, export buttons |
| `src/interaction.ts` | Mouse/keyboard event handling: draw, select, resize, move, zoom, pan |
| `src/main.ts` | Entry point: initialize state, wire modules, start render loop |

---

### Task 1: Type Definitions (`src/types.ts`)

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/types.ts

export type Color = 'red' | 'blue' | 'green'

export interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: Color
  thickness: number
  visible: boolean
  timeRange?: {
    start: number // seconds
    end: number   // seconds
  }
}

export interface AppState {
  videoSrc: string | null // Object URL
  fps: number
  duration: number         // seconds
  currentTime: number      // seconds
  rectangles: Rectangle[]
  selectedId: string | null
  mode: 'draw' | 'select'
  currentColor: Color
  zoom: number
  panX: number
  panY: number
}

export type Listener = (state: AppState) => void
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 2: Timecode Utilities (`src/timecode.ts`)

**Files:**
- Create: `src/timecode.ts`

- [ ] **Step 1: Create the timecode module**

```typescript
// src/timecode.ts

/**
 * Convert total seconds to HH:MM:SS:FF timecode string.
 * @param totalSeconds - Time in seconds (can be fractional)
 * @param fps - Frames per second
 * @returns Timecode string like "00:01:23:15"
 */
export function secondsToTimecode(totalSeconds: number, fps: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const totalFrames = Math.floor(totalSeconds * fps)
  const ff = totalFrames % fps
  const totalSec = Math.floor(totalFrames / fps)
  const ss = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  return [hh, mm, ss, ff].map(v => String(v).padStart(2, '0')).join(':')
}

/**
 * Convert HH:MM:SS:FF timecode string to total seconds.
 * @param timecode - Timecode string "HH:MM:SS:FF"
 * @param fps - Frames per second
 * @returns Time in seconds
 */
export function timecodeToSeconds(timecode: string, fps: number): number {
  const parts = timecode.split(':').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return 0
  const [hh, mm, ss, ff] = parts
  return hh * 3600 + mm * 60 + ss + ff / fps
}

/**
 * Format seconds as MM:SS or HH:MM:SS for display.
 */
export function formatTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const s = Math.floor(totalSeconds)
  const ss = s % 60
  const totalMin = Math.floor(s / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }
  return `${mm}:${String(ss).padStart(2, '0')}`
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 3: Export Module (`src/export.ts`)

**Files:**
- Create: `src/export.ts`

- [ ] **Step 1: Create the export module**

```typescript
// src/export.ts

import type { Rectangle } from './types'
import { secondsToTimecode } from './timecode'

/**
 * Generate a single drawbox filter string for one rectangle.
 */
export function drawboxString(rect: Rectangle, fps: number): string {
  let s = `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}:color=${rect.color}:t=${rect.thickness}`
  if (rect.timeRange) {
    const start = rect.timeRange.start
    const end = rect.timeRange.end
    s += `:enable='between(t,${start},${end})'`
  }
  return s
}

/**
 * Generate combined drawbox filter string for all visible rectangles.
 * Returns the value for -vf "..." (without the outer quotes).
 */
export function allDrawboxString(rectangles: Rectangle[], fps: number): string {
  return rectangles
    .filter(r => r.visible)
    .map(r => drawboxString(r, fps))
    .join(',')
}

/**
 * Generate a full ffmpeg command string.
 */
export function fullCommand(rectangles: Rectangle[], fps: number): string {
  const vf = allDrawboxString(rectangles, fps)
  return `ffmpeg -i input.mp4 -vf "${vf}" output.mp4`
}

/**
 * Export rectangles as JSON config.
 */
export function exportJson(rectangles: Rectangle[], fps: number): string {
  const data = rectangles.map(r => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: r.color,
    thickness: r.thickness,
    visible: r.visible,
    timeRange: r.timeRange
      ? {
          start: r.timeRange.start,
          end: r.timeRange.end,
          startTimecode: secondsToTimecode(r.timeRange.start, fps),
          endTimecode: secondsToTimecode(r.timeRange.end, fps),
        }
      : null,
  }))
  return JSON.stringify(data, null, 2)
}

/**
 * Copy text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Trigger a file download.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 4: State Management (`src/state.ts`)

**Files:**
- Create: `src/state.ts`

- [ ] **Step 1: Create the state module**

```typescript
// src/state.ts

import type { AppState, Listener, Rectangle, Color } from './types'

const MAX_HISTORY = 50

let state: AppState = {
  videoSrc: null,
  fps: 30,
  duration: 0,
  currentTime: 0,
  rectangles: [],
  selectedId: null,
  mode: 'draw',
  currentColor: 'red',
  zoom: 1,
  panX: 0,
  panY: 0,
}

let history: AppState[] = []
let historyIndex = -1
const listeners = new Set<Listener>()

function cloneState(s: AppState): AppState {
  return {
    ...s,
    rectangles: s.rectangles.map(r => ({ ...r, timeRange: r.timeRange ? { ...r.timeRange } : undefined })),
  }
}

export function getState(): AppState {
  return state
}

export function setState(partial: Partial<AppState>): void {
  state = { ...state, ...partial }
  notify()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function notify(): void {
  for (const fn of listeners) fn(state)
}

/** Save current state to history for undo. Call BEFORE making changes. */
export function pushHistory(): void {
  // Discard any redo states
  history = history.slice(0, historyIndex + 1)
  history.push(cloneState(state))
  if (history.length > MAX_HISTORY) history.shift()
  historyIndex = history.length - 1
}

export function undo(): void {
  if (historyIndex <= 0) return
  historyIndex--
  state = cloneState(history[historyIndex])
  notify()
}

export function redo(): void {
  if (historyIndex >= history.length - 1) return
  historyIndex++
  state = cloneState(history[historyIndex])
  notify()
}

export function canUndo(): boolean {
  return historyIndex > 0
}

export function canRedo(): boolean {
  return historyIndex < history.length - 1
}

// --- Rectangle helpers ---

let nextId = 1

export function createRectangle(overrides?: Partial<Rectangle>): Rectangle {
  return {
    id: `rect-${nextId++}`,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    color: state.currentColor,
    thickness: 4,
    visible: true,
    ...overrides,
  }
}

export function addRectangle(rect: Rectangle): void {
  pushHistory()
  setState({ rectangles: [...state.rectangles, rect], selectedId: rect.id })
}

export function updateRectangle(id: string, partial: Partial<Rectangle>): void {
  pushHistory()
  setState({
    rectangles: state.rectangles.map(r => (r.id === id ? { ...r, ...partial } : r)),
  })
}

export function removeRectangle(id: string): void {
  pushHistory()
  const rects = state.rectangles.filter(r => r.id !== id)
  setState({
    rectangles: rects,
    selectedId: state.selectedId === id ? null : state.selectedId,
  })
}

export function getSelectedRect(): Rectangle | undefined {
  return state.rectangles.find(r => r.id === state.selectedId)
}

// Drag state (shared between interaction and canvas to avoid circular import)
export interface DragState {
  type: 'draw' | 'move' | 'resize' | 'pan'
  startX: number
  startY: number
  drawStartFrameX?: number
  drawStartFrameY?: number
  moveRectId?: string
  moveOrigX?: number
  moveOrigY?: number
  resizeRectId?: string
  resizeHandle?: number
  resizeOrigRect?: Rectangle
}

let dragState: DragState | null = null

export function getDragState(): DragState | null {
  return dragState
}

export function setDragState(d: DragState | null): void {
  dragState = d
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 5: Global Styles (`src/style.css`)

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: Replace style.css with the application theme**

```css
/* src/style.css */

:root {
  --bg-primary: #1a1a2e;
  --bg-secondary: #222233;
  --bg-tertiary: #2a2a3a;
  --bg-toolbar: #1e1e2e;
  --text-primary: #e0e0e0;
  --text-secondary: #aaa;
  --text-muted: #666;
  --accent: #5a5aaa;
  --accent-hover: #7070cc;
  --border: #444;
  --red: #ff4444;
  --blue: #4488ff;
  --green: #44cc44;
  --success: #4a7a4a;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-primary);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-primary);
  overflow: hidden;
  width: 100vw;
  height: 100vh;
}

#app {
  display: flex;
  flex-direction: column;
  width: 100vw;
  height: 100vh;
}

/* --- Upload overlay --- */
#upload-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  background: var(--bg-primary);
}

#upload-overlay .upload-box {
  border: 2px dashed var(--border);
  border-radius: 12px;
  padding: 3rem 4rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

#upload-overlay .upload-box:hover,
#upload-overlay .upload-box.dragover {
  border-color: var(--accent);
}

#upload-overlay .upload-box h2 {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}

#upload-overlay .upload-box p {
  color: var(--text-secondary);
}

/* --- Toolbar --- */
#toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-toolbar);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 6px;
}

.toolbar-sep {
  width: 1px;
  height: 24px;
  background: var(--border);
  flex-shrink: 0;
}

.toolbar-spacer { flex: 1; }

.toolbar-group label {
  color: var(--blue);
  font-size: 11px;
  margin-right: 4px;
  white-space: nowrap;
}

button {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

button:hover { background: var(--accent); }

button.active {
  background: var(--accent);
  border-color: var(--accent-hover);
}

button.primary {
  background: var(--success);
  border-color: var(--success);
  font-weight: bold;
}

#frame-display {
  background: #222;
  padding: 4px 10px;
  border-radius: 4px;
  color: var(--blue);
  font-family: monospace;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  border: 1px solid var(--border);
  min-width: 90px;
  text-align: center;
}

#frame-slider {
  flex: 1;
  min-width: 60px;
  accent-color: var(--blue);
}

.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-swatch.active { border-color: #fff; }

.color-swatch[data-color="red"] { background: var(--red); }
.color-swatch[data-color="blue"] { background: var(--blue); }
.color-swatch[data-color="green"] { background: var(--green); }

/* --- Main area --- */
#main-area {
  display: flex;
  flex: 1;
  min-height: 0;
  position: relative;
}

#canvas-container {
  flex: 1;
  position: relative;
  overflow: hidden;
}

#main-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

#minimap {
  position: absolute;
  bottom: 12px;
  left: 12px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  border-radius: 4px;
  pointer-events: none;
}

/* --- Drawer --- */
#drawer {
  width: 240px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width 0.2s;
  overflow: hidden;
}

#drawer.collapsed {
  width: 36px;
}

#drawer.collapsed .drawer-content { display: none; }

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.drawer-header span { color: var(--blue); font-weight: bold; }
.drawer-header .close-btn { cursor: pointer; color: var(--text-secondary); background: none; border: none; font-size: 16px; }

.rect-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
}

.rect-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  margin-bottom: 3px;
  cursor: pointer;
  border: 1px solid transparent;
}

.rect-item.selected { background: #3a3a5a; border-color: var(--accent); }

.rect-item .color-dot {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  flex-shrink: 0;
}

.rect-item .rect-name { flex: 1; }

.rect-item .time-hint {
  color: var(--text-muted);
  font-size: 10px;
}

.rect-item .visibility-btn {
  cursor: pointer;
  font-size: 14px;
  background: none;
  border: none;
  color: var(--text-secondary);
  padding: 0;
}

.rect-item .visibility-btn.hidden { opacity: 0.3; }

.add-rect-btn {
  width: 100%;
  background: transparent;
  border: 1px dashed var(--border);
  color: var(--text-muted);
  padding: 4px;
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}

.add-rect-btn:hover { border-color: var(--accent); color: var(--text-secondary); }

/* --- Properties panel --- */
.props-panel {
  padding: 6px 10px;
  border-top: 1px solid var(--border);
}

.props-panel .props-title {
  color: var(--blue);
  font-size: 11px;
  font-weight: bold;
  margin-bottom: 6px;
}

.props-grid {
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 4px 8px;
  align-items: center;
  font-size: 11px;
}

.props-grid label { color: var(--text-secondary); }

.props-grid input {
  background: #333;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 3px 6px;
  border-radius: 3px;
  width: 100%;
  font-size: 11px;
}

.props-grid input[type="number"] { -moz-appearance: textfield; }

.color-options {
  display: flex;
  gap: 4px;
}

.color-option {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  border: 2px solid transparent;
  cursor: pointer;
}

.color-option.active { border-color: #fff; }
.color-option[data-color="red"] { background: var(--red); }
.color-option[data-color="blue"] { background: var(--blue); }
.color-option[data-color="green"] { background: var(--green); }

.time-range-toggle {
  margin-top: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--text-secondary);
}

.time-range-fields {
  margin-top: 4px;
  display: grid;
  grid-template-columns: 50px 1fr;
  gap: 4px 8px;
  align-items: center;
  font-size: 11px;
}

.time-range-fields input {
  background: #333;
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 3px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
}

/* --- Export area --- */
.export-area {
  padding: 6px;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.export-area button {
  width: 100%;
  text-align: left;
  font-size: 11px;
  padding: 5px 8px;
}

/* --- Toast notification --- */
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  padding: 8px 20px;
  border-radius: 6px;
  border: 1px solid var(--border);
  font-size: 12px;
  z-index: 200;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.toast.show { opacity: 1; }

/* --- Export dropdown --- */
.export-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  min-width: 200px;
  z-index: 50;
  display: none;
}

.export-dropdown.open { display: block; }

.export-dropdown button {
  width: 100%;
  text-align: left;
  background: transparent;
  border: none;
  padding: 6px 10px;
  font-size: 12px;
}

.export-dropdown button:hover { background: var(--bg-tertiary); }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 6: HTML Shell (`index.html`)

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Replace index.html with the app shell**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FFmask Picker</title>
  </head>
  <body>
    <div id="app">
      <!-- Upload overlay -->
      <div id="upload-overlay">
        <div class="upload-box" id="upload-box">
          <h2>上传视频</h2>
          <p>拖拽文件到此处，或点击选择</p>
          <p style="margin-top:0.5rem;font-size:11px;color:#666">支持 mp4、webm、ogg 等浏览器原生格式</p>
          <input type="file" id="file-input" accept="video/*" style="display:none" />
        </div>
      </div>

      <!-- Toolbar (hidden until video loaded) -->
      <div id="toolbar" style="display:none">
        <!-- Upload -->
        <div class="toolbar-group">
          <button id="btn-upload">上传</button>
        </div>
        <div class="toolbar-sep"></div>

        <!-- Frame navigation -->
        <div class="toolbar-group" style="flex:1;min-width:0">
          <button id="btn-play" title="播放/暂停">▶</button>
          <span id="frame-display" title="点击切换帧数/时间码">0 / 0</span>
          <input type="range" id="frame-slider" min="0" max="100" value="0" />
        </div>
        <div class="toolbar-sep"></div>

        <!-- Mode -->
        <div class="toolbar-group">
          <button id="btn-mode-draw" class="active">✦ 绘制</button>
          <button id="btn-mode-select">◇ 选择</button>
        </div>
        <div class="toolbar-sep"></div>

        <!-- Color -->
        <div class="toolbar-group">
          <div class="color-swatch active" data-color="red"></div>
          <div class="color-swatch" data-color="blue"></div>
          <div class="color-swatch" data-color="green"></div>
        </div>
        <div class="toolbar-sep"></div>

        <!-- Actions -->
        <div class="toolbar-group">
          <button id="btn-undo" title="撤销">↩</button>
          <button id="btn-redo" title="重做">↪</button>
        </div>
        <div style="position:relative">
          <button id="btn-export" class="primary">导出 ▾</button>
          <div class="export-dropdown" id="export-dropdown">
            <button id="export-current">📋 复制当前矩形参数</button>
            <button id="export-all">📋 复制全部矩形参数</button>
            <button id="export-json">💾 导出 JSON 配置文件</button>
          </div>
        </div>
        <button id="btn-drawer-toggle" title="展开/折叠面板">☰</button>
      </div>

      <!-- Main area -->
      <div id="main-area" style="display:none">
        <div id="canvas-container">
          <canvas id="main-canvas"></canvas>
          <canvas id="minimap" width="120" height="80"></canvas>
        </div>
        <div id="drawer">
          <div class="drawer-header">
            <span>矩形</span>
            <button class="close-btn" id="drawer-close">✕</button>
          </div>
          <div class="drawer-content">
            <div class="rect-list" id="rect-list"></div>
            <div style="padding:4px 6px">
              <button class="add-rect-btn" id="btn-add-rect">+ 添加矩形</button>
            </div>
            <div class="props-panel" id="props-panel" style="display:none">
              <div class="props-title">属性</div>
              <div class="props-grid">
                <label>X</label><input type="number" id="prop-x" />
                <label>Y</label><input type="number" id="prop-y" />
                <label>宽</label><input type="number" id="prop-w" />
                <label>高</label><input type="number" id="prop-h" />
                <label>颜色</label>
                <div class="color-options">
                  <div class="color-option" data-color="red"></div>
                  <div class="color-option" data-color="blue"></div>
                  <div class="color-option" data-color="green"></div>
                </div>
                <label>粗细</label><input type="number" id="prop-thickness" min="1" max="20" />
              </div>
              <div class="time-range-toggle">
                <input type="checkbox" id="prop-time-enabled" />
                <label for="prop-time-enabled">时间范围</label>
              </div>
              <div class="time-range-fields" id="time-range-fields" style="display:none">
                <label>开始</label><input type="text" id="prop-time-start" placeholder="HH:MM:SS:FF" />
                <label>结束</label><input type="text" id="prop-time-end" placeholder="HH:MM:SS:FF" />
              </div>
            </div>
            <div class="export-area">
              <button id="export-current-side">📋 复制当前矩形参数</button>
              <button id="export-all-side">📋 复制全部矩形参数</button>
              <button id="export-json-side">💾 导出 JSON 配置文件</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast" id="toast"></div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: Verify dev server starts**

Run: `pnpm dev`
Expected: Page loads at localhost, shows upload overlay.

---

### Task 7: Canvas Rendering (`src/canvas.ts`)

**Files:**
- Create: `src/canvas.ts`

- [ ] **Step 1: Create the canvas rendering module**

```typescript
// src/canvas.ts

import { getState } from './state'
import type { AppState, Rectangle } from './types'

const HANDLE_SIZE = 8
const MINIMAP_W = 120
const MINIMAP_H = 80

let canvas: HTMLCanvasElement
let ctx: CanvasRenderingContext2D
let minimapCanvas: HTMLCanvasElement
let minimapCtx: CanvasRenderingContext2D
let videoEl: HTMLVideoElement

const COLOR_MAP: Record<string, string> = {
  red: '#ff4444',
  blue: '#4488ff',
  green: '#44cc44',
}

export function initCanvas(): void {
  canvas = document.getElementById('main-canvas') as HTMLCanvasElement
  ctx = canvas.getContext('2d')!
  minimapCanvas = document.getElementById('minimap') as HTMLCanvasElement
  minimapCtx = minimapCanvas.getContext('2d')!

  // Create hidden video element
  videoEl = document.createElement('video')
  videoEl.id = 'hidden-video'
  videoEl.style.display = 'none'
  videoEl.playsInline = true
  videoEl.muted = true
  document.body.appendChild(videoEl)

  resizeCanvas()
  window.addEventListener('resize', resizeCanvas)
}

function resizeCanvas(): void {
  const container = document.getElementById('canvas-container')!
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight
}

export function getVideoElement(): HTMLVideoElement {
  return videoEl
}

export function getCanvasElement(): HTMLCanvasElement {
  return canvas
}

export function getCanvasSize(): { w: number; h: number } {
  return { w: canvas.width, h: canvas.height }
}

/** Convert screen coordinates to video-frame coordinates. */
export function screenToFrame(sx: number, sy: number): { x: number; y: number } {
  const s = getState()
  const naturalW = videoEl.videoWidth || 1920
  const naturalH = videoEl.videoHeight || 1080
  const scale = Math.min(canvas.width / naturalW, canvas.height / naturalH) * s.zoom
  const offsetX = (canvas.width - naturalW * scale) / 2 + s.panX
  const offsetY = (canvas.height - naturalH * scale) / 2 + s.panY
  return {
    x: (sx - offsetX) / scale,
    y: (sy - offsetY) / scale,
  }
}

/** Convert video-frame coordinates to screen coordinates. */
export function frameToScreen(fx: number, fy: number): { x: number; y: number } {
  const s = getState()
  const naturalW = videoEl.videoWidth || 1920
  const naturalH = videoEl.videoHeight || 1080
  const scale = Math.min(canvas.width / naturalW, canvas.height / naturalH) * s.zoom
  const offsetX = (canvas.width - naturalW * scale) / 2 + s.panX
  const offsetY = (canvas.height - naturalH * scale) / 2 + s.panY
  return {
    x: fx * scale + offsetX,
    y: fy * scale + offsetY,
  }
}

export function getScale(): number {
  const s = getState()
  const naturalW = videoEl.videoWidth || 1920
  const naturalH = videoEl.videoHeight || 1080
  return Math.min(canvas.width / naturalW, canvas.height / naturalH) * s.zoom
}

/** Get the drawbox control points (8 handles) for a rectangle in screen space. */
export function getHandlePositions(rect: Rectangle): { x: number; y: number; cursor: string }[] {
  const tl = frameToScreen(rect.x, rect.y)
  const br = frameToScreen(rect.x + rect.width, rect.y + rect.height)
  const mx = (tl.x + br.x) / 2
  const my = (tl.y + br.y) / 2
  return [
    { x: tl.x, y: tl.y, cursor: 'nwse-resize' },
    { x: mx, y: tl.y, cursor: 'ns-resize' },
    { x: br.x, y: tl.y, cursor: 'nesw-resize' },
    { x: tl.x, y: my, cursor: 'ew-resize' },
    { x: br.x, y: my, cursor: 'ew-resize' },
    { x: tl.x, y: br.y, cursor: 'nesw-resize' },
    { x: mx, y: br.y, cursor: 'ns-resize' },
    { x: br.x, y: br.y, cursor: 'nwse-resize' },
  ]
}

/** Find which handle (if any) is under the cursor. Returns index 0-7 or -1. */
export function hitTestHandle(rect: Rectangle, sx: number, sy: number): number {
  const handles = getHandlePositions(rect)
  const half = HANDLE_SIZE
  for (let i = 0; i < handles.length; i++) {
    if (Math.abs(sx - handles[i].x) <= half && Math.abs(sy - handles[i].y) <= half) {
      return i
    }
  }
  return -1
}

/** Check if screen point is inside a rectangle's area. */
export function hitTestRect(rect: Rectangle, sx: number, sy: number): boolean {
  const tl = frameToScreen(rect.x, rect.y)
  const br = frameToScreen(rect.x + rect.width, rect.y + rect.height)
  return sx >= tl.x && sx <= br.x && sy >= tl.y && sy <= br.y
}

/** Main render loop. Call once, then it self-schedules. */
export function renderLoop(): void {
  render()
  requestAnimationFrame(renderLoop)
}

function render(): void {
  const s = getState()
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Draw video frame
  if (videoEl.readyState >= 2) {
    const naturalW = videoEl.videoWidth
    const naturalH = videoEl.videoHeight
    const scale = getScale()
    const { x: ox, y: oy } = frameToScreen(0, 0)
    ctx.drawImage(videoEl, ox, oy, naturalW * scale, naturalH * scale)
  }

  // Draw rectangles
  for (const rect of s.rectangles) {
    if (!rect.visible) continue
    drawRectangle(rect, s)
  }

  // Draw minimap
  renderMinimap(s)
}

function drawRectangle(rect: Rectangle, s: AppState): void {
  const color = COLOR_MAP[rect.color] || rect.color
  const tl = frameToScreen(rect.x, rect.y)
  const br = frameToScreen(rect.x + rect.width, rect.y + rect.height)
  const w = br.x - tl.x
  const h = br.y - tl.y

  const isSelected = s.selectedId === rect.id
  const isOtherSelected = s.selectedId !== null && s.selectedId !== rect.id

  ctx.save()
  if (isOtherSelected) ctx.globalAlpha = 0.5

  // Fill for selected
  if (isSelected) {
    ctx.fillStyle = color + '14' // ~8% opacity
    ctx.fillRect(tl.x, tl.y, w, h)
  }

  // Border
  ctx.strokeStyle = color
  ctx.lineWidth = isSelected ? 3 : 2
  ctx.setLineDash(isSelected ? [] : [])
  ctx.strokeRect(tl.x, tl.y, w, h)

  // Control points for selected
  if (isSelected) {
    const handles = getHandlePositions(rect)
    for (const handle of handles) {
      ctx.fillStyle = '#fff'
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.fillRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
      ctx.strokeRect(handle.x - HANDLE_SIZE / 2, handle.y - HANDLE_SIZE / 2, HANDLE_SIZE, HANDLE_SIZE)
    }
  }

  ctx.restore()
}

/** Draw a temporary rectangle while dragging in draw mode. */
export function drawTempRect(x1: number, y1: number, x2: number, y2: number, color: string): void {
  const s1 = frameToScreen(x1, y1)
  const s2 = frameToScreen(x2, y2)
  ctx.save()
  ctx.strokeStyle = COLOR_MAP[color] || color
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y)
  ctx.restore()
}

function renderMinimap(s: AppState): void {
  if (!videoEl.readyState) return
  minimapCtx.clearRect(0, 0, MINIMAP_W, MINIMAP_H)
  minimapCtx.fillStyle = '#2a2a3a'
  minimapCtx.fillRect(0, 0, MINIMAP_W, MINIMAP_H)

  // Draw scaled video frame
  const naturalW = videoEl.videoWidth
  const naturalH = videoEl.videoHeight
  const mmScale = Math.min(MINIMAP_W / naturalW, MINIMAP_H / naturalH)
  const mmW = naturalW * mmScale
  const mmH = naturalH * mmScale
  const mmOx = (MINIMAP_W - mmW) / 2
  const mmOy = (MINIMAP_H - mmH) / 2
  minimapCtx.globalAlpha = 0.4
  minimapCtx.drawImage(videoEl, mmOx, mmOy, mmW, mmH)
  minimapCtx.globalAlpha = 1

  // Draw viewport rectangle
  const scale = getScale()
  const viewW = canvas.width / scale * mmScale
  const viewH = canvas.height / scale * mmScale
  const { x: originX, y: originY } = frameToScreen(0, 0)
  const vpX = mmOx + (-originX / scale) * mmScale
  const vpY = mmOy + (-originY / scale) * mmScale
  minimapCtx.strokeStyle = '#8af'
  minimapCtx.lineWidth = 1
  minimapCtx.strokeRect(vpX, vpY, viewW, viewH)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors (some unused variable warnings may appear; these will resolve when main.ts wires things together).

---

### Task 8: Toolbar Module (`src/toolbar.ts`)

**Files:**
- Create: `src/toolbar.ts`

- [ ] **Step 1: Create the toolbar module**

```typescript
// src/toolbar.ts

import { getState, setState, subscribe, undo, redo, canUndo, canRedo, pushHistory } from './state'
import { getVideoElement } from './canvas'
import { formatTime } from './timecode'
import type { Color } from './types'

let displayMode: 'frame' | 'time' = 'frame'

export function initToolbar(): void {
  setupUpload()
  setupPlayback()
  setupDisplayToggle()
  setupModeButtons()
  setupColorSwatches()
  setupUndoRedo()
  setupExportDropdown()

  subscribe(updateToolbarState)
  updateToolbarState(getState())
}

function setupUpload(): void {
  const btn = document.getElementById('btn-upload')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  btn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) loadVideoFile(file)
  })
}

export function loadVideoFile(file: File): void {
  const video = getVideoElement()
  const url = URL.createObjectURL(file)

  // Revoke previous URL
  const prev = getState().videoSrc
  if (prev) URL.revokeObjectURL(prev)

  video.src = url
  video.load()

  video.addEventListener('loadedmetadata', () => {
    const fps = 30 // Default; precise FPS detection is unreliable in browsers
    setState({
      videoSrc: url,
      fps,
      duration: video.duration,
      currentTime: 0,
    })

    // Show working UI, hide upload overlay
    document.getElementById('upload-overlay')!.style.display = 'none'
    document.getElementById('toolbar')!.style.display = 'flex'
    document.getElementById('main-area')!.style.display = 'flex'

    // Update slider
    const slider = document.getElementById('frame-slider') as HTMLInputElement
    slider.max = String(Math.floor(video.duration * fps))
    slider.value = '0'

    // Seek to first frame
    video.currentTime = 0
  }, { once: true })
}

function setupPlayback(): void {
  const btn = document.getElementById('btn-play')!
  const slider = document.getElementById('frame-slider') as HTMLInputElement
  const video = getVideoElement()

  btn.addEventListener('click', () => {
    if (video.paused) {
      video.play()
      btn.textContent = '⏸'
    } else {
      video.pause()
      btn.textContent = '▶'
    }
  })

  video.addEventListener('play', () => { btn.textContent = '⏸' })
  video.addEventListener('pause', () => { btn.textContent = '▶' })

  video.addEventListener('timeupdate', () => {
    const s = getState()
    setState({ currentTime: video.currentTime })
    slider.value = String(Math.floor(video.currentTime * s.fps))
    updateFrameDisplay()
  })

  slider.addEventListener('input', () => {
    const s = getState()
    const frame = Number(slider.value)
    video.currentTime = frame / s.fps
    setState({ currentTime: video.currentTime })
    updateFrameDisplay()
  })
}

function setupDisplayToggle(): void {
  const display = document.getElementById('frame-display')!
  display.addEventListener('click', () => {
    displayMode = displayMode === 'frame' ? 'time' : 'frame'
    updateFrameDisplay()
  })
}

function updateFrameDisplay(): void {
  const s = getState()
  const display = document.getElementById('frame-display')!
  if (displayMode === 'frame') {
    const current = Math.floor(s.currentTime * s.fps)
    const total = Math.floor(s.duration * s.fps)
    display.textContent = `${current} / ${total}`
  } else {
    display.textContent = `${formatTime(s.currentTime)} / ${formatTime(s.duration)}`
  }
}

function setupModeButtons(): void {
  const btnDraw = document.getElementById('btn-mode-draw')!
  const btnSelect = document.getElementById('btn-mode-select')!

  btnDraw.addEventListener('click', () => {
    setState({ mode: 'draw', selectedId: null })
  })
  btnSelect.addEventListener('click', () => {
    setState({ mode: 'select' })
  })
}

function setupColorSwatches(): void {
  const swatches = document.querySelectorAll('.color-swatch')
  swatches.forEach(el => {
    el.addEventListener('click', () => {
      const color = (el as HTMLElement).dataset.color as Color
      setState({ currentColor: color })
    })
  })
}

function setupUndoRedo(): void {
  document.getElementById('btn-undo')!.addEventListener('click', undo)
  document.getElementById('btn-redo')!.addEventListener('click', redo)
}

function setupExportDropdown(): void {
  const btn = document.getElementById('btn-export')!
  const dropdown = document.getElementById('export-dropdown')!

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('open')
  })

  document.addEventListener('click', () => {
    dropdown.classList.remove('open')
  })
}

function updateToolbarState(s: AppState): void {
  // Mode buttons
  document.getElementById('btn-mode-draw')!.className = s.mode === 'draw' ? 'active' : ''
  document.getElementById('btn-mode-select')!.className = s.mode === 'select' ? 'active' : ''

  // Color swatches
  document.querySelectorAll('.color-swatch').forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.className = htmlEl.dataset.color === s.currentColor
      ? 'color-swatch active'
      : 'color-swatch'
  })

  // Undo/redo
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement
  btnUndo.disabled = !canUndo()
  btnRedo.disabled = !canRedo()
  btnUndo.style.opacity = canUndo() ? '1' : '0.4'
  btnRedo.style.opacity = canRedo() ? '1' : '0.4'

  updateFrameDisplay()
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 9: Drawer Module (`src/drawer.ts`)

**Files:**
- Create: `src/drawer.ts`

- [ ] **Step 1: Create the drawer module**

```typescript
// src/drawer.ts

import { getState, setState, subscribe, addRectangle, updateRectangle, removeRectangle, createRectangle, pushHistory } from './state'
import { secondsToTimecode, timecodeToSeconds } from './timecode'
import { drawboxString, allDrawboxString, exportJson, copyToClipboard, downloadFile } from './export'
import type { Rectangle, Color } from './types'
import { showToast } from './main'

const COLOR_DOT_MAP: Record<string, string> = {
  red: '#ff4444',
  blue: '#4488ff',
  green: '#44cc44',
}

export function initDrawer(): void {
  setupToggle()
  setupAddButton()
  setupPropertyInputs()
  setupExportButtons()

  subscribe(renderDrawer)
  renderDrawer(getState())
}

function setupToggle(): void {
  const drawer = document.getElementById('drawer')!
  document.getElementById('btn-drawer-toggle')!.addEventListener('click', () => {
    drawer.classList.toggle('collapsed')
  })
  document.getElementById('drawer-close')!.addEventListener('click', () => {
    drawer.classList.add('collapsed')
  })
}

function setupAddButton(): void {
  document.getElementById('btn-add-rect')!.addEventListener('click', () => {
    const rect = createRectangle()
    addRectangle(rect)
  })
}

function renderDrawer(s: ReturnType<typeof getState>): void {
  renderRectList(s)
  renderPropsPanel(s)
}

function renderRectList(s: ReturnType<typeof getState>): void {
  const container = document.getElementById('rect-list')!
  container.innerHTML = ''

  for (const rect of s.rectangles) {
    const item = document.createElement('div')
    item.className = `rect-item${s.selectedId === rect.id ? ' selected' : ''}`
    item.innerHTML = `
      <div class="color-dot" style="background:${COLOR_DOT_MAP[rect.color]}"></div>
      <span class="rect-name">矩形 ${rect.id.replace('rect-', '')}</span>
      <span class="time-hint">${rect.timeRange ? `${formatSeconds(rect.timeRange.start)}-${formatSeconds(rect.timeRange.end)}` : '全视频'}</span>
      <button class="visibility-btn${rect.visible ? '' : ' hidden'}" data-id="${rect.id}">👁</button>
    `
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('visibility-btn')) return
      setState({ selectedId: rect.id, mode: 'select' })
    })
    container.appendChild(item)
  }

  // Visibility buttons
  container.querySelectorAll('.visibility-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id!
      const rect = s.rectangles.find(r => r.id === id)
      if (rect) {
        pushHistory()
        updateRectangle(id, { visible: !rect.visible })
      }
    })
  })
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function renderPropsPanel(s: ReturnType<typeof getState>): void {
  const panel = document.getElementById('props-panel')!
  const rect = s.rectangles.find(r => r.id === s.selectedId)

  if (!rect) {
    panel.style.display = 'none'
    return
  }
  panel.style.display = ''

  const fields: [string, number][] = [
    ['prop-x', rect.x],
    ['prop-y', rect.y],
    ['prop-w', rect.width],
    ['prop-h', rect.height],
    ['prop-thickness', rect.thickness],
  ]
  for (const [id, val] of fields) {
    const input = document.getElementById(id) as HTMLInputElement
    if (document.activeElement !== input) input.value = String(Math.round(val))
  }

  // Color options
  document.querySelectorAll('.color-option').forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.className = htmlEl.dataset.color === rect.color
      ? 'color-option active'
      : 'color-option'
  })

  // Time range
  const timeCheckbox = document.getElementById('prop-time-enabled') as HTMLInputElement
  const timeFields = document.getElementById('time-range-fields')!
  const hasTime = !!rect.timeRange
  timeCheckbox.checked = hasTime
  timeFields.style.display = hasTime ? '' : 'none'

  if (hasTime && rect.timeRange) {
    const fps = s.fps
    const startInput = document.getElementById('prop-time-start') as HTMLInputElement
    const endInput = document.getElementById('prop-time-end') as HTMLInputElement
    if (document.activeElement !== startInput) {
      startInput.value = secondsToTimecode(rect.timeRange.start, fps)
    }
    if (document.activeElement !== endInput) {
      endInput.value = secondsToTimecode(rect.timeRange.end, fps)
    }
  }
}

function setupPropertyInputs(): void {
  const ids = ['prop-x', 'prop-y', 'prop-w', 'prop-h', 'prop-thickness']
  for (const id of ids) {
    document.getElementById(id)!.addEventListener('change', () => {
      const s = getState()
      if (!s.selectedId) return
      const prop = id.replace('prop-', '')
      const val = Number((document.getElementById(id) as HTMLInputElement).value)
      const mapping: Record<string, string> = { x: 'x', y: 'y', w: 'width', h: 'height', thickness: 'thickness' }
      pushHistory()
      updateRectangle(s.selectedId, { [mapping[prop]]: val })
    })
  }

  // Color options in props
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      const s = getState()
      if (!s.selectedId) return
      pushHistory()
      updateRectangle(s.selectedId, { color: (el as HTMLElement).dataset.color as Color })
    })
  })

  // Time range toggle
  document.getElementById('prop-time-enabled')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const checkbox = document.getElementById('prop-time-enabled') as HTMLInputElement
    pushHistory()
    if (checkbox.checked) {
      updateRectangle(s.selectedId, {
        timeRange: { start: 0, end: s.duration },
      })
    } else {
      updateRectangle(s.selectedId, { timeRange: undefined })
    }
  })

  // Time range inputs
  document.getElementById('prop-time-start')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const rect = s.rectangles.find(r => r.id === s.selectedId)
    if (!rect?.timeRange) return
    const val = (document.getElementById('prop-time-start') as HTMLInputElement).value
    pushHistory()
    updateRectangle(s.selectedId, {
      timeRange: { ...rect.timeRange, start: timecodeToSeconds(val, s.fps) },
    })
  })

  document.getElementById('prop-time-end')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const rect = s.rectangles.find(r => r.id === s.selectedId)
    if (!rect?.timeRange) return
    const val = (document.getElementById('prop-time-end') as HTMLInputElement).value
    pushHistory()
    updateRectangle(s.selectedId, {
      timeRange: { ...rect.timeRange, end: timecodeToSeconds(val, s.fps) },
    })
  })
}

function setupExportButtons(): void {
  // Toolbar dropdown buttons
  document.getElementById('export-current')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json')!.addEventListener('click', () => exportJsonFile())

  // Drawer side buttons
  document.getElementById('export-current-side')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all-side')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json-side')!.addEventListener('click', () => exportJsonFile())
}

async function exportCurrent(): Promise<void> {
  const s = getState()
  const rect = s.rectangles.find(r => r.id === s.selectedId)
  if (!rect) { showToast('请先选中一个矩形'); return }
  const text = drawboxString(rect, s.fps)
  await copyToClipboard(text)
  showToast('已复制到剪贴板')
}

async function exportAll(): Promise<void> {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const text = allDrawboxString(s.rectangles, s.fps)
  await copyToClipboard(text)
  showToast('已复制全部参数到剪贴板')
}

function exportJsonFile(): void {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const json = exportJson(s.rectangles, s.fps)
  downloadFile(json, 'ffmask-config.json', 'application/json')
  showToast('JSON 文件已下载')
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 10: Interaction Module (`src/interaction.ts`)

**Files:**
- Create: `src/interaction.ts`

- [ ] **Step 1: Create the interaction module**

```typescript
// src/interaction.ts

import { getState, setState, addRectangle, updateRectangle, pushHistory, createRectangle, getDragState, setDragState } from './state'
import { getCanvasElement, screenToFrame, frameToScreen, hitTestHandle, hitTestRect, getScale } from './canvas'
import type { Rectangle } from './types'

export function initInteraction(): void {
  const canvas = getCanvasElement()

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', e => e.preventDefault())
}

function onMouseDown(e: MouseEvent): void {
  const s = getState()
  const sx = e.offsetX
  const sy = e.offsetY

  // Middle button → pan
  if (e.button === 1) {
    setDragState({ type: 'pan', startX: sx, startY: sy })
    return
  }

  // Left button only
  if (e.button !== 0) return

  if (s.mode === 'draw') {
    const frame = screenToFrame(sx, sy)
    setDragState({
      type: 'draw',
      startX: sx,
      startY: sy,
      drawStartFrameX: frame.x,
      drawStartFrameY: frame.y,
    })
  } else if (s.mode === 'select') {
    const selected = s.rectangles.find(r => r.id === s.selectedId)
    if (selected) {
      const handleIdx = hitTestHandle(selected, sx, sy)
      if (handleIdx >= 0) {
        setDragState({
          type: 'resize',
          startX: sx,
          startY: sy,
          resizeRectId: selected.id,
          resizeHandle: handleIdx,
          resizeOrigRect: { ...selected, timeRange: selected.timeRange ? { ...selected.timeRange } : undefined },
        })
        return
      }
    }

    for (let i = s.rectangles.length - 1; i >= 0; i--) {
      const rect = s.rectangles[i]
      if (!rect.visible) continue
      if (hitTestRect(rect, sx, sy)) {
        setState({ selectedId: rect.id })
        const frame = screenToFrame(sx, sy)
        setDragState({
          type: 'move',
          startX: sx,
          startY: sy,
          moveRectId: rect.id,
          moveOrigX: rect.x,
          moveOrigY: rect.y,
        })
        return
      }
    }

    setState({ selectedId: null })
  }
}

function onMouseMove(e: MouseEvent): void {
  const drag = getDragState()
  if (!drag) {
    updateCursor(e)
    return
  }

  const sx = e.offsetX
  const sy = e.offsetY

  if (drag.type === 'pan') {
    const dx = sx - drag.startX
    const dy = sy - drag.startY
    const s = getState()
    setDragState({ ...drag, startX: sx, startY: sy })
    setState({ panX: s.panX + dx, panY: s.panY + dy })
    return
  }

  if (drag.type === 'draw') {
    return
  }

  if (drag.type === 'move' && drag.moveRectId) {
    const dx = (sx - drag.startX) / getScale()
    const dy = (sy - drag.startY) / getScale()
    const s = getState()
    const rect = s.rectangles.find(r => r.id === drag.moveRectId)
    if (rect) {
      updateRectangle(drag.moveRectId, {
        x: Math.round(drag.moveOrigX! + dx),
        y: Math.round(drag.moveOrigY! + dy),
      })
    }
    return
  }

  if (drag.type === 'resize' && drag.resizeRectId && drag.resizeOrigRect) {
    const orig = drag.resizeOrigRect
    const frame = screenToFrame(sx, sy)
    const handle = drag.resizeHandle!
    let { x, y, width, height } = orig

    if (handle === 0 || handle === 3 || handle === 5) {
      const newX = Math.min(frame.x, x + width)
      width = x + width - newX
      x = newX
    }
    if (handle === 2 || handle === 4 || handle === 7) {
      width = frame.x - x
    }
    if (handle === 0 || handle === 1 || handle === 2) {
      const newY = Math.min(frame.y, y + height)
      height = y + height - newY
      y = newY
    }
    if (handle === 5 || handle === 6 || handle === 7) {
      height = frame.y - y
    }

    if (width < 1) width = 1
    if (height < 1) height = 1

    updateRectangle(drag.resizeRectId, {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(width),
      height: Math.round(height),
    })
    return
  }
}

function onMouseUp(e: MouseEvent): void {
  const drag = getDragState()
  if (!drag) return

  if (drag.type === 'move' || drag.type === 'resize') {
    pushHistory()
  }

  if (drag.type === 'draw') {
    const sx = e.offsetX
    const sy = e.offsetY
    const start = { x: drag.drawStartFrameX!, y: drag.drawStartFrameY! }
    const end = screenToFrame(sx, sy)

    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const w = Math.abs(end.x - start.x)
    const h = Math.abs(end.y - start.y)

    if (w > 5 && h > 5) {
      const rect = createRectangle({
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(w),
        height: Math.round(h),
      })
      addRectangle(rect)
    }
  }

  setDragState(null)
}

function onWheel(e: WheelEvent): void {
  e.preventDefault()
  const s = getState()
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(20, s.zoom * delta))

  // Zoom toward cursor
  const sx = e.offsetX
  const sy = e.offsetY
  const scaleOld = getScale()
  const naturalW = 1920 // approximate; will be correct once video loads
  const naturalH = 1080
  const cx = sx - s.panX
  const cy = sy - s.panY
  const ratio = newZoom / s.zoom

  setState({
    zoom: newZoom,
    panX: sx - cx * ratio,
    panY: sy - cy * ratio,
  })
}

function updateCursor(e: MouseEvent): void {
  const canvas = getCanvasElement()
  const s = getState()
  const sx = e.offsetX
  const sy = e.offsetY

  if (s.mode === 'draw') {
    canvas.style.cursor = 'crosshair'
    return
  }

  // Select mode
  const selected = s.rectangles.find(r => r.id === s.selectedId)
  if (selected && selected.visible) {
    const handleIdx = hitTestHandle(selected, sx, sy)
    if (handleIdx >= 0) {
      const handles = [
        'nwse-resize', 'ns-resize', 'nesw-resize',
        'ew-resize', 'ew-resize',
        'nesw-resize', 'ns-resize', 'nwse-resize',
      ]
      canvas.style.cursor = handles[handleIdx]
      return
    }
  }

  // Check if hovering over a rect
  for (let i = s.rectangles.length - 1; i >= 0; i--) {
    const rect = s.rectangles[i]
    if (!rect.visible) continue
    if (hitTestRect(rect, sx, sy)) {
      canvas.style.cursor = 'move'
      return
    }
  }

  canvas.style.cursor = 'default'
}

```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

---

### Task 11: Main Entry Point (`src/main.ts`)

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Replace main.ts with the wiring module**

```typescript
// src/main.ts

import './style.css'
import { initCanvas, renderLoop } from './canvas'
import { initToolbar, loadVideoFile } from './toolbar'
import { initDrawer } from './drawer'
import { initInteraction } from './interaction'

// Toast utility
let toastTimer: number | undefined

export function showToast(message: string): void {
  const toast = document.getElementById('toast')!
  toast.textContent = message
  toast.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show')
  }, 2000)
}

// Initialize
function main(): void {
  initCanvas()
  initToolbar()
  initDrawer()
  initInteraction()
  setupUploadOverlay()

  // Start render loop with temp-rect drawing
  const origRender = renderLoop
  requestAnimationFrame(function loop() {
    renderWithTempRect()
    requestAnimationFrame(loop)
  })
}

function renderWithTempRect(): void {
  // The canvas module's renderLoop handles frame + rects + minimap.
  // We add temp-rect drawing on top.
  // Since renderLoop is already running, we just draw the temp rect here.
  // Actually, let's integrate: call renderLoop's internal render via import.
  // For simplicity, the renderLoop in canvas.ts already runs; we add a post-render hook.
  // We'll use a simpler approach: override the render loop.
  // This is handled by making renderLoop export the render function.
  // For now, the canvas renderLoop self-schedules. We need to draw temp rect after it.
  // Solution: use the subscribe pattern to draw temp rect after state changes.
  // Simplest: just call drawTempRect in the animation frame.
  const drag = getDragState()
  if (drag?.type === 'draw' && drag.drawStartFrameX !== undefined) {
    const s = getState()
    const canvas = document.getElementById('main-canvas') as HTMLCanvasElement
    const ctx = canvas.getContext('2d')!
    const sx = (window as any).__lastMouseX ?? 0
    const sy = (window as any).__lastMouseY ?? 0
    const end = screenToFrame(sx, sy)
    const { drawTempRect: drawTemp } = require('./canvas')
    // This won't work with ESM. Let's use a different approach.
    // We'll track the mouse position globally and draw in the canvas render.
  }
}

function setupUploadOverlay(): void {
  const overlay = document.getElementById('upload-overlay')!
  const box = document.getElementById('upload-box')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  box.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) loadVideoFile(file)
  })

  // Drag and drop
  box.addEventListener('dragover', (e) => {
    e.preventDefault()
    box.classList.add('dragover')
  })
  box.addEventListener('dragleave', () => {
    box.classList.remove('dragover')
  })
  box.addEventListener('drop', (e) => {
    e.preventDefault()
    box.classList.remove('dragover')
    const file = e.dataTransfer?.files[0]
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file)
    }
  })
}

main()
```

- [ ] **Step 2: Fix the temp-rect rendering approach**

The above `main.ts` has issues with the temp-rect drawing. The clean approach: integrate temp-rect drawing into `canvas.ts` by having it check the drag state. Update `canvas.ts` to import drag state and draw the temp rect. Also, track mouse position globally.

Replace the `renderLoop` in `canvas.ts` to include temp-rect drawing:

```typescript
// Add to canvas.ts — at the bottom, update renderLoop:

import { getDragState } from './interaction'

// Track mouse position for temp rect
let lastMouseX = 0
let lastMouseY = 0

export function trackMouse(e: MouseEvent): void {
  lastMouseX = e.offsetX
  lastMouseY = e.offsetY
}

// Replace the existing renderLoop function with:
export function renderLoop(): void {
  render()
  // Draw temp rect if in draw-drag
  const drag = getDragState()
  if (drag?.type === 'draw' && drag.drawStartFrameX !== undefined) {
    const end = screenToFrame(lastMouseX, lastMouseY)
    drawTempRect(drag.drawStartFrameX, drag.drawStartFrameY, end.x, end.y, getState().currentColor)
  }
  requestAnimationFrame(renderLoop)
}
```

Then update `main.ts` to wire the mouse tracking:

```typescript
// In main.ts, replace the main() function:
function main(): void {
  initCanvas()
  initToolbar()
  initDrawer()
  initInteraction()
  setupUploadOverlay()

  // Track mouse for temp rect drawing
  const canvas = document.getElementById('main-canvas')!
  canvas.addEventListener('mousemove', (e) => {
    // Import trackMouse from canvas
    // This is handled via the interaction module's mousemove
    // We'll use a global approach
    ;(window as any).__lastMouseX = e.offsetX
    ;(window as any).__lastMouseY = e.offsetY
  })

  renderLoop()
}
```

Actually, let me write the clean final versions instead of iterative patches.

- [ ] **Step 3: Rewrite canvas.ts renderLoop to include temp rect**

In `canvas.ts`, replace the `renderLoop` function and add mouse tracking:

```typescript
// canvas.ts — add these imports and exports:

// Add at top:
import { getDragState } from './state'

// Add mouse tracking:
let lastMouseX = 0
let lastMouseY = 0

export function setLastMouse(x: number, y: number): void {
  lastMouseX = x
  lastMouseY = y
}

// Replace renderLoop:
export function renderLoop(): void {
  render()
  const drag = getDragState()
  if (drag?.type === 'draw' && drag.drawStartFrameX !== undefined) {
    const end = screenToFrame(lastMouseX, lastMouseY)
    drawTempRect(drag.drawStartFrameX, drag.drawStartFrameY, end.x, end.y, getState().currentColor)
  }
  requestAnimationFrame(renderLoop)
}
```

- [ ] **Step 4: Rewrite main.ts cleanly**

```typescript
// src/main.ts

import './style.css'
import { initCanvas, renderLoop, setLastMouse } from './canvas'
import { initToolbar, loadVideoFile } from './toolbar'
import { initDrawer } from './drawer'
import { initInteraction } from './interaction'

// Toast utility
let toastTimer: number | undefined

export function showToast(message: string): void {
  const toast = document.getElementById('toast')!
  toast.textContent = message
  toast.classList.add('show')
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('show')
  }, 2000)
}

function setupUploadOverlay(): void {
  const box = document.getElementById('upload-box')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  box.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) loadVideoFile(file)
  })

  box.addEventListener('dragover', (e) => {
    e.preventDefault()
    box.classList.add('dragover')
  })
  box.addEventListener('dragleave', () => {
    box.classList.remove('dragover')
  })
  box.addEventListener('drop', (e) => {
    e.preventDefault()
    box.classList.remove('dragover')
    const file = e.dataTransfer?.files[0]
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file)
    }
  })
}

function main(): void {
  initCanvas()
  initToolbar()
  initDrawer()
  initInteraction()
  setupUploadOverlay()

  // Track mouse position for temp-rect rendering
  const canvas = document.getElementById('main-canvas')!
  canvas.addEventListener('mousemove', (e) => {
    setLastMouse(e.offsetX, e.offsetY)
  })

  renderLoop()
}

main()
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Verify build succeeds**

Run: `pnpm build`
Expected: `dist/ffmask-picker.html` is produced.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: implement FFmask Picker MVP"
```

---

### Task 12: Final Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 2: Run build**

Run: `pnpm build`
Expected: `dist/ffmask-picker.html` produced, single file with all assets inlined.

- [ ] **Step 3: Test in browser**

Open `dist/ffmask-picker.html` in a browser:
1. Upload overlay should appear
2. Upload a video file
3. Toolbar and canvas should appear
4. Play/pause should work
5. Frame slider should seek
6. Draw mode: drag to create rectangles
7. Select mode: click to select, drag handles to resize, drag inside to move
8. Drawer: list shows rectangles, property editing works
9. Export buttons copy to clipboard / download JSON
10. Undo/redo works
11. Minimap shows viewport position
12. Scroll to zoom, middle-drag to pan

- [ ] **Step 4: Commit final state**

```bash
git add -A
git commit -m "chore: final build verification"
```
