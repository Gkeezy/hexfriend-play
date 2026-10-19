import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages project site: https://gkeezy.github.io/hexfriend-play/
  base: '/hexfriend-play/',
})
