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
  build: {
    // Genereaza source maps separate — utile pentru debugging in prod
    // fara a creste dimensiunea bundle-ului principal.
    sourcemap: true,
    rollupOptions: {
      output: {
        // Imparte vendor-ii in chunk-uri separate ca browser-ul sa le cache-uiasca
        // independent de codul aplicatiei. Utilizatorii care revin nu re-descarca
        // librariile la fiecare deploy nou.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-stomp': ['@stomp/stompjs', 'sockjs-client'],
          'vendor-http':  ['axios'],
        },
      },
    },
  },
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
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
