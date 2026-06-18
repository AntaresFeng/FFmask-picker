// src/export.ts

import type { Rectangle } from './types'
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
export function drawboxString(rect: Rectangle): string {
  const t = rect.filled ? 'fill' : String(rect.thickness)
  const ffmpegColor = toFfmpegColor(rect.color)
  const color = rect.opacity < 1 ? `${ffmpegColor}@${+rect.opacity.toFixed(2)}` : ffmpegColor
  let s = `drawbox=x=${rect.x}:y=${rect.y}:w=${rect.width}:h=${rect.height}:color=${color}:t=${t}`
  if (rect.timeRange) {
    const start = +rect.timeRange.start.toFixed(3)
    const end = +rect.timeRange.end.toFixed(3)
    s += `:enable='between(t,${start},${end})'`
  }
  return s
}

/**
 * Generate combined drawbox filter string for all visible rectangles.
 * Returns the value for -vf "..." (without the outer quotes).
 */
export function allDrawboxString(rectangles: Rectangle[]): string {
  return rectangles
    .filter(r => r.visible)
    .map(r => drawboxString(r))
    .join(',')
}

/**
 * Export rectangles as JSON config.
 */
export function exportJson(rectangles: Rectangle[]): string {
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
          start: r.timeRange.start,
          end: r.timeRange.end,
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

/**
 * Parse JSON text and return validated rectangles.
 * Returns only valid rects; records errors for invalid items.
 */
export function importJson(text: string): { rects: Rectangle[]; errors: string[] } {
  const errors: string[] = []
  let data: unknown

  try {
    data = JSON.parse(text)
  } catch {
    return { rects: [], errors: ['JSON 解析失败'] }
  }

  if (!Array.isArray(data)) {
    return { rects: [], errors: ['JSON 根元素必须是数组'] }
  }

  const rects: Rectangle[] = []

  for (let i = 0; i < data.length; i++) {
    const item = data[i]
    const prefix = `矩形 ${i + 1}`

    if (typeof item !== 'object' || item === null) {
      errors.push(`${prefix}：不是对象`)
      continue
    }

    const obj = item as Record<string, unknown>
    const { x, y, width, height } = obj

    if (!isFiniteNum(x) || !isFiniteNum(y) || !isFiniteNum(width) || !isFiniteNum(height)) {
      errors.push(`${prefix}：x/y/width/height 必须为数字`)
      continue
    }

    const rect: Rectangle = {
      id: `imported-${i}`,
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
      color: typeof obj.color === 'string' ? obj.color : 'red',
      thickness: isFiniteNum(obj.thickness) ? (obj.thickness as number) : 4,
      filled: typeof obj.filled === 'boolean' ? obj.filled : false,
      opacity: isFiniteNum(obj.opacity) ? (obj.opacity as number) : 1,
      visible: typeof obj.visible === 'boolean' ? obj.visible : true,
    }

    const tr = obj.timeRange as Record<string, unknown> | null | undefined
    if (tr !== null && tr !== undefined) {
      if (isFiniteNum(tr.start) && isFiniteNum(tr.end)) {
        rect.timeRange = { start: tr.start as number, end: tr.end as number }
      }
    }

    rects.push(rect)
  }

  return { rects, errors }
}

function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}
