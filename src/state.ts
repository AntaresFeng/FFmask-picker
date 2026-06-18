// src/state.ts

import type { AppState, GlobalState, HistoryState, Listener, Rectangle } from './types'

const MAX_HISTORY = 50

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

let historyState: HistoryState = {
  rectangles: [],
  selectedId: null,
}

let history: HistoryState[] = []
let historyIndex = -1
const listeners = new Set<Listener>()

function cloneHistoryState(h: HistoryState): HistoryState {
  return {
    rectangles: h.rectangles.map(r => ({ ...r, timeRange: r.timeRange ? { ...r.timeRange } : undefined })),
    selectedId: h.selectedId,
  }
}

/** Returns merged view of global + history state for consumers. */
export function getState(): AppState {
  return { ...global, ...historyState }
}

/** Update global (non-history) fields. Does NOT record history. */
export function setGlobalState(partial: Partial<GlobalState>): void {
  Object.assign(global, partial)
  notify()
}

/** Update selectedId. Does NOT record history. */
export function selectRectangle(id: string | null): void {
  historyState = { ...historyState, selectedId: id }
  notify()
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function notify(): void {
  const merged = getState()
  for (const fn of listeners) fn(merged)
}

/** Save current history state to undo stack. Call AFTER making changes. */
export function pushHistory(): void {
  history = history.slice(0, historyIndex + 1)
  history.push(cloneHistoryState(historyState))
  if (history.length > MAX_HISTORY) history.shift()
  historyIndex = history.length - 1
  notify()
}

export function undo(): void {
  if (historyIndex <= 0) return
  historyIndex--
  historyState = cloneHistoryState(history[historyIndex])
  notify()
}

export function redo(): void {
  if (historyIndex >= history.length - 1) return
  historyIndex++
  historyState = cloneHistoryState(history[historyIndex])
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
    color: global.currentColor,
    thickness: 4,
    filled: false,
    opacity: 1,
    visible: true,
    ...overrides,
  }
}

export function addRectangle(rect: Rectangle): void {
  historyState = { ...historyState, rectangles: [...historyState.rectangles, rect], selectedId: rect.id }
  pushHistory()
}

/** Update rectangle properties without notifying. Caller must call pushHistory() or notify(). */
export function updateRectangle(id: string, partial: Partial<Rectangle>): void {
  historyState = {
    ...historyState,
    rectangles: historyState.rectangles.map(r => (r.id === id ? { ...r, ...partial } : r)),
  }
}

export function removeRectangle(id: string): void {
  const rects = historyState.rectangles.filter(r => r.id !== id)
  historyState = {
    ...historyState,
    rectangles: rects,
    selectedId: historyState.selectedId === id ? null : historyState.selectedId,
  }
  pushHistory()
}

export function getSelectedRect(): Rectangle | undefined {
  return historyState.rectangles.find(r => r.id === historyState.selectedId)
}

/** Replace all rectangles and clear selection. Pushes history. */
export function setRectangles(rects: Rectangle[]): void {
  historyState = { rectangles: rects, selectedId: null }
  pushHistory()
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
