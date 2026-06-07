import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://simon-bristow.github.io/alcbosh/ on GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: '/alcbosh/',
})
