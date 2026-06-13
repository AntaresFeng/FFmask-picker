// src/state.ts

import type { AppState, Listener, Rectangle } from './types'

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
    filled: false,
    opacity: 1,
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
