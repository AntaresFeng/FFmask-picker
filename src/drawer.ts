// src/drawer.ts

import { getState, setState, subscribe, addRectangle, updateRectangle, createRectangle } from './state'
import { secondsToTimecode, timecodeToSeconds } from './timecode'
import { drawboxString, allDrawboxString, exportJson, copyToClipboard, downloadFile } from './export'
import type { Color } from './types'
import { showToast } from './toast'

const COLOR_DOT_MAP: Record<string, string> = {
  red: '#ff4444',
  blue: '#4488ff',
  green: '#44cc44',
}

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
      <div class="color-dot" style="background:${COLOR_DOT_MAP[rect.color]}"></div>
      <span class="rect-name">矩形 ${rect.id.replace('rect-', '')}</span>
      <span class="time-hint">${rect.timeRange ? `${formatSeconds(rect.timeRange.start)}-${formatSeconds(rect.timeRange.end)}` : '全视频'}</span>
      <button class="visibility-btn${rect.visible ? '' : ' hidden'}" data-id="${rect.id}">👁</button>
    `
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('visibility-btn')) return
      setState({ selectedId: rect.id, mode: 'select' })
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
      }
    })
  })
}

function formatSeconds(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function renderPropsPanel(s: ReturnType<typeof getState>): void {
  const panel = document.getElementById('props-panel')!
  const rect = s.rectangles.find(r => r.id === s.selectedId)

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

  // Time range
  const timeCheckbox = document.getElementById('prop-time-enabled') as HTMLInputElement
  const timeFields = document.getElementById('time-range-fields')!
  const hasTime = !!rect.timeRange
  timeCheckbox.checked = hasTime
  timeFields.style.display = hasTime ? '' : 'none'

  if (hasTime && rect.timeRange) {
    const fps = s.fps
    const startInput = document.getElementById('prop-time-start') as HTMLInputElement
    const endInput = document.getElementById('prop-time-end') as HTMLInputElement
    if (document.activeElement !== startInput) {
      startInput.value = secondsToTimecode(rect.timeRange.start, fps)
    }
    if (document.activeElement !== endInput) {
      endInput.value = secondsToTimecode(rect.timeRange.end, fps)
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
      const val = Number((document.getElementById(id) as HTMLInputElement).value)
      const mapping: Record<string, string> = { x: 'x', y: 'y', w: 'width', h: 'height', thickness: 'thickness' }
      updateRectangle(s.selectedId, { [mapping[prop]]: val })
    })
  }

  // Color options in props
  document.querySelectorAll('.color-option').forEach(el => {
    el.addEventListener('click', () => {
      const s = getState()
      if (!s.selectedId) return
      updateRectangle(s.selectedId, { color: (el as HTMLElement).dataset.color as Color })
    })
  })

  // Time range toggle
  document.getElementById('prop-time-enabled')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const checkbox = document.getElementById('prop-time-enabled') as HTMLInputElement
    if (checkbox.checked) {
      updateRectangle(s.selectedId, {
        timeRange: { start: 0, end: s.duration },
      })
    } else {
      updateRectangle(s.selectedId, { timeRange: undefined })
    }
  })

  // Time range inputs
  document.getElementById('prop-time-start')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const rect = s.rectangles.find(r => r.id === s.selectedId)
    if (!rect?.timeRange) return
    const val = (document.getElementById('prop-time-start') as HTMLInputElement).value
    updateRectangle(s.selectedId, {
      timeRange: { ...rect.timeRange, start: timecodeToSeconds(val, s.fps) },
    })
  })

  document.getElementById('prop-time-end')!.addEventListener('change', () => {
    const s = getState()
    if (!s.selectedId) return
    const rect = s.rectangles.find(r => r.id === s.selectedId)
    if (!rect?.timeRange) return
    const val = (document.getElementById('prop-time-end') as HTMLInputElement).value
    updateRectangle(s.selectedId, {
      timeRange: { ...rect.timeRange, end: timecodeToSeconds(val, s.fps) },
    })
  })
}

function setupExportButtons(): void {
  // Toolbar dropdown buttons
  document.getElementById('export-current')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json')!.addEventListener('click', () => exportJsonFile())

  // Drawer side buttons
  document.getElementById('export-current-side')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all-side')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json-side')!.addEventListener('click', () => exportJsonFile())
}

async function exportCurrent(): Promise<void> {
  const s = getState()
  const rect = s.rectangles.find(r => r.id === s.selectedId)
  if (!rect) { showToast('请先选中一个矩形'); return }
  const text = drawboxString(rect, s.fps)
  await copyToClipboard(text)
  showToast('已复制到剪贴板')
}

async function exportAll(): Promise<void> {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const text = allDrawboxString(s.rectangles, s.fps)
  await copyToClipboard(text)
  showToast('已复制全部参数到剪贴板')
}

function exportJsonFile(): void {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const json = exportJson(s.rectangles, s.fps)
  downloadFile(json, 'ffmask-config.json', 'application/json')
  showToast('JSON 文件已下载')
}
