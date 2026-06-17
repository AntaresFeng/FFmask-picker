# Remove FPS Dependency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all frame-based concepts from the codebase, switching everything to time-based (seconds/milliseconds).

**Architecture:** Delete `fps` from state, simplify `timeRange` to seconds-only, convert the slider to millisecond steps, and remove all frame/time mode toggle UI. Six files touched, each task is independently committable.

**Tech Stack:** Vanilla TypeScript, Vite, `tsc --noEmit` for type checking (no test runner).

---

### Task 1: Simplify types — remove `fps`, remove `timeRange.mode`

**Files:**
- Modify: `src/types.ts:1-42`

- [ ] **Step 1: Edit `src/types.ts`**

Remove `fps` from `GlobalState`. Remove `mode` from `timeRange`:

```ts
// src/types.ts

export type Color = string

export interface Rectangle {
  id: string
  x: number
  y: number
  width: number
  height: number
  color: Color
  thickness: number
  filled: boolean
  opacity: number // 0.0 - 1.0
  visible: boolean
  timeRange?: {
    start: number // seconds
    end: number   // seconds
  }
}

export interface GlobalState {
  videoSrc: string | null // Object URL
  duration: number         // seconds
  currentTime: number      // seconds
  mode: 'draw' | 'select'
  currentColor: Color
  zoom: number
  panX: number
  panY: number
}

export interface HistoryState {
  rectangles: Rectangle[]
  selectedId: string | null
}

export type AppState = GlobalState & HistoryState

export type Listener = (state: AppState) => void
```

- [ ] **Step 2: Type-check**

Run: `pnpm build` (runs `tsc` + vite build)
Expected: TypeScript errors in `state.ts`, `toolbar.ts`, `drawer.ts`, `export.ts` — all referencing removed `fps` field. This is expected; we fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: remove fps from GlobalState, simplify timeRange to seconds-only"
```

---

### Task 2: Remove fps from state initial value

**Files:**
- Modify: `src/state.ts:7-17`

- [ ] **Step 1: Edit `src/state.ts`**

Remove `fps: 30` from the initial `global` object:

```ts
let global: GlobalState = {
  videoSrc: null,
  duration: 0,
  currentTime: 0,
  mode: 'draw',
  currentColor: 'red',
  zoom: 1,
  panX: 0,
  panY: 0,
}
```

- [ ] **Step 2: Commit**

```bash
git add src/state.ts
git commit -m "refactor: remove fps from initial state"
```

---

### Task 3: Rewrite `timecode.ts` — delete fps-dependent functions, add `parseTimeInput`

**Files:**
- Modify: `src/timecode.ts:1-48`

- [ ] **Step 1: Replace `src/timecode.ts` entirely**

Delete `secondsToTimecode` and `timecodeToSeconds`. Keep `formatTime`. Add `parseTimeInput`:

```ts
// src/timecode.ts

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

/**
 * Parse a user-entered time string into seconds.
 * Accepted formats: "SS", "SS.mmm", "MM:SS", "MM:SS.mmm", "HH:MM:SS", "HH:MM:SS.mmm"
 * Returns 0 for unparseable input.
 */
