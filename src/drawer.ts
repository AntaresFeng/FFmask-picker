// src/drawer.ts

import { getState, setGlobalState, selectRectangle, subscribeHistory, addRectangle, updateRectangle, removeRectangle, createRectangle, pushHistory, getSelectedRect } from './state'
import { formatTime, parseTimeInput } from './timecode'
import { drawboxString, allDrawboxString, exportJson, copyToClipboard, downloadFile } from './export'
import { showToast } from './toast'
import { resolveColor, isPresetColor } from './colors'
import type { Rectangle, ExportScale } from './types'
import { getVideoElement } from './canvas'

const PROP_MAPPING: Record<string, string> = { x: 'x', y: 'y', w: 'width', h: 'height', thickness: 'thickness' }

export function initDrawer(): void {
  setupToggle()
  setupPropertyInputs()
  setupExportButtons()
  setupExportScaleRadio()

  subscribeHistory(renderDrawer)
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


function renderDrawer(s: ReturnType<typeof getState>): void {
  renderRectList(s)
  renderPropsPanel()
}

let addBtnCreated = false

function renderRectList(s: ReturnType<typeof getState>): void {
  const container = document.getElementById('rect-list')!
  const scrollTop = container.scrollTop

  // Remove rect items but preserve the add button if it exists
  const existingBtn = container.querySelector('.add-rect-btn')
  container.innerHTML = ''
  if (existingBtn) container.appendChild(existingBtn)

  for (const rect of s.rectangles) {
    const item = document.createElement('div')
    item.className = `rect-item${s.selectedId === rect.id ? ' selected' : ''}`
    const timeHint = rect.timeRange
      ? `${formatTime(rect.timeRange.start)}-${formatTime(rect.timeRange.end)}`
      : '全视频'
    item.innerHTML = `
      <div class="color-dot" style="background:${resolveColor(rect.color)}"></div>
      <span class="rect-name">矩形 ${rect.id.replace('rect-', '')}</span>
      <span class="time-hint">${timeHint}</span>
      <button class="visibility-btn${rect.visible ? '' : ' hidden'}" data-id="${rect.id}">👁</button>
      <button class="delete-btn" data-id="${rect.id}" title="删除">🗑</button>
    `
    item.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('visibility-btn')) return
      selectRectangle(rect.id)
      setGlobalState({ mode: 'select' })
    })
    container.insertBefore(item, existingBtn)
  }

  // Visibility buttons
  container.querySelectorAll('.visibility-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      const id = (btn as HTMLElement).dataset.id!
      const rect = getState().rectangles.find(r => r.id === id)
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

  // Create add button once (persists across renders)
  if (!addBtnCreated) {
    const addBtn = document.createElement('button')
    addBtn.className = 'add-rect-btn'
    addBtn.textContent = '+ 添加矩形'
    addBtn.addEventListener('click', () => {
      const rect = createRectangle()
      addRectangle(rect)
    })
    container.appendChild(addBtn)
    addBtnCreated = true
  }

  // Restore scroll position
  container.scrollTop = scrollTop
}

