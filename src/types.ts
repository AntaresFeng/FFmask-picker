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
