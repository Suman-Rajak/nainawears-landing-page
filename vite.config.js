import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Served from https://<user>.github.io/nainawears-landing-page/ on GitHub Pages
  base: '/nainawears-landing-page/',
})
