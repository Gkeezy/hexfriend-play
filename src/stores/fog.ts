import { writable } from 'svelte/store'
import type { fog_tool_data } from '../types/fog'

export const data_fog = writable<fog_tool_data>({
  usingEraser: false,
  usingPaintbucket: false,
})
