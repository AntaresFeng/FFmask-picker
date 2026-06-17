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
