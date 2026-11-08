import { Tools } from '../types/toolData'

/** Always-visible bottom toolbar tools and their digit shortcuts, in toolbar order. */
export const TOOLBAR_HOTKEYS: { tool: Tools; key: string; label: number }[] = [
  { tool: Tools.TERRAIN, key: '1', label: 1 },
  { tool: Tools.ICON, key: '2', label: 2 },
  { tool: Tools.PATH, key: '3', label: 3 },
  { tool: Tools.TEXT, key: '4', label: 4 },
  { tool: Tools.ERASER, key: '5', label: 5 },
  { tool: Tools.FOG, key: '6', label: 6 },
]

const BY_TOOL: Partial<Record<Tools, number>> = Object.fromEntries(
  TOOLBAR_HOTKEYS.map((entry) => [entry.tool, entry.label]),
)

/** Overlay is a conditional seventh button; it keeps a digit shortcut that is not 6. */
export const OVERLAY_HOTKEY = 7

export function toolbarHotkeyFor(tool: Tools): number | null {
  return BY_TOOL[tool] ?? null
}

export function toolbarHotkeyAction(tool: Tools): string {
  return `changeTool_${tool}`
}
