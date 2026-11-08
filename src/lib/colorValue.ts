/**
 * Hexfriend stores tile / symbol / style colors as RGB integers (e.g. plains 11462236).
 * PIXI.Color instances JSON.stringify to {_value, _components, _int}, which PIXI cannot
 * parse back (beginFill/tint throw "Unable to convert color [object Object]").
 * Color.shared aliases also serialize as whatever the singleton last held.
 *
 * Never feed decimal strings like "11462236" to PIXI.Color — it treats them as hex
 * ("11462236" → #114622) and silently changes the color.
 */

export const COLOR_KEYS = new Set([
  'bgColor',
  'blankHexColor',
  'color',
  'stroke',
  'fill',
  'fill_color',
])

const SKIP_WALK_KEYS = new Set([
  'preview_flatTop',
  'preview_pointyTop',
  'preview',
  'base64',
  'overlay_base64',
  'revealed',
])

export function sanitizeColorValue(value: unknown): unknown {
  if (value == null) return value

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : value
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed === '') return value

    if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(trimmed)) {
      let hex = trimmed.slice(1)
      if (hex.length === 3 || hex.length === 4) {
        hex = hex
          .split('')
          .map((ch) => ch + ch)
          .join('')
      }
      return parseInt(hex.slice(0, 6), 16)
    }

    if (/^0x[0-9a-f]{1,8}$/i.test(trimmed)) {
      return parseInt(trimmed, 16) & 0xffffff
    }

    // Decimal numeric strings must stay decimal. PIXI.Color("11462236") is #114622.
    if (/^-?\d+$/.test(trimmed)) {
      const n = Number(trimmed)
      if (Number.isFinite(n)) return n
    }

    return value
  }

  if (typeof value === 'object') {
    const c = value as {
      toNumber?: () => unknown
      _int?: unknown
      _value?: unknown
      _components?: { [key: string]: number } | number[]
    }

    if (typeof c.toNumber === 'function') {
      try {
        const n = c.toNumber()
        if (typeof n === 'number' && Number.isFinite(n)) return n
      } catch {
        // fall through to serialized fields
      }
    }

    if (typeof c._int === 'number' && Number.isFinite(c._int)) return c._int
    if (typeof c._value === 'number' && Number.isFinite(c._value)) return c._value
    if (typeof c._value === 'string') {
      const inner = sanitizeColorValue(c._value)
      if (typeof inner === 'number') return inner
    }

    const comp = c._components
    if (comp) {
      const r = Math.round(Number(comp[0]) * 255)
      const g = Math.round(Number(comp[1]) * 255)
      const b = Math.round(Number(comp[2]) * 255)
      if ([r, g, b].every((ch) => Number.isFinite(ch))) {
        return (r << 16) + (g << 8) + b
      }
    }
  }

  return value
}

export function colorReplacer(key: string, value: unknown): unknown {
  if (COLOR_KEYS.has(key) && value != null) {
    return sanitizeColorValue(value)
  }
  return value
}

/** In-place: coerce known color fields on a parsed save / terrain field to plain numbers. */
export function hydrateSaveColors(data: unknown): void {
  walkColors(data)
}

function walkColors(node: unknown): void {
  if (!node || typeof node !== 'object') return

  if (Array.isArray(node)) {
    for (const item of node) walkColors(item)
    return
  }

  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    if (SKIP_WALK_KEYS.has(key)) continue
    if (COLOR_KEYS.has(key) && value != null) {
      const next = sanitizeColorValue(value)
      if (next !== value) obj[key] = next
    } else if (value && typeof value === 'object') {
      walkColors(value)
    }
  }
}
