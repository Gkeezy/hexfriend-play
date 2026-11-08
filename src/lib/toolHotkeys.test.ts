import { Tools } from '../types/toolData'
import { getKeyboardShortcut, shortcuts } from './keyboardShortcuts'
import { OVERLAY_HOTKEY, TOOLBAR_HOTKEYS, toolbarHotkeyAction, toolbarHotkeyFor } from './toolHotkeys'

function assert(cond: unknown, message: string) {
  if (!cond) throw new Error(message)
}

let passed = 0
function test(name: string, fn: () => void) {
  fn()
  passed += 1
  console.log(`ok - ${name}`)
}

test('toolbar hotkeys are 1-6 in existing tool order with fog as 6', () => {
  assert(
    TOOLBAR_HOTKEYS.map((entry) => entry.tool).join(',') ===
      [Tools.TERRAIN, Tools.ICON, Tools.PATH, Tools.TEXT, Tools.ERASER, Tools.FOG].join(','),
    'toolbar hotkey order should match the six always-visible tools',
  )
  assert(
    TOOLBAR_HOTKEYS.map((entry) => entry.key).join(',') === '1,2,3,4,5,6',
    'hotkeys should be digits 1-6',
  )
  assert(toolbarHotkeyFor(Tools.FOG) === 6, 'fog should be hotkey 6')
  assert(toolbarHotkeyFor(Tools.ERASER) === 5, 'eraser should stay hotkey 5')
  assert(toolbarHotkeyFor(Tools.OVERLAY) === null, 'overlay should not take one of the 1-6 badges')
  assert(OVERLAY_HOTKEY !== 6, 'overlay replacement key must not steal 6')
})

test('keyboard shortcut table matches toolbar hotkeys and lists fog as 6', () => {
  for (const entry of TOOLBAR_HOTKEYS) {
    const shortcut = shortcuts.find((item) => item.keycode === entry.key && item.tool == null)
    assert(!!shortcut, `missing general shortcut for ${entry.key}`)
    assert(
      shortcut!.function === toolbarHotkeyAction(entry.tool),
      `${entry.key} should activate ${entry.tool}`,
    )
  }
  const six = getKeyboardShortcut('6', Tools.TERRAIN)
  assert(six?.function === 'changeTool_fog', '6 should select fog from any current tool')
  assert(six?.display === 'Fog Tool', 'help listing should name the Fog Tool')
  const overlay = shortcuts.find((item) => item.function === 'changeTool_overlay' && item.tool == null)
  assert(!!overlay, 'overlay should keep a keyboard shortcut')
  assert(overlay!.keycode !== '6', 'overlay must not remain on 6')
  assert(overlay!.keycode === String(OVERLAY_HOTKEY), 'overlay shortcut should use the reserved extra digit')
})

test('1-5 still select the original tools', () => {
  assert(getKeyboardShortcut('1', Tools.FOG)?.function === 'changeTool_terrain', '1 terrain')
  assert(getKeyboardShortcut('2', Tools.FOG)?.function === 'changeTool_icon', '2 icon')
  assert(getKeyboardShortcut('3', Tools.FOG)?.function === 'changeTool_path', '3 path')
  assert(getKeyboardShortcut('4', Tools.FOG)?.function === 'changeTool_text', '4 text')
  assert(getKeyboardShortcut('5', Tools.FOG)?.function === 'changeTool_eraser', '5 eraser')
})

console.log(`\n${passed} tests passed`)
