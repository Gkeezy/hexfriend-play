import { Tools } from '../types/toolData'

/** Always-visible bottom toolbar tools and their digit shortcuts, in toolbar order. */
export const TOOLBAR_HOTKEYS: { tool: Tools; key: string; label: number; name: string }[] = [
  { tool: Tools.TERRAIN, key: '1', label: 1, name: 'Terrain' },
  { tool: Tools.ICON, key: '2', label: 2, name: 'Icon' },
  { tool: Tools.PATH, key: '3', label: 3, name: 'Path' },
  { tool: Tools.TEXT, key: '4', label: 4, name: 'Text' },
  { tool: Tools.ERASER, key: '5', label: 5, name: 'Eraser' },
  { tool: Tools.FOG, key: '6', label: 6, name: 'Fog' },
]

const BY_TOOL = Object.fromEntries(TOOLBAR_HOTKEYS.map((entry) => [entry.tool, entry])) as Partial<
  Record<Tools, (typeof TOOLBAR_HOTKEYS)[number]>
>

/** Overlay is a conditional seventh button; it keeps a digit shortcut that is not 6. */
export const OVERLAY_HOTKEY = 7

export function toolbarHotkeyFor(tool: Tools): number | null {
  return BY_TOOL[tool]?.label ?? null
}

/** Visible caption under a toolbar icon, e.g. "6 Fog". Overlay has none. */
export function toolbarHotkeyCaption(tool: Tools): string | null {
  const entry = BY_TOOL[tool]
  return entry ? `${entry.label} ${entry.name}` : null
}

export function toolbarHotkeyAction(tool: Tools): string {
  return `changeTool_${tool}`
}
