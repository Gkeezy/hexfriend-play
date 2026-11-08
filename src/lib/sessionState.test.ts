import {
  canUseSessionFiles,
  parseSessionFile,
  prepareSessionSave,
  sessionFilename,
  shouldPushFullSnapshotAfterLoad,
} from './sessionState'
import { sanitizeColorValue } from './colorValue'

function sampleSave(overrides: Record<string, unknown> = {}) {
  return {
    saveVersion: 15,
    title: 'Test Campaign',
    TerrainField: {
      hexes: {
        '0:0:0': { q: 0, r: 0, s: 0, tile: { id: 'grass', bgColor: 1 } },
        '1:0:-1': { q: 1, r: 0, s: -1, tile: { id: 'water', bgColor: 2 } },
        '0:1:-1': { q: 0, r: 1, s: -1, tile: null },
      },
    },
    paths: [{ id: 1, points: [0, 0] }],
    icons: [{ id: 2, x: 1, y: 2 }],
    texts: [{ id: 3, text: 'Town' }],
    coords: { shown: false },
    overlay: { shown: false },
    fog: { enabled: true, revealed: { '0:0:0': true } },
    ...overrides,
  }
}

function roundtrip(save: ReturnType<typeof sampleSave>, terrain?: { hexes: Record<string, unknown> }) {
  const prepared = prepareSessionSave(save, terrain)
  return parseSessionFile(JSON.stringify(prepared))
}

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

function deepEqual(a: unknown, b: unknown, message: string) {
  const left = JSON.stringify(a)
  const right = JSON.stringify(b)
  if (left !== right) throw new Error(`${message}\n  expected ${right}\n  got      ${left}`)
}

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

test('fog enabled with mixed hidden/revealed hexes roundtrips', () => {
  const loaded = roundtrip(sampleSave())
  assert(loaded.fog?.enabled === true, 'fog should stay enabled')
  deepEqual(loaded.fog?.revealed, { '0:0:0': true }, 'only the revealed hex should persist')
  const hexes = loaded.TerrainField.hexes as Record<string, { tile: { id: string } | null }>
  assert(hexes['0:0:0'].tile?.id === 'grass', 'revealed grass tile missing')
  assert(hexes['1:0:-1'].tile?.id === 'water', 'hidden water tile missing')
  assert(hexes['0:1:-1'].tile === null, 'blank hex missing')
  assert(!Object.keys(loaded.fog?.revealed || {}).includes('1:0:-1'), 'hidden hex should not be marked revealed')
})

test('fog disabled still persists revealed set for later re-enable', () => {
  const loaded = roundtrip(
    sampleSave({
      fog: { enabled: false, revealed: { '1:0:-1': true, '0:0:0': true } },
    }),
  )
  assert(loaded.fog?.enabled === false, 'fog should stay disabled')
  deepEqual(loaded.fog?.revealed, { '1:0:-1': true, '0:0:0': true }, 'revealed set should persist while disabled')
})

test('older no-fog (v14) saves get safe disabled defaults', () => {
  const v14 = sampleSave({ saveVersion: 14 })
  delete (v14 as { fog?: unknown }).fog
  const loaded = parseSessionFile(JSON.stringify(v14))
  assert(loaded.fog?.enabled === false, 'legacy save should default fog off')
  deepEqual(loaded.fog?.revealed, {}, 'legacy save should have empty revealed set')
  assert(!!loaded.TerrainField.hexes['0:0:0'], 'map hexes should survive conversion')
})

test('continued edits after load are included in the next save', () => {
  const loaded = roundtrip(sampleSave())
  loaded.fog!.revealed['0:1:-1'] = true
  const hexes = loaded.TerrainField.hexes as Record<string, { tile: { id: string; bgColor: number } | null }>
  hexes['1:0:-1'].tile = { id: 'road', bgColor: 3 }
  const again = roundtrip(loaded as ReturnType<typeof sampleSave>)
  deepEqual(again.fog?.revealed, { '0:0:0': true, '0:1:-1': true }, 'new reveals should persist after reload')
  const againHexes = again.TerrainField.hexes as Record<string, { tile: { id: string } | null }>
  assert(againHexes['1:0:-1'].tile?.id === 'road', 'post-load terrain edit should persist')
})

