import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served from https://simon-bristow.github.io/alcobosh/ on GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: '/alcobosh/',
})
