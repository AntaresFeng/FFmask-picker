// src/toolbar.ts

import { getState, setGlobalState, selectRectangle, subscribe, pushHistory, undo, redo, canUndo, canRedo } from './state'
import { getVideoElement } from './canvas'
import { formatTime } from './timecode'
import { showToast } from './toast'
import { resolveColor } from './colors'
import type { AppState } from './types'

export function initToolbar(): void {
  setupUpload()
  setupPlayback()
  setupModeButtons()
  setupColorDropdown()
  setupSpeedControl()
  setupUndoRedo()
  setupResetButton()

  subscribe(updateToolbarState)
  updateToolbarState(getState())
}

function setupUpload(): void {
  const btn = document.getElementById('btn-upload')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  btn.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) loadVideoFile(file)
  })
}

export function loadVideoFile(file: File): void {
  const video = getVideoElement()
  const url = URL.createObjectURL(file)

  // Revoke previous URL
  const prev = getState().videoSrc
  if (prev) URL.revokeObjectURL(prev)

  video.src = url
  video.load()

  video.addEventListener('loadedmetadata', () => {
    setGlobalState({
      videoSrc: url,
      duration: video.duration,
      currentTime: 0,
    })
    pushHistory() // Save initial empty rectangle state for undo

    // Show working UI, hide upload overlay
    document.getElementById('upload-overlay')!.style.display = 'none'
    document.getElementById('toolbar')!.style.display = 'flex'
    document.getElementById('main-area')!.style.display = 'flex'

    // Update slider — milliseconds
    const slider = document.getElementById('frame-slider') as HTMLInputElement
    slider.max = String(Math.floor(video.duration * 1000))
    slider.value = '0'

    // Seek to first frame
    video.currentTime = 0
  }, { once: true })

  video.addEventListener('error', () => {
    URL.revokeObjectURL(url)
    showToast('视频加载失败，请检查文件格式')
  }, { once: true })
}

function setupPlayback(): void {
  const btn = document.getElementById('btn-play')!
  const slider = document.getElementById('frame-slider') as HTMLInputElement
  const video = getVideoElement()

  btn.addEventListener('click', () => {
    if (video.paused) {
      video.play()
      btn.textContent = '⏸'
    } else {
      video.pause()
      btn.textContent = '▶'
    }
  })

  video.addEventListener('play', () => { btn.textContent = '⏸' })
  video.addEventListener('pause', () => { btn.textContent = '▶' })

  video.addEventListener('timeupdate', () => {
    setGlobalState({ currentTime: video.currentTime })
    slider.value = String(Math.round(video.currentTime * 1000))
    updateFrameDisplay()
  })

  slider.addEventListener('input', () => {
    const ms = Number(slider.value)
    video.currentTime = ms / 1000
    setGlobalState({ currentTime: video.currentTime })
    updateFrameDisplay()
  })
}

function updateFrameDisplay(): void {
  const s = getState()
  const display = document.getElementById('frame-display')!
  display.textContent = `${formatTime(s.currentTime)} / ${formatTime(s.duration)}`
}

function setupModeButtons(): void {
  const btnDraw = document.getElementById('btn-mode-draw')!
  const btnSelect = document.getElementById('btn-mode-select')!

  btnDraw.addEventListener('click', () => {
    setGlobalState({ mode: 'draw' })
    selectRectangle(null)
  })
  btnSelect.addEventListener('click', () => {
    setGlobalState({ mode: 'select' })
  })
}

function setupColorDropdown(): void {
  const btn = document.getElementById('btn-color')!
  const dropdown = document.getElementById('color-dropdown')!

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('open')
  })

  document.addEventListener('click', () => {
    dropdown.classList.remove('open')
  })

  // Preset colors
  document.querySelectorAll('.color-preset').forEach(el => {
    el.addEventListener('click', () => {
      const color = (el as HTMLElement).dataset.color!
      setGlobalState({ currentColor: color })
      dropdown.classList.remove('open')
    })
  })

  // Custom color
  const customInput = document.getElementById('custom-color') as HTMLInputElement
  customInput.addEventListener('input', () => {
    setGlobalState({ currentColor: customInput.value })
  })
}

function setupSpeedControl(): void {
  const select = document.getElementById('speed-select') as HTMLSelectElement
  const video = getVideoElement()

  select.addEventListener('change', () => {
    video.playbackRate = Number(select.value)
  })
}

function setupUndoRedo(): void {
  document.getElementById('btn-undo')!.addEventListener('click', undo)
  document.getElementById('btn-redo')!.addEventListener('click', redo)
}

function setupResetButton(): void {
  document.getElementById('btn-reset')!.addEventListener('click', () => {
    setGlobalState({ zoom: 1, panX: 0, panY: 0 })
  })
}

function updateToolbarState(s: AppState): void {
  // Mode buttons
  document.getElementById('btn-mode-draw')!.className = s.mode === 'draw' ? 'active' : ''
  document.getElementById('btn-mode-select')!.className = s.mode === 'select' ? 'active' : ''

  // Color preview
  const preview = document.getElementById('color-preview')!
  preview.style.background = resolveColor(s.currentColor)

  // Color preset active state
  document.querySelectorAll('.color-preset').forEach(el => {
    const htmlEl = el as HTMLElement
    htmlEl.className = htmlEl.dataset.color === s.currentColor
      ? 'color-preset active'
      : 'color-preset'
  })

  // Undo/redo
  const btnUndo = document.getElementById('btn-undo') as HTMLButtonElement
  const btnRedo = document.getElementById('btn-redo') as HTMLButtonElement
  const undoable = canUndo()
  const redoable = canRedo()
  btnUndo.disabled = !undoable
  btnRedo.disabled = !redoable
  btnUndo.style.opacity = undoable ? '1' : '0.4'
  btnRedo.style.opacity = redoable ? '1' : '0.4'

  updateFrameDisplay()
}
