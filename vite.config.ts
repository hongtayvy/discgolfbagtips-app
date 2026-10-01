import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.API_TARGET ?? 'http://localhost:8080';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 loopback explicitly. Vite's default host is `localhost`, which
    // on this machine resolves to ::1 and binds IPv6 only — browsers that reach
    // for 127.0.0.1 then get a connection refused and show a blank page.
    host: process.env.HOST ?? '127.0.0.1',
    // Honour an assigned PORT so preview tooling can pick a free port.
    port: Number(process.env.PORT) || 5173,
    // Same-origin /api keeps the API's session cookie first-party and means the
    // dev server's port doesn't have to match the API's CORS allowlist.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: false },
    },
  },
});