test('prepareSessionSave prefers live terrain field overlay', () => {
  const liveTerrain = {
    hexes: {
      '9:9:-18': { q: 9, r: 9, s: -18, tile: { id: 'updated', bgColor: 9 } },
    },
  }
  const prepared = prepareSessionSave(sampleSave(), liveTerrain)
  const hexes = prepared.TerrainField.hexes as Record<string, { tile: { id: string } }>
  assert(hexes['9:9:-18'].tile.id === 'updated', 'live terrain should replace stored terrain')
  assert(hexes['0:0:0'] === undefined, 'stale terrain hexes should not leak into the snapshot')
})

test('session transport IDs are stripped from saved files', () => {
  const dirty = sampleSave({
    sessionCode: 'ABC123',
    peerId: 'hexfriend-play-ABC123',
    joinUrl: 'https://example.test/?join=ABC123',
    connections: [{ id: 'secret' }],
    session: { role: 'gm' },
  })
  const loaded = roundtrip(dirty)
  assert(!('sessionCode' in loaded), 'sessionCode should be stripped')
  assert(!('peerId' in loaded), 'peerId should be stripped')
  assert(!('joinUrl' in loaded), 'joinUrl should be stripped')
  assert(!('connections' in loaded), 'connections should be stripped')
  assert(!('session' in loaded), 'session should be stripped')
  assert(loaded.fog?.enabled === true, 'fog should remain after stripping transport fields')
})

test('malformed fog becomes a safe default without dropping the map', () => {
  const loaded = parseSessionFile(JSON.stringify(sampleSave({ fog: { enabled: 'nope', revealed: null } })))
  deepEqual(loaded.fog, { enabled: false, revealed: {} }, 'malformed fog should sanitize')
})

test('invalid files are rejected', () => {
  let threw = false
  try {
    parseSessionFile('not-json')
  } catch (e) {
    threw = /not valid JSON/.test(String(e))
  }
  assert(threw, 'invalid JSON should throw')
  threw = false
  try {
    parseSessionFile('{"title":"Nope"}')
  } catch (e) {
    threw = /Not a Hexfriend map file/.test(String(e))
  }
  assert(threw, 'non-map JSON should throw')
})

test('filename uses map title', () => {
  assert(sessionFilename({ title: 'Frostgrave Night 2' }) === 'Frostgrave Night 2.hexfriend', 'title filename')
  assert(sessionFilename({ title: '' }) === 'Untitled Hexfriend.hexfriend', 'empty title fallback')
})

test('player view cannot save or load session files; GM load may broadcast', () => {
  assert(canUseSessionFiles('solo', false) === true, 'solo can save/load')
  assert(canUseSessionFiles('gm', false) === true, 'gm can save/load')
  assert(canUseSessionFiles('player', true) === false, 'player+readonly cannot')
  assert(canUseSessionFiles('player', false) === false, 'player cannot')
  assert(shouldPushFullSnapshotAfterLoad('gm') === true, 'gm should broadcast after load')
  assert(shouldPushFullSnapshotAfterLoad('player') === false, 'player should not broadcast')
  assert(shouldPushFullSnapshotAfterLoad('solo') === false, 'solo has no peers to broadcast to')
})


/* ---- tile color preservation (regression for Save session / Load session) ---- */

const PLAINS_BG = 11462236 // default tileset plains #aee65c
const FARMLAND_BG = 11462236
const FARMLAND_SYMBOL = 12227131
const WATER_BG = 10742015
const CUSTOM_BG = 0xcc2200
const CUSTOM_SYMBOL = 0xffee88
const OVERRIDE_BG = 0xff00aa

