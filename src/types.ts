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
    start: number // seconds or frame number
    end: number   // seconds or frame number
    mode: 'time' | 'frame'
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
