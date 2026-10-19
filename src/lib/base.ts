/** Vite base URL (ends with /). Use for public/ assets on GitHub Pages. */
export const BASE_URL: string = import.meta.env.BASE_URL || '/'

export function asset(path: string): string {
  const cleaned = path.startsWith('/') ? path.slice(1) : path
  return `${BASE_URL}${cleaned}`
}
