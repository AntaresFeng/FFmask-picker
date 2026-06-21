// src/timecode.ts

/**
 * Format seconds for display. When `showMs` is true the output includes a `.SSS`
 * millisecond suffix (ISO 8601 duration notation: HH:mm:ss.SSS or mm:ss.SSS).
 * Without `showMs` the behaviour is unchanged.
 */
export function formatTime(totalSeconds: number, showMs?: boolean): string {
  if (totalSeconds < 0) totalSeconds = 0
  const s = Math.floor(totalSeconds)
  const ss = s % 60
  const totalMin = Math.floor(s / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)

  const base = hh > 0
    ? `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    : `${mm}:${String(ss).padStart(2, '0')}`

  if (showMs) {
    const ms = Math.round(totalSeconds * 1000) % 1000
    return `${base}.${String(ms).padStart(3, '0')}`
  }
  return base
}

/**
 * Parse a user-entered time string into seconds.
 * Accepted formats: "ss", "ss.SSS", "mm:ss", "mm:ss.SSS", "HH:mm:ss", "HH:mm:ss.SSS"
 * Returns -1 for unparseable input, 0 for empty input.
 */
export function parseTimeInput(text: string): number {
  const trimmed = text.trim().replace(/[;：；]/g, ':')
  if (!trimmed) return 0

  const parts = trimmed.split(':')

  if (parts.length === 1) {
    const val = Number(parts[0])
    return Number.isFinite(val) && val >= 0 ? val : -1
  }
  if (parts.length === 2) {
    const mm = Number(parts[0])
    const ss = Number(parts[1])
    if (!Number.isFinite(mm) || !Number.isFinite(ss) || mm < 0 || ss < 0) return -1
    return mm * 60 + ss
  }
  if (parts.length === 3) {
    const hh = Number(parts[0])
    const mm = Number(parts[1])
    const ss = Number(parts[2])
    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss) || hh < 0 || mm < 0 || ss < 0) return -1
    return hh * 3600 + mm * 60 + ss
  }
  return -1
}