function storeableTile(tile) {
  const storeable = {
    ...tile,
    bgColor: sanitizeColorValue(tile.bgColor),
    preview_flatTop: '',
    preview_pointyTop: '',
    symbol: tile.symbol
      ? { ...tile.symbol, base64: '', color: sanitizeColorValue(tile.symbol.color) }
      : null,
  }
  delete storeable.preview_flatTop
  delete storeable.preview_pointyTop
  delete storeable.display
  delete storeable.symbol?.base64
  delete storeable.symbol?.display
  return storeable
}

function colorMapSave(overrides: Record<string, unknown> = {}) {
  const plains = { display: 'Plains', bgColor: PLAINS_BG, id: 'plains', symbol: null, tileset_id: 'default' }
  const farmland = {
    display: 'Farmland',
    bgColor: FARMLAND_BG,
    id: 'farmland',
    tileset_id: 'default',
    symbol: {
      color: FARMLAND_SYMBOL,
      texWidth: 100,
      texHeight: 100,
      pHex: 85,
      base64: 'data:image/png;base64,AAA',
      texId: 'farmland_symbol',
      id: 'farmland_symbol',
      display: 'farmland symbol',
      rotation: 0,
      scaleMode: 'relative',
    },
  }
  const water = { display: 'Water', bgColor: WATER_BG, id: 'water', symbol: null, tileset_id: 'default' }
  const custom = {
    display: 'CustomLava',
    bgColor: CUSTOM_BG,
    id: 'lava',
    tileset_id: 'custom',
    symbol: {
      color: CUSTOM_SYMBOL,
      texWidth: 10,
      texHeight: 10,
      pHex: 80,
      base64: 'data:image/png;base64,BBB',
      texId: 'lava_symbol',
      id: 'lava_symbol',
      display: '',
      rotation: 15,
      scaleMode: 'relative',
    },
  }
  const override = storeableTile(plains)
  override.bgColor = OVERRIDE_BG

  return {
    saveVersion: 15,
    title: 'Color Campaign',
    TerrainField: {
      blankHexColor: 0xf2f2f2,
      grid: { stroke: 0x333333, thickness: 1, shown: true },
      largehexes: { shown: false, style: { width: 3, color: 0x333333 } },
      hexes: {
        '0:0:0': { q: 0, r: 0, s: 0, tile: storeableTile(plains) },
        '1:0:-1': { q: 1, r: 0, s: -1, tile: storeableTile(farmland) },
        '0:1:-1': { q: 0, r: 1, s: -1, tile: storeableTile(water) },
        '1:-1:0': { q: 1, r: -1, s: 0, tile: null },
        '-1:1:0': { q: -1, r: 1, s: 0, tile: override },
        '2:0:-2': { q: 2, r: 0, s: -2, tile: storeableTile(custom) },
      },
    },
    tilesets: [
      { id: 'default', name: 'Default', format_version: 4, tiles: [plains, farmland, water] },
      { id: 'custom', name: 'Custom', format_version: 4, tiles: [custom] },
    ],
    fog: { enabled: true, revealed: { '0:0:0': true, '-1:1:0': true } },
    ...overrides,
  }
}

function hexTile(save: any, id: string) {
  return save.TerrainField.hexes[id]?.tile
}

function tilesetTile(save: any, setId: string, tileId: string) {
  return save.tilesets.find((s: any) => s.id === setId)?.tiles.find((t: any) => t.id === tileId)
}

