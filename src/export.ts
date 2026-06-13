// src/export.ts

import type { Rectangle } from './types'
import { secondsToTimecode } from './timecode'

/**
 * Generate a single drawbox filter string for one rectangle.
 */
export function drawboxString(rect: Rectangle, _fps: number): string {
  const t = rect.filled ? 'fill' : String(rect.thickness)
  const color = rect.opacity < 1 ? `${rect.color}@${rect.opacity}` : rect.color
  let s = `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}:color=${color}:t=${t}`
  if (rect.timeRange) {
    const start = rect.timeRange.start
    const end = rect.timeRange.end
    s += `:enable='between(t,${start},${end})'`
  }
  return s
}

/**
 * Generate combined drawbox filter string for all visible rectangles.
 * Returns the value for -vf "..." (without the outer quotes).
 */
export function allDrawboxString(rectangles: Rectangle[], fps: number): string {
  return rectangles
    .filter(r => r.visible)
    .map(r => drawboxString(r, fps))
    .join(',')
}

/**
 * Generate a full ffmpeg command string.
 */
export function fullCommand(rectangles: Rectangle[], fps: number): string {
  const vf = allDrawboxString(rectangles, fps)
  return `ffmpeg -i input.mp4 -vf "${vf}" output.mp4`
}

/**
 * Export rectangles as JSON config.
 */
export function exportJson(rectangles: Rectangle[], fps: number): string {
  const data = rectangles.map(r => ({
    x: r.x,
    y: r.y,
    width: r.width,
    height: r.height,
    color: r.color,
    thickness: r.thickness,
    visible: r.visible,
    timeRange: r.timeRange
      ? {
          start: r.timeRange.start,
          end: r.timeRange.end,
          startTimecode: secondsToTimecode(r.timeRange.start, fps),
          endTimecode: secondsToTimecode(r.timeRange.end, fps),
        }
      : null,
  }))
  return JSON.stringify(data, null, 2)
}

/**
 * Copy text to clipboard. Returns true on success.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

/**
 * Trigger a file download.
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
