import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from alissahsu.com/projects/upstairs-room/ via a rewrite on the main site.
  base: '/projects/upstairs-room/',
  plugins: [react()],
})
