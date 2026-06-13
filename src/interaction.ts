// src/interaction.ts

import { getState, setState, addRectangle, updateRectangle, removeRectangle, pushHistory, createRectangle, getDragState, setDragState, undo, redo } from './state'
import { getCanvasElement, screenToFrame, hitTestHandle, hitTestRect, getScale } from './canvas'

export function initInteraction(): void {
  const canvas = getCanvasElement()

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', e => e.preventDefault())

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown)
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

function onKeyDown(e: KeyboardEvent): void {
  // Don't handle shortcuts when typing in input fields
  const tag = (e.target as HTMLElement).tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return

  const s = getState()

  // Delete — remove selected rectangle
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (s.selectedId) {
      e.preventDefault()
      removeRectangle(s.selectedId)
    }
    return
  }

  // Space — toggle play/pause
  if (e.key === ' ') {
    e.preventDefault()
    const video = document.querySelector('video') as HTMLVideoElement | null
    if (video) {
      if (video.paused) video.play()
      else video.pause()
    }
    return
  }

  // Ctrl+Z — undo
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }

  // Ctrl+Shift+Z or Ctrl+Y — redo
  if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
      (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault()
    redo()
    return
  }
}
