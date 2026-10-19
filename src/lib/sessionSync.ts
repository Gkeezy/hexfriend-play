/**
 * Live map sync via PeerJS (WebRTC).
 * Signaling: PeerJS Cloud free server (0.peerjs.com).
 * No accounts; GM hosts with a peer id derived from the join code; players connect to that id.
 */
import Peer, { type DataConnection } from 'peerjs'
import { get } from 'svelte/store'
import type { SaveData } from '../types/savedata'
import type { FogData } from '../types/fog'
import type { TerrainField } from '../types/terrain'
import type { PathLayerPath } from '../types/path'
import type { IconLayerIcon } from '../types/icon'
import type { TextLayerText } from '../types/text'
import type { CoordinatesData, OverlayData } from '../types/data'
import { store_session } from '../stores/session'
import { BASE_URL } from './base'

export type MapDelta = {
  fog: FogData
  TerrainField: TerrainField
  paths: PathLayerPath[]
  icons: IconLayerIcon[]
  texts: TextLayerText[]
  coords: CoordinatesData
  overlay: OverlayData
  title: string
}

export type SyncMessage =
  | { type: 'full'; save: SaveData; v: 1 }
  | { type: 'delta'; delta: MapDelta; v: 1 }

export type SyncHandlers = {
  onFull: (save: SaveData) => void
  onDelta: (delta: MapDelta) => void
}

const PEER_HOST = '0.peerjs.com'
const PEER_PORT = 443
const PEER_PATH = '/'
const PEER_SECURE = true
const THROTTLE_MS = 250

function makeSessionCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (let i = 0; i < 6; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

function peerIdFromCode(code: string): string {
  return `hexfriend-play-${code.toUpperCase()}`
}

function buildJoinUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const path = BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`
  return `${origin}${path}?join=${encodeURIComponent(code.toUpperCase())}`
}

let peer: Peer | null = null
let connections: DataConnection[] = []
let handlers: SyncHandlers | null = null
let dirtyTimer: ReturnType<typeof setTimeout> | null = null
let getSnapshot: (() => SaveData) | null = null
let getDelta: (() => MapDelta) | null = null
let playerHostCode: string | null = null
let playerReconnectTimer: ReturnType<typeof setTimeout> | null = null

function setStatus(partial: Parameters<typeof store_session.update>[0] extends (s: infer S) => infer S ? Partial<S> : never) {
  store_session.update((s) => ({ ...s, ...partial }))
}

function broadcast(msg: SyncMessage) {
  for (const conn of connections) {
    if (conn.open) {
      try {
        conn.send(msg)
      } catch (e) {
        console.warn('sync send failed', e)
      }
    }
  }
}

function wireHostConnection(conn: DataConnection) {
  conn.on('open', () => {
    connections = [...connections.filter((c) => c.peer !== conn.peer), conn]
    setStatus({ peerCount: connections.length, status: 'hosting', error: null })
    if (getSnapshot) {
      try {
        conn.send({ type: 'full', save: getSnapshot(), v: 1 } satisfies SyncMessage)
      } catch (e) {
        console.warn('initial full send failed', e)
      }
    }
  })

  conn.on('close', () => {
    connections = connections.filter((c) => c !== conn)
    setStatus({ peerCount: connections.length })
  })

  conn.on('error', (err) => {
    console.warn('peer conn error', err)
  })
}

function wirePlayerConnection(conn: DataConnection) {
  conn.on('open', () => {
    connections = [conn]
    setStatus({ status: 'connected', error: null, peerCount: 1 })
  })

  conn.on('data', (data) => {
    const msg = data as SyncMessage
    if (!msg || typeof msg !== 'object') return
    if (msg.type === 'full') handlers?.onFull(msg.save)
    else if (msg.type === 'delta') handlers?.onDelta(msg.delta)
  })

  conn.on('close', () => {
    connections = connections.filter((c) => c !== conn)
    setStatus({ peerCount: 0, status: 'connecting', error: 'Disconnected — trying to reconnect…' })
    schedulePlayerReconnect()
  })

  conn.on('error', (err) => {
    console.warn('player conn error', err)
    setStatus({ error: String(err) })
  })
}

function schedulePlayerReconnect() {
  if (!playerHostCode || !peer || peer.destroyed) return
  if (playerReconnectTimer) clearTimeout(playerReconnectTimer)
  playerReconnectTimer = setTimeout(() => {
    playerReconnectTimer = null
    if (!peer || peer.destroyed || !playerHostCode) return
    try {
      const conn = peer.connect(peerIdFromCode(playerHostCode), { reliable: true })
      wirePlayerConnection(conn)
    } catch (e) {
      console.warn('reconnect failed', e)
      schedulePlayerReconnect()
    }
  }, 2000)
}

export function initSync(h: SyncHandlers, snapshotFn: () => SaveData, deltaFn: () => MapDelta) {
  handlers = h
  getSnapshot = snapshotFn
  getDelta = deltaFn
}

/** Call after GM map/fog edits so connected players receive a delta. */
export function markDirty() {
  if (get(store_session).role !== 'gm' || !getDelta) return
  if (dirtyTimer) clearTimeout(dirtyTimer)
  dirtyTimer = setTimeout(() => {
    dirtyTimer = null
    broadcast({ type: 'delta', delta: getDelta!(), v: 1 })
  }, THROTTLE_MS)
}

export function sendFullNow() {
  if (!getSnapshot) return
  broadcast({ type: 'full', save: getSnapshot(), v: 1 })
}

export async function startHost(): Promise<string> {
  await destroyPeer()
  const code = makeSessionCode()
  const id = peerIdFromCode(code)

  setStatus({
    role: 'gm',
    status: 'connecting',
    sessionCode: code,
    joinUrl: buildJoinUrl(code),
    error: null,
    peerCount: 0,
    readOnly: false,
    fogOpaque: false,
  })

  peer = new Peer(id, {
    host: PEER_HOST,
    port: PEER_PORT,
    path: PEER_PATH,
    secure: PEER_SECURE,
    debug: 1,
  })

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('PeerJS host timeout — public signaling may be unreachable')), 20000)
    peer!.on('open', () => {
      clearTimeout(t)
      setStatus({ status: 'hosting', sessionCode: code, joinUrl: buildJoinUrl(code) })
      resolve()
    })
    peer!.on('error', (err) => {
      clearTimeout(t)
      setStatus({ status: 'error', error: String(err) })
      reject(err)
    })
  })

  peer.on('connection', (conn) => {
    wireHostConnection(conn)
  })

  return code
}

export async function startPlayer(code: string): Promise<void> {
  await destroyPeer()
  const normalized = code.trim().toUpperCase()
  playerHostCode = normalized
  const hostId = peerIdFromCode(normalized)

  setStatus({
    role: 'player',
    status: 'connecting',
    sessionCode: normalized,
    joinUrl: buildJoinUrl(normalized),
    error: null,
    peerCount: 0,
    readOnly: true,
    fogOpaque: true,
  })

  peer = new Peer({
    host: PEER_HOST,
    port: PEER_PORT,
    path: PEER_PATH,
    secure: PEER_SECURE,
    debug: 1,
  })

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('PeerJS player timeout — public signaling may be unreachable')), 20000)
    peer!.on('open', () => {
      clearTimeout(t)
      resolve()
    })
    peer!.on('error', (err) => {
      clearTimeout(t)
      setStatus({ status: 'error', error: String(err) })
      reject(err)
    })
  })

  const conn = peer.connect(hostId, { reliable: true })
  wirePlayerConnection(conn)
}

export async function stopSession() {
  playerHostCode = null
  await destroyPeer()
  store_session.set({
    role: 'solo',
    status: 'idle',
    sessionCode: null,
    joinUrl: null,
    error: null,
    peerCount: 0,
    readOnly: false,
    fogOpaque: false,
  })
}

async function destroyPeer() {
  if (dirtyTimer) {
    clearTimeout(dirtyTimer)
    dirtyTimer = null
  }
  if (playerReconnectTimer) {
    clearTimeout(playerReconnectTimer)
    playerReconnectTimer = null
  }
  for (const c of connections) {
    try {
      c.close()
    } catch (_) {
      /* ignore */
    }
  }
  connections = []
  if (peer) {
    try {
      peer.destroy()
    } catch (_) {
      /* ignore */
    }
    peer = null
  }
}

export function getJoinCodeFromLocation(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const join = params.get('join') || params.get('session')
  if (join) return join.trim().toUpperCase()
  const hash = window.location.hash.replace(/^#/, '')
  if (hash.startsWith('join=')) return hash.slice(5).trim().toUpperCase()
  return null
}

export const PEER_SERVER_DOCS = {
  name: 'PeerJS Cloud',
  host: PEER_HOST,
  note: 'Free public signaling server (0.peerjs.com). Map data travels peer-to-peer over WebRTC; no Hexfriend backend or accounts.',
}
