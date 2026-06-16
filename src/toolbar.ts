// src/toolbar.ts

import { getState, setGlobalState, selectRectangle, subscribe, pushHistory, undo, redo, canUndo, canRedo } from './state'
import { getVideoElement } from './canvas'
import { formatTime } from './timecode'
import type { AppState } from './types'

let displayMode: 'frame' | 'time' = 'frame'

export function initToolbar(): void {
  setupUpload()
  setupPlayback()
  setupDisplayToggle()
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
    const fps = 30 // Default; precise FPS detection is unreliable in browsers
    setGlobalState({
      videoSrc: url,
      fps,
      duration: video.duration,
      currentTime: 0,
    })
    pushHistory() // Save initial empty rectangle state for undo

    // Show working UI, hide upload overlay
    document.getElementById('upload-overlay')!.style.display = 'none'
    document.getElementById('toolbar')!.style.display = 'flex'
    document.getElementById('main-area')!.style.display = 'flex'

    // Update slider
    const slider = document.getElementById('frame-slider') as HTMLInputElement
    slider.max = String(Math.floor(video.duration * fps))
    slider.value = '0'

    // Seek to first frame
    video.currentTime = 0
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
    const s = getState()
    setGlobalState({ currentTime: video.currentTime })
    slider.value = String(Math.floor(video.currentTime * s.fps))
    updateFrameDisplay()
  })

  slider.addEventListener('input', () => {
    const s = getState()
    const frame = Number(slider.value)
    video.currentTime = frame / s.fps
    setGlobalState({ currentTime: video.currentTime })
    updateFrameDisplay()
  })
}

function setupDisplayToggle(): void {
  const display = document.getElementById('frame-display')!
  display.addEventListener('click', () => {
    displayMode = displayMode === 'frame' ? 'time' : 'frame'
    updateFrameDisplay()
  })
}

function updateFrameDisplay(): void {
  const s = getState()
  const display = document.getElementById('frame-display')!
  if (displayMode === 'frame') {
    const current = Math.floor(s.currentTime * s.fps)
    const total = Math.floor(s.duration * s.fps)
    display.textContent = `${current} / ${total}`
  } else {
    display.textContent = `${formatTime(s.currentTime)} / ${formatTime(s.duration)}`
  }
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
  const colorMap: Record<string, string> = {
    red: '#ff4444', blue: '#4488ff', green: '#44cc44',
    black: '#000000', white: '#ffffff', yellow: '#ffff00',
    cyan: '#00ffff', magenta: '#ff00ff', orange: '#ff8800',
  }
  preview.style.background = colorMap[s.currentColor] || s.currentColor

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
  btnUndo.disabled = !canUndo()
  btnRedo.disabled = !canRedo()
  btnUndo.style.opacity = canUndo() ? '1' : '0.4'
  btnRedo.style.opacity = canRedo() ? '1' : '0.4'

  updateFrameDisplay()
}
