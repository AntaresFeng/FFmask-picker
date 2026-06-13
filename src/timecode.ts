// src/timecode.ts

/**
 * Convert total seconds to HH:MM:SS:FF timecode string.
 * @param totalSeconds - Time in seconds (can be fractional)
 * @param fps - Frames per second
 * @returns Timecode string like "00:01:23:15"
 */
export function secondsToTimecode(totalSeconds: number, fps: number): string {
  if (totalSeconds < 0) totalSeconds = 0
  const totalFrames = Math.floor(totalSeconds * fps)
  const ff = totalFrames % fps
  const totalSec = Math.floor(totalFrames / fps)
  const ss = totalSec % 60
  const totalMin = Math.floor(totalSec / 60)
  const mm = totalMin % 60
  const hh = Math.floor(totalMin / 60)
  return [hh, mm, ss, ff].map(v => String(v).padStart(2, '0')).join(':')
}

/**
 * Convert HH:MM:SS:FF timecode string to total seconds.
 * @param timecode - Timecode string "HH:MM:SS:FF"
 * @param fps - Frames per second
 * @returns Time in seconds
 */
export function timecodeToSeconds(timecode: string, fps: number): number {
  const parts = timecode.split(':').map(Number)
  if (parts.length !== 4 || parts.some(isNaN)) return 0
  const [hh, mm, ss, ff] = parts
  return hh * 3600 + mm * 60 + ss + ff / fps
}

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
