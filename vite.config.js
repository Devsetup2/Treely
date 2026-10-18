import { defineConfig } from 'vite';

const API = 'http://localhost:3000';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // Link kısaltma API'si ve kısa kod yönlendirmeleri (örn. /aB3xY9z) Express'e gider
      '/api': API,
      '^/[A-Za-z0-9]{7}$': API,
    },
  },
  build: {
    chunkSizeWarningLimit: 900,
  },
});
