# Hexfriend Play — live sessions & fog of war

This is a **GPL-2.0** fork of [Aidymouse/Hexfriend](https://github.com/Aidymouse/Hexfriend) (`hexfriend.net`) with two play-focused features for TTRPG sessions:

1. **Fog of War** — per-hex revealed/hidden state saved with the map
2. **Live Sync** — GM hosts a session; players join with a link and see the map + fog update in near real time (view-only)

Upstream map editing (terrain, icons, paths, text, settings, import/export) is unchanged for normal single-player map making.

## How to start a session (GM)

1. Open the app and load or create your map as usual.
2. In the top **Play session** bar, click **Host (GM)**. Fog is enabled automatically.
3. Copy the **join link** (or share the 6-character code) with players.
4. Select the **Fog** tool (cloud icon). Paint to **reveal** hexes; use the hide brush / eraser mini-button to cover them again. Paintbucket floods contiguous same-state hexes. Panel actions: Reveal all / Hide all.
5. Keep editing terrain and fog as the game runs — connected players receive updates over the peer connection.

## How players join

1. Open the join link (or open the app and enter the code → **Join**).
2. Wait until status shows **connected** and the map appears.
3. Pan/zoom freely. You cannot edit the map or fog (view-only).
4. If you disconnect, reopen the same link to reconnect.


## Save session / Load session

Fog (which hexes are revealed) is part of the map file. Use the session bar so you do not have to dig through Map Settings:

1. After revealing hexes as the GM (or while mapping solo), click **Save session**.
2. A `.hexfriend` file downloads — full editable map plus `fog.enabled` and `fog.revealed`. It does **not** include join codes or peer connections.
3. Next session, click **Load session** and pick that file. The map and fog come back so you can keep editing and click **Host (GM)** again.
4. If you are already hosting when you load a file, connected players receive the newly loaded map automatically.

You can still use Hexfriend’s built-in browser Save (disk icon) and Settings → Export/Import `.hexfriend`. Those paths now write the same sanitized fog state.

**Player view** hides Save/Load so joining a game cannot overwrite maps in your browser library. Leave the session first if you want to keep your own copy.

## Fog behaviour

| Role | Unrevealed hexes |
|------|------------------|
| GM (host) | Dim translucent overlay — terrain still visible underneath |
| Player | Opaque fog — map underneath is hidden |
| Solo / fog disabled | No fog drawn (normal Hexfriend mapping) |

Fog state is stored in the `.hexfriend` save (`fog.enabled` + `fog.revealed` hex ids). **Save session** / **Load session** on the top bar is the straightforward way to persist it between game nights; Settings export/import and the browser disk-icon save use the same format.

## Sync mechanism

- **PeerJS** over WebRTC with the free public signaling server **`0.peerjs.com`** (PeerJS Cloud).
- No accounts and no paid backend. Map payloads travel peer-to-peer after signaling.
- First join gets a full map snapshot; later edits send throttled deltas (terrain field, fog, paths, icons, texts).
- Public PeerJS servers can be flaky; if host/join fails, retry or check network/firewall (UDP/WebRTC).

## Modes

- **Solo** — default Hexfriend workflow; session bar idle; fog optional via Fog tool.
- **GM** — hosting; full editing; dimmed fog overlay.
- **Player** — join link; edit UI hidden; opaque fog; pan/zoom only.

## License & attribution

GPL-2.0-only, same as upstream Hexfriend by Aidymouse. Keep the `LICENSE` file and credit upstream when you redistribute.

## Local development

```bash
yarn
yarn dev
```

Production build (GitHub Pages base path `/hexfriend-play/`):

```bash
yarn build
yarn deploy   # publishes dist/ to the gh-pages branch
```