export function parseTimeInput(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const parts = trimmed.split(':')
  try {
    if (parts.length === 1) {
      // SS or SS.mmm
      const val = Number(parts[0])
      return Number.isFinite(val) && val >= 0 ? val : 0
    }
    if (parts.length === 2) {
      // MM:SS or MM:SS.mmm
      const mm = Number(parts[0])
      const ss = Number(parts[1])
      if (!Number.isFinite(mm) || !Number.isFinite(ss)) return 0
      return mm * 60 + ss
    }
    if (parts.length === 3) {
      // HH:MM:SS or HH:MM:SS.mmm
      const hh = Number(parts[0])
      const mm = Number(parts[1])
      const ss = Number(parts[2])
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return 0
      return hh * 3600 + mm * 60 + ss
    }
    return 0
  } catch {
    return 0
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/timecode.ts
git commit -m "refactor: delete secondsToTimecode/timecodeToSeconds, add parseTimeInput"
```

---

### Task 4: Update toolbar — slider to milliseconds, remove frame display mode

**Files:**
- Modify: `src/toolbar.ts:1-223`

- [ ] **Step 1: Rewrite `src/toolbar.ts`**

Key changes:
- Delete `displayMode` variable and `setupDisplayToggle()`
- Slider uses milliseconds: `max = duration * 1000`, seek = `value / 1000`
- Frame display always shows time via `formatTime`
- Remove all `fps` references
- Import `formatTime` only (no more `secondsToTimecode`)

```ts
// src/toolbar.ts

import { getState, setGlobalState, selectRectangle, subscribe, pushHistory, undo, redo, canUndo, canRedo } from './state'
import { getVideoElement } from './canvas'
import { formatTime } from './timecode'
import { showToast } from './toast'
import { resolveColor } from './colors'
import type { AppState } from './types'

export function initToolbar(): void {
  setupUpload()
  setupPlayback()
  setupModeButtons()
  setupColorDropdown()
  setupSpeedControl()
  setupUndoRedo()
  setupResetButton()

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
    setGlobalState({
      videoSrc: url,
      duration: video.duration,
      currentTime: 0,
    })
    pushHistory() // Save initial empty rectangle state for undo

    // Show working UI, hide upload overlay
    document.getElementById('upload-overlay')!.style.display = 'none'
    document.getElementById('toolbar')!.style.display = 'flex'
    document.getElementById('main-area')!.style.display = 'flex'

    // Update slider — milliseconds
    const slider = document.getElementById('frame-slider') as HTMLInputElement
    slider.max = String(Math.floor(video.duration * 1000))
    slider.value = '0'

    // Seek to first frame
    video.currentTime = 0
  }, { once: true })

  video.addEventListener('error', () => {
    URL.revokeObjectURL(url)
    showToast('视频加载失败，请检查文件格式')
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
    setGlobalState({ currentTime: video.currentTime })
    slider.value = String(Math.round(video.currentTime * 1000))
    updateFrameDisplay()
  })

  slider.addEventListener('input', () => {
    const ms = Number(slider.value)
    video.currentTime = ms / 1000
    setGlobalState({ currentTime: video.currentTime })
    updateFrameDisplay()
  })
}

function updateFrameDisplay(): void {
  const s = getState()
  const display = document.getElementById('frame-display')!
  display.textContent = `${formatTime(s.currentTime)} / ${formatTime(s.duration)}`
}

function setupModeButtons(): void {
  const btnDraw = document.getElementById('btn-mode-draw')!
  const btnSelect = document.getElementById('btn-mode-select')!

  btnDraw.addEventListener('click', () => {
    setGlobalState({ mode: 'draw' })
    selectRectangle(null)
  })
  btnSelect.addEventListener('click', () => {
    setGlobalState({ mode: 'select' })
  })
}

function setupColorDropdown(): void {
  const btn = document.getElementById('btn-color')!
  const dropdown = document.getElementById('color-dropdown')!

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('open')
  })

  document.addEventListener('click', () => {
    dropdown.classList.remove('open')
  })

  // Preset colors
  document.querySelectorAll('.color-preset').forEach(el => {
    el.addEventListener('click', () => {
      const color = (el as HTMLElement).dataset.color!
      setGlobalState({ currentColor: color })
      dropdown.classList.remove('open')
    })
  })

  // Custom color
  const customInput = document.getElementById('custom-color') as HTMLInputElement
  customInput.addEventListener('input', () => {
    setGlobalState({ currentColor: customInput.value })
  })
}

function setupSpeedControl(): void {
  const select = document.getElementById('speed-select') as HTMLSelectElement
  const video = getVideoElement()

  select.addEventListener('change', () => {
    video.playbackRate = Number(select.value)
  })
}

function setupUndoRedo(): void {
  document.getElementById('btn-undo')!.addEventListener('click', undo)
  document.getElementById('btn-redo')!.addEventListener('click', redo)
}

function setupResetButton(): void {
  document.getElementById('btn-reset')!.addEventListener('click', () => {
    setGlobalState({ zoom: 1, panX: 0, panY: 0 })
  })
}

