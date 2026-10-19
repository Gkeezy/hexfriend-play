<script lang="ts">
  import type { HexId } from '../types/toolData'
  import type { SaveData } from '../types/savedata'
  import type { FogData } from '../types/fog'
  import { data_fog } from '../stores/fog'
  import { tfield } from '../stores/tfield'
  import { store_inputs } from '../stores/inputs'
  import * as store_panning from '../stores/panning'
  import { store_session } from '../stores/session'
  import { store_has_unsaved_changes } from '../stores/flags'
  import {
    coords_cubeToWorld,
    coords_worldToCube,
    genHexId,
    genHexId_coordsObj,
    getHexPath,
    getNeighbours,
    id_to_coords,
  } from '../helpers/hexHelpers'
  import * as PIXI from 'pixi.js'

  export let cont_fog: PIXI.Container
  export let loaded_save: SaveData
  /** Called after fog paint so live sync can push. */
  export let onFogChanged: () => void = () => {}

  let fogGraphics = new PIXI.Graphics()
  cont_fog.addChild(fogGraphics)

  function ensureFog(): FogData {
    if (!loaded_save.fog) {
      loaded_save.fog = { enabled: true, revealed: {} }
    }
    return loaded_save.fog
  }

  export function isRevealed(hexId: HexId): boolean {
    const fog = loaded_save.fog
    if (!fog || !fog.enabled) return true
    return !!fog.revealed[hexId]
  }

  export function revealHex(hexId: HexId, render = true) {
    if (!$tfield.hexes[hexId]) return
    const fog = ensureFog()
    fog.enabled = true
    if (fog.revealed[hexId]) return
    fog.revealed[hexId] = true
    $store_has_unsaved_changes = true
    if (render) renderAll()
  }

  export function hideHex(hexId: HexId, render = true) {
    if (!$tfield.hexes[hexId]) return
    const fog = ensureFog()
    fog.enabled = true
    if (!fog.revealed[hexId]) return
    delete fog.revealed[hexId]
    $store_has_unsaved_changes = true
    if (render) renderAll()
  }

  export function revealAll() {
    const fog = ensureFog()
    fog.enabled = true
    for (const hexId of Object.keys($tfield.hexes) as HexId[]) {
      fog.revealed[hexId] = true
    }
    $store_has_unsaved_changes = true
    renderAll()
  }

  export function hideAll() {
    const fog = ensureFog()
    fog.enabled = true
    fog.revealed = {}
    $store_has_unsaved_changes = true
    renderAll()
  }

  export function renderAll() {
    fogGraphics.clear()
    const fog = loaded_save.fog
    if (!fog || !fog.enabled) return
    if (!$tfield?.hexes) return

    const opaque = $store_session.fogOpaque
    const alpha = opaque ? 1 : 0.55
    const color = opaque ? 0x0d1117 : 0x1a1f2e

    fogGraphics.beginFill(color, alpha)

    for (const hexId of Object.keys($tfield.hexes) as HexId[]) {
      if (fog.revealed[hexId]) continue
      const hex = $tfield.hexes[hexId]
      const world = coords_cubeToWorld(
        hex.q,
        hex.r,
        hex.s,
        $tfield.orientation,
        $tfield.hexWidth,
        $tfield.hexHeight,
        $tfield.gap,
      )
      fogGraphics.drawPolygon(
        getHexPath($tfield.hexWidth, $tfield.hexHeight, $tfield.orientation, world.x, world.y),
      )
    }
    fogGraphics.endFill()
  }

  function hexAtMouse(): HexId | null {
    const coords = coords_worldToCube(
      store_panning.curWorldX(),
      store_panning.curWorldY(),
      $tfield.orientation,
      $tfield.hexWidth,
      $tfield.hexHeight,
      $tfield.gap,
    )
    const id = genHexId(coords.q, coords.r, coords.s)
    return $tfield.hexes[id] ? id : null
  }

  function paintAtMouse() {
    const id = hexAtMouse()
    if (!id) return
    if ($data_fog.usingEraser) hideHex(id)
    else revealHex(id)
    onFogChanged()
  }

  function flood(startId: HexId, reveal: boolean) {
    const fog = ensureFog()
    fog.enabled = true
    const startRevealed = !!fog.revealed[startId]
    // Paint contiguous hexes that share the same revealed state as the start
    const targetState = startRevealed
    const seen = new Set<HexId>([startId])
    const stack: HexId[] = [startId]
    while (stack.length) {
      const cur = stack.pop()!
      const coords = id_to_coords(cur)
      for (const nId of getNeighbours(coords.q, coords.r, coords.s)) {
        if (!$tfield.hexes[nId] || seen.has(nId)) continue
        const nRevealed = !!fog.revealed[nId]
        if (nRevealed !== targetState) continue
        seen.add(nId)
        stack.push(nId)
      }
    }
    for (const id of seen) {
      if (reveal) fog.revealed[id] = true
      else delete fog.revealed[id]
    }
    $store_has_unsaved_changes = true
    renderAll()
    onFogChanged()
  }

  export function pointerdown() {
    if ($store_session.readOnly) return
    if (!$store_inputs.mouseDown[0]) return
    ensureFog().enabled = true
    if ($data_fog.usingPaintbucket) {
      const id = hexAtMouse()
      if (!id) return
      flood(id, !$data_fog.usingEraser)
    } else {
      paintAtMouse()
    }
  }

  // Re-render when fog data reference, terrain field, or session fog mode changes
  $: loaded_save?.fog, $tfield?.hexes, $store_session.fogOpaque, $store_session.role
  $: {
    if (loaded_save && $tfield) renderAll()
  }
</script>
