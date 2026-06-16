// src/main.ts

import './style.css'
import { initCanvas, renderLoop, setLastMouse } from './canvas'
import { initToolbar, loadVideoFile } from './toolbar'
import { initDrawer } from './drawer'
import { initInteraction } from './interaction'

function setupUploadOverlay(): void {
  const box = document.getElementById('upload-box')!
  const fileInput = document.getElementById('file-input') as HTMLInputElement

  box.addEventListener('click', () => fileInput.click())

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

  renderLoop()
}

main()