function updateToolbarState(s: AppState): void {
  // Mode buttons
  document.getElementById('btn-mode-draw')!.className = s.mode === 'draw' ? 'active' : ''
  document.getElementById('btn-mode-select')!.className = s.mode === 'select' ? 'active' : ''

  // Color preview
  const preview = document.getElementById('color-preview')!
  preview.style.background = resolveColor(s.currentColor)

  // Color preset active state
  document.querySelectorAll('.color-preset').forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.className = htmlEl.dataset.color === s.currentColor
      ? 'color-preset active'
      : 'color-preset'
  })

  // Undo/redo
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement
  const undoable = canUndo()
  const redoable = canRedo()
  btnUndo.disabled = !undoable
  btnRedo.disabled = !redoable
  btnUndo.style.opacity = undoable ? '1' : '0.4'
  btnRedo.style.opacity = redoable ? '1' : '0.4'

  updateFrameDisplay()
}
```

- [ ] **Step 2: Commit**

```bash
git add src/toolbar.ts
git commit -m "refactor: slider to milliseconds, remove frame display mode"
```

---

### Task 5: Update drawer — remove frame/time toggle, simplify time inputs

**Files:**
- Modify: `src/drawer.ts:1-324`

- [ ] **Step 1: Rewrite `src/drawer.ts`**

Key changes:
- Delete `prop-time-mode` button handler
- Delete all `isFrameMode` branches
- Time inputs always use `HH:MM:SS` format via `formatTime` / `parseTimeInput`
- Remove all `fps` references
- Rect list time hint: always time format

```ts
// src/drawer.ts

import { getState, setGlobalState, selectRectangle, subscribe, addRectangle, updateRectangle, removeRectangle, createRectangle, pushHistory, getSelectedRect } from './state'
import { formatTime, parseTimeInput } from './timecode'
import { drawboxString, allDrawboxString, exportJson, copyToClipboard, downloadFile } from './export'
import { showToast } from './toast'
import { resolveColor } from './colors'

const PROP_MAPPING: Record<string, string> = { x: 'x', y: 'y', w: 'width', h: 'height', thickness: 'thickness' }

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
    const timeHint = rect.timeRange
      ? `${formatTime(rect.timeRange.start)}-${formatTime(rect.timeRange.end)}`
      : '全视频'
    item.innerHTML = `
      <div class="color-dot" style="background:${resolveColor(rect.color)}"></div>
      <span class="rect-name">矩形 ${rect.id.replace('rect-', '')}</span>
      <span class="time-hint">${timeHint}</span>
      <button class="visibility-btn${rect.visible ? '' : ' hidden'}" data-id="${rect.id}">👁</button>
      <button class="delete-btn" data-id="${rect.id}" title="删除">🗑</button>
    `
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('visibility-btn')) return
      selectRectangle(rect.id)
      setGlobalState({ mode: 'select' })
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
        updateRectangle(id, { visible: !rect.visible })
        pushHistory()
      }
    })
  })

  // Delete buttons
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id!
      removeRectangle(id)
    })
  })
}

function renderPropsPanel(s: ReturnType<typeof getState>): void {
  const panel = document.getElementById('props-panel')!
  const rect = getSelectedRect()

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

  // Fill mode
  const fillCheckbox = document.getElementById('prop-filled') as HTMLInputElement
  const thicknessInput = document.getElementById('prop-thickness') as HTMLInputElement
  fillCheckbox.checked = rect.filled
  thicknessInput.disabled = rect.filled
  thicknessInput.style.opacity = rect.filled ? '0.4' : '1'

  // Opacity
  const opacitySlider = document.getElementById('prop-opacity') as HTMLInputElement
  const opacityVal = document.getElementById('prop-opacity-val')!
  if (document.activeElement !== opacitySlider) {
    opacitySlider.value = String(rect.opacity)
  }
  opacityVal.textContent = rect.opacity.toFixed(2)

  // Time range
  const timeCheckbox = document.getElementById('prop-time-enabled') as HTMLInputElement
  const timeFields = document.getElementById('time-range-fields')!
  const hasTime = !!rect.timeRange
  timeCheckbox.checked = hasTime
  timeFields.style.display = hasTime ? '' : 'none'

  if (hasTime && rect.timeRange) {
    const startInput = document.getElementById('prop-time-start') as HTMLInputElement
    const endInput = document.getElementById('prop-time-end') as HTMLInputElement
    if (document.activeElement !== startInput) {
      startInput.value = formatTime(rect.timeRange.start)
    }
    if (document.activeElement !== endInput) {
      endInput.value = formatTime(rect.timeRange.end)
    }
    startInput.placeholder = 'HH:MM:SS'
    endInput.placeholder = 'HH:MM:SS'
  }
}