test('default and custom tile terrain/symbol colors survive save/load with fog', () => {
  const loaded = roundtrip(colorMapSave())
  assert(typeof hexTile(loaded, '0:0:0').bgColor === 'number', 'plains bgColor should be a number')
  assert(hexTile(loaded, '0:0:0').bgColor === PLAINS_BG, 'plains hex color')
  assert(hexTile(loaded, '1:0:-1').bgColor === FARMLAND_BG, 'farmland hex bg')
  assert(hexTile(loaded, '1:0:-1').symbol.color === FARMLAND_SYMBOL, 'farmland symbol color')
  assert(hexTile(loaded, '0:1:-1').bgColor === WATER_BG, 'water hex color')
  assert(hexTile(loaded, '2:0:-2').bgColor === CUSTOM_BG, 'custom hex bg')
  assert(hexTile(loaded, '2:0:-2').symbol.color === CUSTOM_SYMBOL, 'custom symbol color')
  assert(tilesetTile(loaded, 'default', 'plains').bgColor === PLAINS_BG, 'palette plains')
  assert(tilesetTile(loaded, 'default', 'farmland').symbol.color === FARMLAND_SYMBOL, 'palette farmland symbol')
  assert(tilesetTile(loaded, 'custom', 'lava').bgColor === CUSTOM_BG, 'palette custom bg')
  assert(loaded.fog?.enabled === true, 'fog enabled should survive with colors')
  deepEqual(loaded.fog?.revealed, { '0:0:0': true, '-1:1:0': true }, 'fog revealed set should survive with colors')
  assert(loaded.TerrainField.blankHexColor === 0xf2f2f2, 'blankHexColor')
  assert(loaded.TerrainField.grid.stroke === 0x333333, 'grid stroke color')
})

test('per-hex color overrides stay independent of the tileset palette', () => {
  const loaded = roundtrip(colorMapSave())
  assert(hexTile(loaded, '-1:1:0').bgColor === OVERRIDE_BG, 'overridden hex should keep custom color')
  assert(hexTile(loaded, '0:0:0').bgColor === PLAINS_BG, 'other plains hex should keep default color')
  assert(tilesetTile(loaded, 'default', 'plains').bgColor === PLAINS_BG, 'palette should not pick up the override')
})

test('later color edits survive another roundtrip without clobbering neighbors', () => {
  const loaded = roundtrip(colorMapSave())
  hexTile(loaded, '0:0:0').bgColor = 0x112233
  hexTile(loaded, '1:0:-1').symbol.color = 0xabcdef
  const again = roundtrip(loaded)
  assert(hexTile(again, '0:0:0').bgColor === 0x112233, 'edited plains bg should persist')
  assert(hexTile(again, '1:0:-1').symbol.color === 0xabcdef, 'edited farmland symbol should persist')
  assert(hexTile(again, '0:1:-1').bgColor === WATER_BG, 'unedited water should be unchanged')
  assert(hexTile(again, '-1:1:0').bgColor === OVERRIDE_BG, 'unedited override should be unchanged')
  assert(hexTile(again, '2:0:-2').symbol.color === CUSTOM_SYMBOL, 'unedited custom symbol should be unchanged')
})

test('repeated color roundtrips stay stable', () => {
  let current: any = colorMapSave()
  const expected = {
    plains: PLAINS_BG,
    farmlandBg: FARMLAND_BG,
    farmlandSym: FARMLAND_SYMBOL,
    water: WATER_BG,
    override: OVERRIDE_BG,
    customBg: CUSTOM_BG,
    customSym: CUSTOM_SYMBOL,
  }
  for (let i = 0; i < 3; i++) {
    current = roundtrip(current)
    assert(hexTile(current, '0:0:0').bgColor === expected.plains, `plains after roundtrip ${i + 1}`)
    assert(hexTile(current, '1:0:-1').bgColor === expected.farmlandBg, `farmland bg after roundtrip ${i + 1}`)
    assert(hexTile(current, '1:0:-1').symbol.color === expected.farmlandSym, `farmland symbol after roundtrip ${i + 1}`)
    assert(hexTile(current, '0:1:-1').bgColor === expected.water, `water after roundtrip ${i + 1}`)
    assert(hexTile(current, '-1:1:0').bgColor === expected.override, `override after roundtrip ${i + 1}`)
    assert(hexTile(current, '2:0:-2').bgColor === expected.customBg, `custom bg after roundtrip ${i + 1}`)
    assert(hexTile(current, '2:0:-2').symbol.color === expected.customSym, `custom symbol after roundtrip ${i + 1}`)
  }
})

