import type { HexId } from './toolData'

/** Per-map fog of war. Hexes in `revealed` are visible; all others are fogged when enabled. */
export type FogData = {
  enabled: boolean
  /** Hex IDs that players can see. Missing IDs are hidden when enabled. */
  revealed: { [key: HexId]: true }
}

export type fog_tool_data = {
  /** Paint reveals hexes; eraser hides them again. */
  usingEraser: boolean
  usingPaintbucket: boolean
}
