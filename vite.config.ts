import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/hh-api': {
        target: 'https://api.hh.ru',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/hh-api/, ''),
        headers: {
          'User-Agent': 'recruit-app/1.0 (local dev)',
        },
      },
    },
  },
})
