// src/toast.ts

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function showToast(message: string): void {
  const el = document.getElementById('toast')!
  if (toastTimer !== null) {
    clearTimeout(toastTimer)
    toastTimer = null
  }
  el.textContent = message
  el.classList.add('show')
  toastTimer = setTimeout(() => {
    el.classList.remove('show')
    toastTimer = null
  }, 2000)
}
