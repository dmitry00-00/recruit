import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

const HH_USER_AGENT = 'RecruitApp/1.0 (serzpobedinski@gmail.com)';

export default defineConfig({
  plugins: [
    react(),
    {
      // Custom dev-server middleware for HH.ru API.
      // We avoid Vite's built-in `proxy` because http-proxy leaks browser
      // headers (Origin, Referer, sec-ch-ua-*, accept-language, …) that
      // trigger HH.ru's bot detection and produce 403. By doing the upstream
      // fetch ourselves we have full control over the outgoing request and
      // send only the headers HH.ru's API expects.
      name: 'hh-api-middleware',
      configureServer(server) {
        server.middlewares.use('/hh-api', async (req, res) => {
          const upstreamUrl = `https://api.hh.ru${req.url ?? ''}`;
          try {
            const upstream = await fetch(upstreamUrl, {
              method: req.method,
              headers: {
                'Accept':         'application/json',
                'Accept-Encoding': 'identity',
                'User-Agent':     HH_USER_AGENT,
                'HH-User-Agent':  HH_USER_AGENT,
              },
            });
            const body = await upstream.text();
            res.statusCode = upstream.status;
            res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
            res.setHeader('Cache-Control', 'no-store');
            res.end(body);
          } catch (err) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'hh-api proxy failed', detail: String(err) }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