function setupPropertyInputs(): void {
  const ids = ['prop-x', 'prop-y', 'prop-w', 'prop-h', 'prop-thickness']
  for (const id of ids) {
    document.getElementById(id)!.addEventListener('change', () => {
      const s = getState()
      if (!s.selectedId) return
      const prop = id.replace('prop-', '')
      const raw = Number((document.getElementById(id) as HTMLInputElement).value)
      if (!Number.isFinite(raw)) return
      const isSize = prop === 'w' || prop === 'h' || prop === 'thickness'
      const val = isSize ? Math.max(1, Math.round(Math.abs(raw))) : Math.round(raw)
      updateRectangle(s.selectedId, { [PROP_MAPPING[prop]]: val })
      pushHistory()
    })
  }

  // Color options in props
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      const s = getState()
      if (!s.selectedId) return
      updateRectangle(s.selectedId, { color: (el as HTMLElement).dataset.color! })
      pushHistory()
    })
  })

  // Fill mode toggle
  document.getElementById('prop-filled')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const checkbox = document.getElementById('prop-filled') as HTMLInputElement
    updateRectangle(s.selectedId, { filled: checkbox.checked })
    pushHistory()
  })

  // Opacity slider — input updates visuals, change records history
  document.getElementById('prop-opacity')!.addEventListener('input', () => {
    const s = getState()
    if (!s.selectedId) return
    const slider = document.getElementById('prop-opacity') as HTMLInputElement
    const val = Number(slider.value)
    updateRectangle(s.selectedId, { opacity: val })
  })
  document.getElementById('prop-opacity')!.addEventListener('change', () => {
    pushHistory()
  })

  // Custom color picker — input updates visuals, change records history
  document.getElementById('prop-custom-color')!.addEventListener('input', () => {
    const s = getState()
    if (!s.selectedId) return
    const input = document.getElementById('prop-custom-color') as HTMLInputElement
    updateRectangle(s.selectedId, { color: input.value })
  })
  document.getElementById('prop-custom-color')!.addEventListener('change', () => {
    pushHistory()
  })

  // Time range toggle
  document.getElementById('prop-time-enabled')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const checkbox = document.getElementById('prop-time-enabled') as HTMLInputElement
    if (checkbox.checked) {
      updateRectangle(s.selectedId, {
        timeRange: { start: 0, end: s.duration },
      })
    } else {
      updateRectangle(s.selectedId, { timeRange: undefined })
    }
    pushHistory()
  })

  // Time range inputs
  function setupTimeRangeInput(inputId: string, field: 'start' | 'end'): void {
    document.getElementById(inputId)!.addEventListener('change', () => {
      const s = getState()
      if (!s.selectedId) return
      const rect = getSelectedRect()
      if (!rect?.timeRange) return
      const val = (document.getElementById(inputId) as HTMLInputElement).value
      const parsedVal = parseTimeInput(val)
      if (!Number.isFinite(parsedVal)) return
      updateRectangle(s.selectedId, {
        timeRange: { ...rect.timeRange, [field]: parsedVal },
      })
      pushHistory()
    })
  }
  setupTimeRangeInput('prop-time-start', 'start')
  setupTimeRangeInput('prop-time-end', 'end')
}

function setupExportButtons(): void {
  document.getElementById('export-current-side')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all-side')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json-side')!.addEventListener('click', () => exportJsonFile())
}

async function exportCurrent(): Promise<void> {
  const s = getState()
  const rect = getSelectedRect()
  if (!rect) { showToast('请先选中一个矩形'); return }
  const text = drawboxString(rect)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制到剪贴板' : '复制失败，请手动复制')
}

async function exportAll(): Promise<void> {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const text = allDrawboxString(s.rectangles)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制全部参数到剪贴板' : '复制失败，请手动复制')
}

