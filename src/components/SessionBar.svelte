<script lang="ts">
  import { store_session } from '../stores/session'
  import { startHost, startPlayer, stopSession, PEER_SERVER_DOCS } from '../lib/sessionSync'

  export let onHostStarted: () => void = () => {}
  export let ensureFogForPlay: () => void = () => {}

  let joinInput = ''
  let busy = false
  let copied = false

  async function host() {
    busy = true
    try {
      ensureFogForPlay()
      await startHost()
      onHostStarted()
    } catch (e) {
      console.error(e)
      alert(`Could not start session: ${e}`)
    } finally {
      busy = false
    }
  }

  async function join() {
    const code = joinInput.trim().toUpperCase()
    if (!code) return
    busy = true
    try {
      await startPlayer(code)
    } catch (e) {
      console.error(e)
      alert(`Could not join session: ${e}`)
    } finally {
      busy = false
    }
  }

  async function leave() {
    busy = true
    try {
      await stopSession()
    } finally {
      busy = false
    }
  }

  async function copyLink() {
    if (!$store_session.joinUrl) return
    try {
      await navigator.clipboard.writeText($store_session.joinUrl)
      copied = true
      setTimeout(() => (copied = false), 1500)
    } catch {
      prompt('Copy this join URL:', $store_session.joinUrl)
    }
  }
</script>

<div class="bar" class:player={$store_session.role === 'player'} class:gm={$store_session.role === 'gm'}>
  {#if $store_session.role === 'solo'}
    <span class="label">Play session</span>
    <button type="button" disabled={busy} on:click={host}>Host (GM)</button>
    <input bind:value={joinInput} placeholder="Join code" maxlength="8" on:keydown={(e) => e.key === 'Enter' && join()} />
    <button type="button" disabled={busy || !joinInput.trim()} on:click={join}>Join</button>
  {:else if $store_session.role === 'gm'}
    <span class="badge gm">GM</span>
    <span class="status">{$store_session.status} · {$store_session.peerCount} player(s)</span>
    {#if $store_session.sessionCode}
      <code class="code">{$store_session.sessionCode}</code>
      <button type="button" on:click={copyLink}>{copied ? 'Copied!' : 'Copy join link'}</button>
    {/if}
    <button type="button" disabled={busy} on:click={leave}>End session</button>
  {:else}
    <span class="badge player">Player (view only)</span>
    <span class="status">{$store_session.status}</span>
    {#if $store_session.sessionCode}
      <code class="code">{$store_session.sessionCode}</code>
    {/if}
    <button type="button" disabled={busy} on:click={leave}>Leave</button>
  {/if}
  {#if $store_session.error}
    <span class="err">{$store_session.error}</span>
  {/if}
  <span class="peer-hint" title={PEER_SERVER_DOCS.note}>P2P via {PEER_SERVER_DOCS.name}</span>
</div>

<style>
  .bar {
    position: fixed;
    top: 0.5em;
    left: 50%;
    transform: translateX(-50%);
    z-index: 100;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5em;
    padding: 0.4em 0.75em;
    background: rgba(20, 24, 32, 0.92);
    border: 1px solid #3a4254;
    border-radius: 999px;
    font-size: 0.85em;
    max-width: 95vw;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  }
  .bar.player {
    border-color: #5b8def;
  }
  .bar.gm {
    border-color: var(--hexfriend-green, #8cc63f);
  }
  .label {
    opacity: 0.8;
    margin-right: 0.25em;
  }
  .badge {
    font-weight: 700;
    padding: 0.15em 0.55em;
    border-radius: 999px;
    font-size: 0.8em;
  }
  .badge.gm {
    background: var(--hexfriend-green, #8cc63f);
    color: #111;
  }
  .badge.player {
    background: #5b8def;
    color: #fff;
  }
  .code {
    background: #0d1117;
    padding: 0.2em 0.5em;
    border-radius: 0.35em;
    letter-spacing: 0.08em;
    font-weight: 700;
  }
  input {
    width: 7em;
    padding: 0.3em 0.5em;
    border-radius: 0.35em;
    border: 1px solid #555;
    background: #111;
    color: inherit;
    text-transform: uppercase;
  }
  button {
    padding: 0.3em 0.7em;
    border-radius: 999px;
    border: none;
    background: var(--hexfriend-green, #8cc63f);
    color: #111;
    font-weight: 600;
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .err {
    color: #ff8a8a;
    max-width: 18em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .peer-hint {
    opacity: 0.45;
    font-size: 0.75em;
    margin-left: 0.25em;
  }
  .status {
    opacity: 0.85;
  }
</style>
