// src/main.ts

import './style.css'
import { initCanvas, renderLoop, setLastMouse } from './canvas'
import { pushHistory } from './state'
import { initToolbar, loadVideoFile } from './toolbar'
import { initDrawer } from './drawer'
import { initInteraction } from './interaction'

// Re-export showToast from toast.ts for backward compatibility
export { showToast } from './toast'

function setupUploadOverlay(): void {
  const box = document.getElementById('upload-box')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  box.addEventListener('click', () => fileInput.click())

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0]
    if (file) loadVideoFile(file)
  })

  // Drag and drop
  box.addEventListener('dragover', (e) => {
    e.preventDefault()
    box.classList.add('dragover')
  })
  box.addEventListener('dragleave', () => {
    box.classList.remove('dragover')
  })
  box.addEventListener('drop', (e) => {
    e.preventDefault()
    box.classList.remove('dragover')
    const file = e.dataTransfer?.files[0]
    if (file && file.type.startsWith('video/')) {
      loadVideoFile(file)
    }
  })
}

function main(): void {
  initCanvas()
  initToolbar()
  initDrawer()
  initInteraction()
  setupUploadOverlay()

  // Track mouse position for temp-rect rendering
  const canvas = document.getElementById('main-canvas')!
  canvas.addEventListener('mousemove', (e) => {
    setLastMouse(e.offsetX, e.offsetY)
  })

  pushHistory()  // Save initial empty state for undo
  renderLoop()
}

main()
