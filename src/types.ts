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

/** 导出时矩形坐标的目标分辨率档位。'original' 表示不换算。 */
export type ExportScale = 'original' | '1920x1080' | '3840x2160'

export interface GlobalState {
  videoSrc: string | null // Object URL
  duration: number         // seconds
  currentTime: number      // seconds
  mode: 'draw' | 'select'
  currentColor: Color
  zoom: number
  panX: number
  panY: number
  exportScale: ExportScale
}

export interface HistoryState {
  rectangles: Rectangle[]
  selectedId: string | null
}

export type AppState = GlobalState & HistoryState

export type Listener = (state: AppState) => void
