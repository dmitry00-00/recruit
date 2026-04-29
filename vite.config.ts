import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const HH_USER_AGENT = 'RecruitApp/1.0 (serzpobedinski@gmail.com)';

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
        secure: true,
        rewrite: (p) => p.replace(/^\/hh-api/, ''),
        configure: (proxy) => {
          // HH.ru rejects requests with browser-specific headers like Origin /
          // Referer / Cookie that leak through Vite's proxy. Strip everything
          // and set only the headers HH.ru's API requires.
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
            proxyReq.removeHeader('cookie');
            proxyReq.removeHeader('accept-language');
            proxyReq.removeHeader('sec-fetch-site');
            proxyReq.removeHeader('sec-fetch-mode');
            proxyReq.removeHeader('sec-fetch-dest');
            proxyReq.removeHeader('sec-ch-ua');
            proxyReq.removeHeader('sec-ch-ua-mobile');
            proxyReq.removeHeader('sec-ch-ua-platform');
            proxyReq.setHeader('User-Agent',    HH_USER_AGENT);
            proxyReq.setHeader('HH-User-Agent', HH_USER_AGENT);
            proxyReq.setHeader('Accept',        'application/json');
          });
        },
      },
    },
  },
})
