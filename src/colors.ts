// src/colors.ts — Single source of truth for color name-to-hex mapping

export const COLOR_MAP: Record<string, string> = {
  red: '#ff4444',
  blue: '#4488ff',
  green: '#44cc44',
  black: '#000000',
  white: '#ffffff',
  yellow: '#ffff00',
  cyan: '#00ffff',
  magenta: '#ff00ff',
  orange: '#ff8800',
}

/** Scratch canvas for CSS color parsing — created once, reused per call. */ 
const _scratch = new OffscreenCanvas(1, 1)
const _scratchCtx = _scratch.getContext('2d')!
const _colorCache = new Map<string, string>()

/** Check whether a color value matches a known preset name. */
export function isPresetColor(color: string): boolean {
  return color.toLowerCase() in COLOR_MAP
}

/** Resolve any CSS color string to #RRGGBB hex. */
export function resolveColor(color: string): string {
  if (color.startsWith('#')) return expandHex(color)
  const key = color.toLowerCase()
  if (key in COLOR_MAP) return COLOR_MAP[key]
  const cached = _colorCache.get(key)
  if (cached) return cached
  const hex = parseCssColor(color)
  _colorCache.set(key, hex)
  return hex
}

function expandHex(hex: string): string {
  if (hex.length === 4) return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3]
  return hex // Return #RRGGBB as-is; values like #RRGGBBAA are also passed through unchanged
}

/** Parses any CSS color into #RRGGBB using OffscreenCanvas. Retains the canvas's previous value for invalid input. */
function parseCssColor(color: string): string {
  _scratchCtx.fillStyle = color
  _scratchCtx.fillRect(0, 0, 1, 1)
  const [r, g, b] = _scratchCtx.getImageData(0, 0, 1, 1).data
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