test('older no-fog files keep tile colors', () => {
  const v14 = colorMapSave({ saveVersion: 14 })
  delete (v14 as { fog?: unknown }).fog
  const loaded = parseSessionFile(JSON.stringify(v14))
  assert(hexTile(loaded, '0:0:0').bgColor === PLAINS_BG, 'v14 plains color')
  assert(hexTile(loaded, '1:0:-1').symbol.color === FARMLAND_SYMBOL, 'v14 farmland symbol')
  assert(hexTile(loaded, '-1:1:0').bgColor === OVERRIDE_BG, 'v14 override')
  assert(loaded.fog?.enabled === false, 'v14 fog default')
})

test('serialized PIXI.Color objects on hexes and palettes are restored to numbers', () => {
  const pixiColor = (n: number) => ({
    _value: n,
    _components: { 0: 1, 1: 0, 2: 0, 3: 1 },
    _int: n,
  })
  const dirty = colorMapSave()
  hexTile(dirty, '0:0:0').bgColor = pixiColor(PLAINS_BG)
  hexTile(dirty, '1:0:-1').symbol.color = pixiColor(FARMLAND_SYMBOL)
  tilesetTile(dirty, 'custom', 'lava').bgColor = pixiColor(CUSTOM_BG)
  // Ordinary JSON.stringify (old export / already-written file) keeps the object shape
  const loaded = parseSessionFile(JSON.stringify(dirty))
  assert(hexTile(loaded, '0:0:0').bgColor === PLAINS_BG, 'restored plains from Color JSON')
  assert(typeof hexTile(loaded, '0:0:0').bgColor === 'number', 'restored plains is number')
  assert(hexTile(loaded, '1:0:-1').symbol.color === FARMLAND_SYMBOL, 'restored farmland symbol from Color JSON')
  assert(tilesetTile(loaded, 'custom', 'lava').bgColor === CUSTOM_BG, 'restored palette Color JSON')
})

test('prepareSessionSave snapshots Color instances and Color.shared-like objects to numbers', () => {
  const instance = {
    _value: PLAINS_BG,
    _int: PLAINS_BG,
    toNumber() {
      return this._int
    },
  }
  const sharedCurrent = { current: OVERRIDE_BG }
  const shared = {
    get _int() {
      return sharedCurrent.current
    },
    toNumber() {
      return sharedCurrent.current
    },
  }
  const dirty = colorMapSave()
  hexTile(dirty, '0:0:0').bgColor = instance
  hexTile(dirty, '-1:1:0').bgColor = shared
  sharedCurrent.current = 0x00ff00
  const prepared = prepareSessionSave(dirty, dirty.TerrainField)
  assert(hexTile(prepared, '0:0:0').bgColor === PLAINS_BG, 'Color instance should snapshot its own value')
  assert(hexTile(prepared, '-1:1:0').bgColor === 0x00ff00, 'shared Color should snapshot the value at save time')
  assert(typeof hexTile(prepared, '0:0:0').bgColor === 'number', 'instance snapshot is a number')
  assert(typeof hexTile(prepared, '-1:1:0').bgColor === 'number', 'shared snapshot is a number')
})

test('hex strings become numbers; decimal color strings stay decimal not hex', () => {
  assert(sanitizeColorValue('#aee65c') === PLAINS_BG, 'css hex plains')
  assert(sanitizeColorValue('0xaee65c') === PLAINS_BG, '0x hex plains')
  assert(sanitizeColorValue(String(PLAINS_BG)) === PLAINS_BG, 'decimal string must not become #114622')
  assert(sanitizeColorValue(PLAINS_BG) === PLAINS_BG, 'numbers are unchanged')
  const dirty = colorMapSave()
  hexTile(dirty, '0:0:0').bgColor = '#aee65c'
  hexTile(dirty, '0:1:-1').bgColor = String(WATER_BG)
  const loaded = parseSessionFile(JSON.stringify(dirty))
  assert(hexTile(loaded, '0:0:0').bgColor === PLAINS_BG, 'css hex on hex tile')
  assert(hexTile(loaded, '0:1:-1').bgColor === WATER_BG, 'decimal string on hex tile')
})

console.log(`\n${passed} tests passed`)
