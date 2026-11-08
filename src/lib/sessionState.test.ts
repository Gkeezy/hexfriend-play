import {
  canUseSessionFiles,
  parseSessionFile,
  prepareSessionSave,
  sessionFilename,
  shouldPushFullSnapshotAfterLoad,
} from './sessionState'

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

console.log(`\n${passed} tests passed`)