function exportJsonFile(): void {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const json = exportJson(s.rectangles)
  downloadFile(json, 'ffmask-config.json', 'application/json')
  showToast('JSON 文件已下载')
}
```

- [ ] **Step 2: Commit**

```bash
git add src/drawer.ts
git commit -m "refactor: remove frame/time toggle, simplify time range inputs"
```

---

### Task 6: Update export — remove fps params, always use `between(t,...)`

**Files:**
- Modify: `src/export.ts:1-104`

- [ ] **Step 1: Rewrite `src/export.ts`**

Remove all `fps` parameters. `drawboxString` always uses `between(t,...)`. `exportJson` drops timecode fields.

```ts
// src/export.ts

import type { Rectangle } from './types'
import { resolveColor } from './colors'

/** Convert a color to ffmpeg-compatible 0xRRGGBB format. */
function toFfmpegColor(color: string): string {
  const hex = resolveColor(color) // normalize named colors to #RRGGBB
  if (hex.startsWith('#')) return '0x' + hex.slice(1)
  if (hex.startsWith('0x')) return hex
  return hex // Named colors (red, blue, etc.) are valid in ffmpeg drawbox
}

/**
 * Generate a single drawbox filter string for one rectangle.
 */
export function drawboxString(rect: Rectangle): string {
  const t = rect.filled ? 'fill' : String(rect.thickness)
  const ffmpegColor = toFfmpegColor(rect.color)
  const color = rect.opacity < 1 ? `${ffmpegColor}@${+rect.opacity.toFixed(2)}` : ffmpegColor
  let s = `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}:color=${color}:t=${t}`
  if (rect.timeRange) {
    const start = +rect.timeRange.start.toFixed(3)
    const end = +rect.timeRange.end.toFixed(3)
    s += `:enable='between(t,${start},${end})'`
  }
  return s
}

/**
 * Generate combined drawbox filter string for all visible rectangles.
 * Returns the value for -vf "..." (without the outer quotes).
 */
export function allDrawboxString(rectangles: Rectangle[]): string {
  return rectangles
    .filter(r => r.visible)
    .map(r => drawboxString(r))
    .join(',')
}

/**
 * Export rectangles as JSON config.
 */
export function exportJson(rectangles: Rectangle[]): string {
  const data = rectangles.map(r => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: r.color,
    thickness: r.thickness,
    filled: r.filled,
    opacity: r.opacity,
    visible: r.visible,
    timeRange: r.timeRange
      ? {
          start: r.timeRange.start,
          end: r.timeRange.end,
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

- [ ] **Step 2: Commit**

```bash
git add src/export.ts
git commit -m "refactor: remove fps params from export, always use between(t,...)"
```

---

### Task 7: Update HTML — remove frame mode UI elements

**Files:**
- Modify: `index.html:31,137,140-141`

- [ ] **Step 1: Edit `index.html`**

Three changes:

1. Line 31 — remove `title` attribute from `#frame-display`:
```html
<!-- Before -->
<span id="frame-display" title="点击切换帧数/时间码">0 / 0</span>
<!-- After -->
<span id="frame-display">0:00 / 0:00</span>
```

2. Line 137 — remove the mode toggle button:
```html
<!-- Delete this line -->
<button id="prop-time-mode" class="time-mode-btn" title="切换时间/帧数模式">时间</button>
```

3. Lines 140-141 — remove label elements, update placeholders:
```html
<!-- Before -->
<label id="time-start-label">开始</label><input type="text" id="prop-time-start" placeholder="HH:MM:SS:FF" />
<label id="time-end-label">结束</label><input type="text" id="prop-time-end" placeholder="HH:MM:SS:FF" />
<!-- After -->
<input type="text" id="prop-time-start" placeholder="开始 (HH:MM:SS)" />
<input type="text" id="prop-time-end" placeholder="结束 (HH:MM:SS)" />
```

- [ ] **Step 2: Type-check and build**

Run: `pnpm build`
Expected: Clean build with no errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor: remove frame mode UI elements from HTML"
```

---

### Task 8: Clean up CSS for removed elements

**Files:**
- Modify: `src/style.css` (or wherever styles live — check for `.time-mode-btn` rule)

- [ ] **Step 1: Find and remove `.time-mode-btn` CSS rule**

Search for `.time-mode-btn` in CSS files and remove the rule. Also check if `#time-start-label` / `#time-end-label` have dedicated styles and remove those.

- [ ] **Step 2: Final build verification**

Run: `pnpm build`
Expected: Clean build, no TypeScript errors, no missing element warnings.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: clean up CSS for removed frame mode elements"
```
