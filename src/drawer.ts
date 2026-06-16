// src/drawer.ts

import { getState, setGlobalState, selectRectangle, subscribe, addRectangle, updateRectangle, removeRectangle, createRectangle, pushHistory, getSelectedRect } from './state'
import { secondsToTimecode, timecodeToSeconds, formatTime } from './timecode'
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
    item.innerHTML = `
      <div class="color-dot" style="background:${resolveColor(rect.color)}"></div>
      <span class="rect-name">矩形 ${rect.id.replace('rect-', '')}</span>
      <span class="time-hint">${rect.timeRange ? (rect.timeRange.mode === 'frame' ? `F${rect.timeRange.start}-${rect.timeRange.end}` : `${formatTime(rect.timeRange.start)}-${formatTime(rect.timeRange.end)}`) : '全视频'}</span>
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

  // Time mode toggle
  const timeModeBtn = document.getElementById('prop-time-mode')!
  const timeStartLabel = document.getElementById('time-start-label')!
  const timeEndLabel = document.getElementById('time-end-label')!
  const isFrameMode = rect.timeRange?.mode === 'frame'
  timeModeBtn.textContent = isFrameMode ? '帧数' : '时间'
  timeStartLabel.textContent = isFrameMode ? '起始帧' : '开始'
  timeEndLabel.textContent = isFrameMode ? '结束帧' : '结束'

  if (hasTime && rect.timeRange) {
    const fps = s.fps
    const startInput = document.getElementById('prop-time-start') as HTMLInputElement
    const endInput = document.getElementById('prop-time-end') as HTMLInputElement
    if (isFrameMode) {
      if (document.activeElement !== startInput) {
        startInput.value = String(Math.round(rect.timeRange.start))
      }
      if (document.activeElement !== endInput) {
        endInput.value = String(Math.round(rect.timeRange.end))
      }
      startInput.placeholder = '帧数'
      endInput.placeholder = '帧数'
    } else {
      if (document.activeElement !== startInput) {
        startInput.value = secondsToTimecode(rect.timeRange.start, fps)
      }
      if (document.activeElement !== endInput) {
        endInput.value = secondsToTimecode(rect.timeRange.end, fps)
      }
      startInput.placeholder = 'HH:MM:SS:FF'
      endInput.placeholder = 'HH:MM:SS:FF'
    }
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
        timeRange: { start: 0, end: s.duration, mode: 'time' },
      })
    } else {
      updateRectangle(s.selectedId, { timeRange: undefined })
    }
    pushHistory()
  })

  // Time mode toggle
  document.getElementById('prop-time-mode')!.addEventListener('click', () => {
    const s = getState()
    if (!s.selectedId) return
    const rect = getSelectedRect()
    if (!rect?.timeRange) return
    const newMode = rect.timeRange.mode === 'frame' ? 'time' : 'frame'
    const fps = s.fps
    let newStart = rect.timeRange.start
    let newEnd = rect.timeRange.end
    if (newMode === 'frame') {
      // Convert seconds to frame numbers
      newStart = Math.round(rect.timeRange.start * fps)
      newEnd = Math.round(rect.timeRange.end * fps)
    } else {
      // Convert frame numbers to seconds
      newStart = rect.timeRange.start / fps
      newEnd = rect.timeRange.end / fps
    }
    updateRectangle(s.selectedId, {
      timeRange: { start: newStart, end: newEnd, mode: newMode },
    })
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
      const isFrameMode = rect.timeRange.mode === 'frame'
      const parsedVal = isFrameMode ? Math.round(Number(val)) : timecodeToSeconds(val, s.fps)
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
  const text = drawboxString(rect, s.fps)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制到剪贴板' : '复制失败，请手动复制')
}

async function exportAll(): Promise<void> {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const text = allDrawboxString(s.rectangles, s.fps)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制全部参数到剪贴板' : '复制失败，请手动复制')
}

function exportJsonFile(): void {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const json = exportJson(s.rectangles, s.fps)
  downloadFile(json, 'ffmask-config.json', 'application/json')
  showToast('JSON 文件已下载')
}
