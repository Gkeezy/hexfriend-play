import { writable, derived, get } from 'svelte/store'

export type SessionRole = 'solo' | 'gm' | 'player'
export type SessionStatus = 'idle' | 'hosting' | 'connecting' | 'connected' | 'error'

export type SessionState = {
  role: SessionRole
  status: SessionStatus
  /** PeerJS peer id used as the join code */
  sessionCode: string | null
  joinUrl: string | null
  error: string | null
  peerCount: number
  /** When true, map/fog edits are blocked (player view). */
  readOnly: boolean
  /** GM sees dimmed fog; players see opaque fog. */
  fogOpaque: boolean
}

const initial: SessionState = {
  role: 'solo',
  status: 'idle',
  sessionCode: null,
  joinUrl: null,
  error: null,
  peerCount: 0,
  readOnly: false,
  fogOpaque: false,
}

export const store_session = writable<SessionState>(initial)

export const isPlayerView = derived(store_session, (s) => s.role === 'player' || s.readOnly)
export const isGmHosting = derived(store_session, (s) => s.role === 'gm')

export function resetSessionState() {
  store_session.set({ ...initial })
}

export function getSession(): SessionState {
  return get(store_session)
}
