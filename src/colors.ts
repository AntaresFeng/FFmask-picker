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

/** Resolve a color name or hex string to a CSS-compatible hex value. */
export function resolveColor(color: string): string {
  if (color.startsWith('#') || color.startsWith('rgb') || color.startsWith('hsl')) return color
  return COLOR_MAP[color.toLowerCase()] || color
}
