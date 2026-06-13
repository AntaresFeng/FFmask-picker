// src/canvas.ts

import { getState, getDragState } from './state'
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
  black: '#000000',
  white: '#ffffff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  orange: '#ff8800',
}

function resolveColor(color: string): string {
  // Already a hex color or CSS color
  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) return color
  // Named color - check map first, then try as CSS color
  return COLOR_MAP[color.toLowerCase()] || color
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

  // ResizeObserver sets a pending flag; actual resize happens in renderLoop
  const container = document.getElementById('canvas-container')!
  const ro = new ResizeObserver(() => {
    resizePending = true
  })
  ro.observe(container)
  window.addEventListener('resize', () => { resizePending = true })
}

let resizePending = true

function applyResize(): void {
  if (!resizePending) return
  resizePending = false
  const container = document.getElementById('canvas-container')!
  if (container.clientWidth > 0 && container.clientHeight > 0) {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
  }
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

// Track mouse position for temp rect
let lastMouseX = 0
let lastMouseY = 0

export function setLastMouse(x: number, y: number): void {
  lastMouseX = x
  lastMouseY = y
}

/** Main render loop. Call once, then it self-schedules. */
export function renderLoop(): void {
  applyResize()
  render()
  // Draw temp rect if in draw-drag
  const drag = getDragState()
  if (drag?.type === 'draw' && drag.drawStartFrameX !== undefined && drag.drawStartFrameY !== undefined) {
    const end = screenToFrame(lastMouseX, lastMouseY)
    drawTempRect(drag.drawStartFrameX, drag.drawStartFrameY, end.x, end.y, getState().currentColor)
  }
  requestAnimationFrame(renderLoop)
}

function render(): void {
  if (canvas.width === 0 || canvas.height === 0) return
  const s = getState()

  // Fill background to prevent flickering
  ctx.fillStyle = '#1a1a2e'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

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
  const color = resolveColor(rect.color)
  const tl = frameToScreen(rect.x, rect.y)
  const br = frameToScreen(rect.x + rect.width, rect.y + rect.height)
  const w = br.x - tl.x
  const h = br.y - tl.y

  const isSelected = s.selectedId === rect.id
  const isOtherSelected = s.selectedId !== null && s.selectedId !== rect.id

  ctx.save()
  if (isOtherSelected) ctx.globalAlpha = 0.5

  if (rect.filled) {
    // Filled rectangle
    ctx.fillStyle = color
    const fillAlpha = isOtherSelected ? 0.25 * rect.opacity : 0.5 * rect.opacity
    ctx.globalAlpha = fillAlpha
    ctx.fillRect(tl.x, tl.y, w, h)
    ctx.globalAlpha = isOtherSelected ? 0.5 : 1
    ctx.strokeStyle = color
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.strokeRect(tl.x, tl.y, w, h)
  } else {
    // Fill for selected
    if (isSelected) {
      ctx.fillStyle = color + '14' // ~8% opacity
      ctx.fillRect(tl.x, tl.y, w, h)
    }

    // Border
    ctx.strokeStyle = color
    ctx.globalAlpha = rect.opacity
    ctx.lineWidth = isSelected ? 3 : 2
    ctx.setLineDash(isSelected ? [] : [])
    ctx.strokeRect(tl.x, tl.y, w, h)
  }

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
  ctx.strokeStyle = resolveColor(color)
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y)
  ctx.restore()
}

function renderMinimap(_s: AppState): void {
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
