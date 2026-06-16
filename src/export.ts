// src/export.ts

import type { Rectangle } from './types'
import { secondsToTimecode } from './timecode'
import { resolveColor } from './colors'

/** Convert a color to ffmpeg-compatible 0xRRGGBB format. */
function toFfmpegColor(color: string): string {
  const hex = resolveColor(color) // normalize named colors to #RRGGBB
  if (hex.startsWith('#')) return '0x' + hex.slice(1)
  if (hex.startsWith('0x')) return hex
  return hex // Named colors (red, blue, etc.) are valid in ffmpeg drawbox
}

/**
 * Generate a single drawbox filter string for one rectangle.
 */
export function drawboxString(rect: Rectangle, _fps: number): string {
  const t = rect.filled ? 'fill' : String(rect.thickness)
  const ffmpegColor = toFfmpegColor(rect.color)
  const color = rect.opacity < 1 ? `${ffmpegColor}@${+rect.opacity.toFixed(2)}` : ffmpegColor
  let s = `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}:color=${color}:t=${t}`
  if (rect.timeRange) {
    const start = rect.timeRange.mode === 'frame'
      ? Math.round(rect.timeRange.start)
      : +rect.timeRange.start.toFixed(3)
    const end = rect.timeRange.mode === 'frame'
      ? Math.round(rect.timeRange.end)
      : +rect.timeRange.end.toFixed(3)
    if (rect.timeRange.mode === 'frame') {
      s += `:enable='between(n,${start},${end})'`
    } else {
      s += `:enable='between(t,${start},${end})'`
    }
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
    filled: r.filled,
    opacity: r.opacity,
    visible: r.visible,
    timeRange: r.timeRange
      ? {
          mode: r.timeRange.mode,
          start: r.timeRange.start,
          end: r.timeRange.end,
          startTimecode: r.timeRange.mode === 'frame'
            ? secondsToTimecode(r.timeRange.start / fps, fps)
            : secondsToTimecode(r.timeRange.start, fps),
          endTimecode: r.timeRange.mode === 'frame'
            ? secondsToTimecode(r.timeRange.end / fps, fps)
            : secondsToTimecode(r.timeRange.end, fps),
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
