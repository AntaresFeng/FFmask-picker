// src/interaction.ts

import { getState, setGlobalState, selectRectangle, addRectangle, updateRectangle, removeRectangle, pushHistory, createRectangle, getDragState, setDragState, undo, redo, getSelectedRect } from './state'
import { getCanvasElement, getVideoElement, screenToFrame, hitTestHandle, hitTestRect, getScale, getHandlePositions } from './canvas'
import { showToast } from './toast'

export function initInteraction(): void {
  const canvas = getCanvasElement()

  canvas.addEventListener('mousedown', onMouseDown)
  canvas.addEventListener('mousemove', onMouseMove)
  canvas.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContextMenu)

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
    const selected = getSelectedRect()
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
        selectRectangle(rect.id)
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

    selectRectangle(null)
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
    setGlobalState({ panX: s.panX + dx, panY: s.panY + dy })
    return
  }

  if (drag.type === 'draw') {
    return
  }

  if (drag.type === 'move' && drag.moveRectId) {
    const scale = getScale()
    const dx = (sx - drag.startX) / scale
    const dy = (sy - drag.startY) / scale
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
      width = Math.max(1, frame.x - x)
    }
    if (handle === 0 || handle === 1 || handle === 2) {
      const newY = Math.min(frame.y, y + height)
      height = y + height - newY
      y = newY
    }
    if (handle === 5 || handle === 6 || handle === 7) {
      height = Math.max(1, frame.y - y)
    }

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

  // Zoom toward cursor: find frame position under cursor with current transform,
  // then compute new pan so the same frame position stays under cursor after zoom.
  const frame = screenToFrame(e.offsetX, e.offsetY)

  const video = getVideoElement()
  const naturalW = video.videoWidth || 1920
  const naturalH = video.videoHeight || 1080
  const canvas = getCanvasElement()
  const baseScale = Math.min(canvas.width / naturalW, canvas.height / naturalH)
  const newScale = baseScale * newZoom
  const newCenterX = (canvas.width - naturalW * newScale) / 2
  const newCenterY = (canvas.height - naturalH * newScale) / 2

  setGlobalState({
    zoom: newZoom,
    panX: e.offsetX - frame.x * newScale - newCenterX,
    panY: e.offsetY - frame.y * newScale - newCenterY,
  })
}

function onContextMenu(e: MouseEvent): void {
  e.preventDefault()
  const s = getState()
  if (s.mode === 'draw') {
    setGlobalState({ mode: 'select' })
  } else {
    selectRectangle(null)
    setGlobalState({ mode: 'draw' })
  }
  updateCursor(e)
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
  const selected = getSelectedRect()
  if (selected && selected.visible) {
    const handleIdx = hitTestHandle(selected, sx, sy)
    if (handleIdx >= 0) {
      canvas.style.cursor = getHandlePositions(selected)[handleIdx].cursor
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
    const video = getVideoElement()
    if (video.paused) video.play().catch(() => showToast('视频播放失败'))
    else video.pause()
    return
  }

  // Ctrl+Z — undo
  if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
    e.preventDefault()
    undo()
    return
  }

  // Ctrl+Shift+Z or Ctrl+Y — redo
  if ((e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) ||
      (e.key.toLowerCase() === 'y' && (e.ctrlKey || e.metaKey))) {
    e.preventDefault()
    redo()
    return
  }
}
