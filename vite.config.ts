import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from alissahsu.com/projects/upstairs-room/ via a rewrite on the main site.
  base: '/projects/upstairs-room/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Libraries change far less often than the room, so they get their own
        // long-cached chunks and a deploy of the app alone doesn't re-send them.
        codeSplitting: {
          groups: [
            { name: 'three', test: /node_modules[\\/](three|three-stdlib)[\\/]/, priority: 3 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 2 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
})