function renderPropsPanel(): void {
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
    input.value = String(Math.round(val))
  }

  // Color options
  document.querySelectorAll('.color-option').forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.className = htmlEl.dataset.color === rect.color
      ? 'color-option active'
      : 'color-option'
  })
  const customColorInput = document.getElementById('prop-custom-color') as HTMLInputElement
  const isCustomColor = !isPresetColor(rect.color)
  if (isCustomColor) customColorInput.value = rect.color
  customColorInput.classList.toggle('active', isCustomColor)

  // Fill mode
  const fillCheckbox = document.getElementById('prop-filled') as HTMLInputElement
  const thicknessInput = document.getElementById('prop-thickness') as HTMLInputElement
  fillCheckbox.checked = rect.filled
  thicknessInput.disabled = rect.filled
  thicknessInput.style.opacity = rect.filled ? '0.4' : '1'

  // Opacity
  const opacitySlider = document.getElementById('prop-opacity') as HTMLInputElement
  const opacityVal = document.getElementById('prop-opacity-val')!
  opacitySlider.value = String(rect.opacity)
  opacityVal.textContent = rect.opacity.toFixed(2)

  // Time range
  const timeCheckbox = document.getElementById('prop-time-enabled') as HTMLInputElement
  const timeFields = document.getElementById('time-range-fields')!
  const hasTime = !!rect.timeRange
  timeCheckbox.checked = hasTime
  timeFields.style.display = hasTime ? '' : 'none'

  if (hasTime && rect.timeRange) {
    const startInput = document.getElementById('prop-time-start') as HTMLInputElement
    const endInput = document.getElementById('prop-time-end') as HTMLInputElement
    startInput.value = formatTime(rect.timeRange.start, true)
    endInput.value = formatTime(rect.timeRange.end, true)
    startInput.placeholder = 'HH:mm:ss.SSS'
    endInput.placeholder = 'HH:mm:ss.SSS'
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
      if (!Number.isFinite(raw)) {
        const rect = getSelectedRect()
        if (rect) {
          const input = document.getElementById(id) as HTMLInputElement
          const propKey = PROP_MAPPING[prop] as keyof Rectangle
          input.value = String(Math.round(rect[propKey] as number))
        }
        return
      }
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
    const opacityVal = document.getElementById('prop-opacity-val')!
    opacityVal.textContent = val.toFixed(2)
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
        timeRange: { start: 0, end: s.duration },
      })
    } else {
      updateRectangle(s.selectedId, { timeRange: undefined })
    }
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
      const parsedVal = parseTimeInput(val)
      if (parsedVal < 0) {
        const input = document.getElementById(inputId) as HTMLInputElement
        input.value = formatTime(rect.timeRange[field], true)
        return
      }
      updateRectangle(s.selectedId, {
        timeRange: { ...rect.timeRange, [field]: parsedVal },
      })
      pushHistory()
    })
  }
  setupTimeRangeInput('prop-time-start', 'start')
  setupTimeRangeInput('prop-time-end', 'end')
}

function setupExportScaleRadio(): void {
  const radios = document.querySelectorAll<HTMLInputElement>('input[name="export-scale"]')
  radios.forEach(radio => {
    radio.addEventListener('change', () => {
      setGlobalState({ exportScale: radio.value as ExportScale })
    })
  })
}

/** 导出所需的目标分辨率档位与视频自然尺寸，统一三处导出调用的取值。 */
function exportScaleArgs(): { scale: ExportScale; naturalW: number; naturalH: number } {
  const { exportScale } = getState()
  const video = getVideoElement()
  return { scale: exportScale, naturalW: video.videoWidth, naturalH: video.videoHeight }
}

function setupExportButtons(): void {
  document.getElementById('export-current-side')!.addEventListener('click', () => exportCurrent())
  document.getElementById('export-all-side')!.addEventListener('click', () => exportAll())
  document.getElementById('export-json-side')!.addEventListener('click', () => exportJsonFile())
}

async function exportCurrent(): Promise<void> {
  const rect = getSelectedRect()
  if (!rect) { showToast('请先选中一个矩形'); return }
  const { scale, naturalW, naturalH } = exportScaleArgs()
  const text = drawboxString(rect, scale, naturalW, naturalH)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制到剪贴板' : '复制失败，请手动复制')
}

async function exportAll(): Promise<void> {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const { scale, naturalW, naturalH } = exportScaleArgs()
  const text = allDrawboxString(s.rectangles, scale, naturalW, naturalH)
  const ok = await copyToClipboard(text)
  showToast(ok ? '已复制全部参数到剪贴板' : '复制失败，请手动复制')
}

function exportJsonFile(): void {
  const s = getState()
  if (s.rectangles.length === 0) { showToast('没有矩形'); return }
  const { scale, naturalW, naturalH } = exportScaleArgs()
  const json = exportJson(s.rectangles, scale, naturalW, naturalH)
  downloadFile(json, 'ffmask-export.json', 'application/json')
  showToast('JSON 文件已下载')
}
