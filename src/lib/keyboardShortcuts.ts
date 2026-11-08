import type { shortcut_data } from '../types/inputs';
import { Tools } from '../types/toolData';
import { OVERLAY_HOTKEY, TOOLBAR_HOTKEYS, toolbarHotkeyAction } from './toolHotkeys';

// Order must be control+shift+alt+{key in lower case}

export let shortcuts: shortcut_data[] = [
	// Keycodes that work anywhere
	// These will override tool specific commands
	{ keycode: 'control+s', function: 'save', tool: null, display: 'Save Current Map' },
	{ keycode: 'control+z', function: 'undo', tool: null, display: 'Undo' },
	{ keycode: 'control+shift+z', function: 'redo', tool: null, display: 'Redo' },

	// { keycode: 'control+z', function: 'undo', tool: null, display: 'Undo <wip>' },
	// { keycode: 'control+shift+z', function: 'redo', tool: null, display: 'Redo <wip>' },
	{ keycode: 'shift+m', function: 'toggleViewMaps', tool: null, display: 'Toggle Maps' },
	{ keycode: 'shift+s', function: 'toggleViewSettings', tool: null, display: 'Toggle Settings' },
	{ keycode: 'escape', function: 'backToMainView', tool: null, display: 'Back to Main View' },
	{ keycode: 'control+/', function: 'toggleShortcutList', tool: null, display: 'View Shortcut List' },
	{ keycode: 'shift+/', function: 'toggleControls', tool: null, display: 'Toggle Controls' },

	...TOOLBAR_HOTKEYS.map((entry) => ({
		keycode: entry.key,
		function: toolbarHotkeyAction(entry.tool),
		tool: null,
		display: `${entry.tool[0].toUpperCase()}${entry.tool.slice(1)} Tool`,
	})),
	{ keycode: String(OVERLAY_HOTKEY), function: 'changeTool_overlay', tool: null, display: 'Overlay Tool' },

	{ keycode: 'control+q', function: 'toggle_overlay', tool: null, display: 'Toggle Overlay Visibility' },

	// TERRAIN
	{ keycode: 'e', function: 'toggleEraser', tool: Tools.TERRAIN, display: 'Toggle Eraser' },
	{ keycode: 'p', function: 'togglePaintbucket', tool: Tools.TERRAIN, display: 'Toggle Paintbucket' },

	{ keycode: 'shift', function: null, tool: Tools.TERRAIN, display: 'Erase', displayKeycode: 'shift (Hold)' },
	{ keycode: 'control', function: null, tool: Tools.TERRAIN, display: 'Paint Bucket', displayKeycode: 'control (Hold)' },
	{ keycode: 'alt', function: null, tool: Tools.TERRAIN, display: 'Eyedropper', displayKeycode: 'alt (Hold)' },

	// ICONs
	{ keycode: 's', function: 'toggleSnap', tool: Tools.ICON, display: 'Toggle Snapping' },
	{ keycode: 'control', function: 'toggleDragMode', tool: Tools.ICON, display: 'Drag Icon', displayKeycode: 'control (Hold)' },

	// PATH
	{ keycode: 's', function: 'toggleSnap', tool: Tools.PATH, display: 'Toggle Snapping' },
	{ keycode: 'delete', function: 'deletePath', tool: Tools.PATH, display: 'Delete Selected Path' },
	{ keycode: 'backspace', function: 'deleteLastPoint', tool: Tools.PATH, display: 'Delete Latest Point' },
	{ keycode: 'control+d', function: 'deselect', tool: Tools.PATH, display: 'Deselect Path' },

	{ keycode: 'shift', function: null, tool: Tools.PATH, display: 'Ignore Paths', displayKeycode: 'shift (Hold)' },

	// TEXT
	{ keycode: 'control+b', function: 'toggleBold', tool: Tools.TEXT, display: 'Toggle Bold' },
	{ keycode: 'control+i', function: 'toggleItalics', tool: Tools.TEXT, display: 'Toggle Italics' },
	{ keycode: 'control+delete', function: 'deleteText', tool: Tools.TEXT, display: 'Delete Selected Text' },

	// ERASER
	{ keycode: 'shift', function: null, tool: Tools.ERASER, display: 'Only Erase Terrain', displayKeycode: 'shift (Hold)' },
	{ keycode: 'control', function: null, tool: Tools.ERASER, display: 'Only Erase Icons', displayKeycode: 'control (Hold)' },

	// OVERLAY
];

export function getKeyboardShortcut(keyCode: string, $store_selected_tool: Tools) {
	return shortcuts.find((shortcut: shortcut_data) => shortcut.keycode == keyCode && (shortcut.tool == $store_selected_tool || shortcut.tool == null));
}

export default { getKeyboardShortcut };
