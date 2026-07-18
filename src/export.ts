// src/export.ts

import type { Rectangle, ExportScale } from './types'
import { resolveColor } from './colors'

/** 目标分辨预设（无视长宽比的 forced scale 目标尺寸）。 */
const SCALE_PRESETS: Record<Exclude<ExportScale, 'original'>, { w: number; h: number }> = {
  '1920x1080': { w: 1920, h: 1080 },
  '3840x2160': { w: 3840, h: 2160 },
}

/**
 * 按目标分辨率换算矩形坐标。X/Y 各自独立缩放（无视长宽比）。
 * 换算后四舍五入取整。'original' 时原样返回。
 * naturalW/H 为视频自然分辨率；缺省（0，即未加载视频或元数据未就绪）时无法
 * 做有意义的换算，原样返回原坐标，避免 |1 兜底导致坐标被放大成无意义值。
 */
function scaleRect(rect: Rectangle, scale: ExportScale, naturalW: number, naturalH: number): Rectangle {
  if (scale === 'original') return rect
  if (!naturalW || !naturalH) return rect
  const { w, h } = SCALE_PRESETS[scale]
  return {
    ...rect,
    x: Math.round(rect.x * w / naturalW),
    y: Math.round(rect.y * h / naturalH),
    width: Math.round(rect.width * w / naturalW),
    height: Math.round(rect.height * h / naturalH),
  }
}

/** Convert a color to ffmpeg-compatible 0xRRGGBB format. */
function toFfmpegColor(color: string): string {
  const hex = resolveColor(color) // normalize named colors to #RRGGBB
  if (hex.startsWith('#')) return '0x' + hex.slice(1)
  if (hex.startsWith('0x')) return hex
  return hex // Named colors (red, blue, etc.) are valid in ffmpeg drawbox
}

/**
 * Generate a single drawbox filter string for one rectangle.
 * scale/naturalW/naturalH 可选：传入时按目标分辨率换算坐标。
 */
export function drawboxString(
  rect: Rectangle,
  scale: ExportScale = 'original',
  naturalW = 0,
  naturalH = 0,
): string {
  const r = scaleRect(rect, scale, naturalW, naturalH)
  const t = r.filled ? 'fill' : String(r.thickness)
  const ffmpegColor = toFfmpegColor(r.color)
  const color = r.opacity < 1 ? `${ffmpegColor}@${+r.opacity.toFixed(2)}` : ffmpegColor
  let s = `drawbox=x=${r.x}:y=${r.y}:w=${r.width}:h=${r.height}:color=${color}:t=${t}`
  if (r.timeRange) {
    const start = +r.timeRange.start.toFixed(3)
    const end = +r.timeRange.end.toFixed(3)
    s += `:enable='between(t,${start},${end})'`
  }
  return s
}

/**
 * Generate combined drawbox filter string for all visible rectangles.
 * Returns the value for -vf "..." (without the outer quotes).
 * scale/naturalW/naturalH 可选：传入时按目标分辨率换算坐标。
 */
export function allDrawboxString(
  rectangles: Rectangle[],
  scale: ExportScale = 'original',
  naturalW = 0,
  naturalH = 0,
): string {
  return rectangles
    .filter(r => r.visible)
    .map(r => drawboxString(r, scale, naturalW, naturalH))
    .join(',')
}

/**
 * Export rectangles as JSON config.
 * scale/naturalW/naturalH 可选：传入时按目标分辨率换算坐标，与复制串保持一致。
 */
export function exportJson(
  rectangles: Rectangle[],
  scale: ExportScale = 'original',
  naturalW = 0,
  naturalH = 0,
): string {
  const data = rectangles.map(r => {
    const s = scaleRect(r, scale, naturalW, naturalH)
    return {
      x: s.x,
      y: s.y,
      width: s.width,
      height: s.height,
      color: s.color,
      thickness: s.thickness,
      filled: s.filled,
      opacity: s.opacity,
      visible: s.visible,
      timeRange: s.timeRange
        ? {
            start: s.timeRange.start,
            end: s.timeRange.end,
          }
        : null,
    }
  })
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
  // Deferred revoke: synchronous revoke can abort downloads in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/**
 * Parse JSON text and return validated rectangles.
 * Returns only valid rects; records errors for invalid items.
 */
export function importJson(text: string): { rects: Omit<Rectangle, 'id'>[]; errors: string[] } {
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

  const rects: Omit<Rectangle, 'id'>[] = []

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

    const rect: Omit<Rectangle, 'id'> = {
      x: x as number,
      y: y as number,
      width: width as number,
      height: height as number,
      color: typeof obj.color === 'string' ? obj.color : 'red',
      thickness: isFiniteNum(obj.thickness) ? (obj.thickness as number) : 4,
      filled: typeof obj.filled === 'boolean' ? obj.filled : true,
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
