<script lang="ts">
  import type { SaveData } from '../types/savedata'
  import type FogLayer from '../layers/FogLayer.svelte'
  import { data_fog } from '../stores/fog'

  export let loaded_save: SaveData
  export let comp_fogLayer: FogLayer
  export let onFogChanged: () => void = () => {}

  function toggleEnabled() {
    if (!loaded_save.fog) {
      loaded_save.fog = { enabled: true, revealed: {} }
    } else {
      loaded_save.fog.enabled = !loaded_save.fog.enabled
    }
    loaded_save = loaded_save
    comp_fogLayer?.renderAll()
    onFogChanged()
  }

  function revealAll() {
    if (!loaded_save.fog) loaded_save.fog = { enabled: true, revealed: {} }
    loaded_save.fog.enabled = true
    comp_fogLayer?.revealAll()
    loaded_save = loaded_save
    onFogChanged()
  }

  function hideAll() {
    if (!loaded_save.fog) loaded_save.fog = { enabled: true, revealed: {} }
    loaded_save.fog.enabled = true
    loaded_save.fog.revealed = {}
    loaded_save = loaded_save
    comp_fogLayer?.renderAll()
    onFogChanged()
  }
</script>

<aside class="panel">
  <h2>Fog of War</h2>
  <p class="hint">Paint to <strong>reveal</strong> hexes. Toggle eraser to <strong>hide</strong> again. Players only see revealed hexes.</p>

  <label class="row">
    <input type="checkbox" checked={loaded_save.fog?.enabled ?? false} on:change={toggleEnabled} />
    Fog enabled
  </label>

  <div class="actions">
    <button type="button" on:click={revealAll}>Reveal all</button>
    <button type="button" on:click={hideAll}>Hide all</button>
  </div>

  <div class="modes">
    <button
      type="button"
      class:active={!$data_fog.usingEraser}
      on:click={() => data_fog.update((n) => ({ ...n, usingEraser: false }))}
    >
      Reveal brush
    </button>
    <button
      type="button"
      class:active={$data_fog.usingEraser}
      on:click={() => data_fog.update((n) => ({ ...n, usingEraser: true }))}
    >
      Hide brush
    </button>
  </div>
</aside>

<style>
  .panel {
    position: absolute;
    left: 1em;
    top: 5em;
    width: 16em;
    padding: 1em;
    background: var(--primary-background);
    border-radius: 0.75em;
    z-index: 20;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  h2 {
    margin: 0 0 0.5em;
    font-size: 1.1em;
  }
  .hint {
    font-size: 0.85em;
    opacity: 0.85;
    margin: 0 0 0.75em;
    line-height: 1.35;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 0.75em;
    cursor: pointer;
  }
  .actions,
  .modes {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5em;
    margin-bottom: 0.75em;
  }
  button {
    flex: 1;
    min-width: 6em;
    padding: 0.45em 0.6em;
    border-radius: 0.4em;
    border: 1px solid var(--light-background, #444);
    background: var(--dark-background, #222);
    color: inherit;
    cursor: pointer;
  }
  button.active {
    background: var(--hexfriend-green, #8cc63f);
    color: #111;
    border-color: transparent;
  }
</style>
