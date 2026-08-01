import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Permite acceder vía túnel de Cloudflare (dominio cambia en cada sesión de túnel)
    allowedHosts: ['.trycloudflare.com'],
  },
})
