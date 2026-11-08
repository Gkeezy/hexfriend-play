/** Local structural types so this module stays free of PIXI/Svelte imports (testable in Node). */
export type FogData = {
  enabled: boolean
  revealed: { [hexId: string]: true }
}

export type TerrainFieldLike = {
  hexes: { [hexId: string]: unknown }
  [key: string]: unknown
}

export type SaveDataLike = {
  title?: string
  fog?: FogData
  TerrainField: TerrainFieldLike
  [key: string]: unknown
}

const SESSION_TRANSPORT_KEYS = ['session', 'sessionCode', 'peerId', 'joinUrl', 'connections', 'peer'] as const

export function defaultFog(): FogData {
  return { enabled: false, revealed: {} }
}

/** Safe defaults for missing, old, or malformed fog blobs. */
export function sanitizeFog(fog: unknown): FogData {
  if (!fog || typeof fog !== 'object') return defaultFog()
  const raw = fog as { enabled?: unknown; revealed?: unknown }
  const revealed: FogData['revealed'] = {}
  if (raw.revealed && typeof raw.revealed === 'object' && !Array.isArray(raw.revealed)) {
    for (const [hexId, value] of Object.entries(raw.revealed as Record<string, unknown>)) {
      if (value) revealed[hexId] = true
    }
  }
  return {
    enabled: raw.enabled === true || raw.enabled === 'true' || raw.enabled === 1,
    revealed,
  }
}

export function stripSessionTransport<T extends Record<string, unknown>>(data: T): T {
  const copy = { ...data }
  for (const key of SESSION_TRANSPORT_KEYS) {
    delete copy[key]
  }
  return copy
}

export function isHexfriendSave(data: unknown): data is SaveDataLike {
  if (!data || typeof data !== 'object') return false
  const maybe = data as { TerrainField?: { hexes?: unknown } }
  return !!maybe.TerrainField && typeof maybe.TerrainField === 'object' && !!maybe.TerrainField.hexes && typeof maybe.TerrainField.hexes === 'object'
}

/**
 * Snapshot used for .hexfriend download and browser persistence.
 * Includes the full editable map plus fog; never peer/session transport IDs.
 */
export function prepareSessionSave<T extends SaveDataLike>(save: T, terrainField?: TerrainFieldLike): T {
  const source = stripSessionTransport({ ...(save as T & Record<string, unknown>) }) as T
  const clone = JSON.parse(JSON.stringify(source)) as T
  if (terrainField) {
    clone.TerrainField = JSON.parse(JSON.stringify(terrainField))
  }
  clone.fog = sanitizeFog(clone.fog)
  return clone
}

export function parseSessionFile(raw: string): SaveDataLike {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('File is not valid JSON')
  }
  if (!isHexfriendSave(parsed)) {
    throw new Error('Not a Hexfriend map file (missing TerrainField.hexes)')
  }
  const cleaned = stripSessionTransport(parsed as SaveDataLike & Record<string, unknown>) as SaveDataLike
  cleaned.fog = sanitizeFog(cleaned.fog)
  return cleaned
}

export function sessionFilename(save: { title?: string } | null | undefined): string {
  const raw = save?.title?.trim() || 'Untitled Hexfriend'
  const safe = raw.replace(/[/\\?%*:|"<>]/g, '-').slice(0, 80)
  return `${safe}.hexfriend`
}

/** Players must not save/load session files (avoids writing the received GM map into their library). */
export function canUseSessionFiles(role: string, readOnly: boolean): boolean {
  return role !== 'player' && !readOnly
}

/** After a local file/browser load, only the hosting GM should push a full snapshot to players. */
export function shouldPushFullSnapshotAfterLoad(role: string): boolean {
  return role === 'gm'
}
