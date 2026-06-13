// src/toast.ts

export function showToast(message: string): void {
  const el = document.getElementById('toast')!
  el.textContent = message
  el.classList.add('show')
  setTimeout(() => el.classList.remove('show'), 2000)
}
