import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config — runs the dev server on port 5173 and proxies API + WebSocket calls
// to the Spring Boot backend on port 8081
export default defineConfig({
  plugins: [react()],
  // SockJS folosește variabila `global`, care nu există în browser. O mapăm pe `globalThis`.
  define: {
    global: 'globalThis',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
      '/ws': {
        target: 'http://localhost:8081',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
