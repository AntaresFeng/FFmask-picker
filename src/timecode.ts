// src/timecode.ts

/**
 * Format seconds as MM:SS or HH:MM:SS for display.
 */
export function formatTime(totalSeconds: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const s = Math.floor(totalSeconds)
  const ss = s % 60
  const totalMin = Math.floor(s / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  if (hh > 0) {
    return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  }
  return `${mm}:${String(ss).padStart(2, '0')}`
}

/**
 * Parse a user-entered time string into seconds.
 * Accepted formats: "SS", "SS.mmm", "MM:SS", "MM:SS.mmm", "HH:MM:SS", "HH:MM:SS.mmm"
 * Returns 0 for unparseable input.
 */
export function parseTimeInput(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const parts = trimmed.split(':')
  try {
    if (parts.length === 1) {
      // SS or SS.mmm
      const val = Number(parts[0])
      return Number.isFinite(val) && val >= 0 ? val : 0
    }
    if (parts.length === 2) {
      // MM:SS or MM:SS.mmm
      const mm = Number(parts[0])
      const ss = Number(parts[1])
      if (!Number.isFinite(mm) || !Number.isFinite(ss)) return 0
      return mm * 60 + ss
    }
    if (parts.length === 3) {
      // HH:MM:SS or HH:MM:SS.mmm
      const hh = Number(parts[0])
      const mm = Number(parts[1])
      const ss = Number(parts[2])
      if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) return 0
      return hh * 3600 + mm * 60 + ss
    }
    return 0
  } catch {
    return 0
  }
}
