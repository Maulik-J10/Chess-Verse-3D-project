import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    host: true,
    cors: true,
    allowedHosts: true,
    proxy: {
      '/socket.io': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three/') || id.includes('three\\') || id.endsWith('three.module.js')) {
              return 'vendor-three';
            }
            if (id.includes('@react-three')) {
              return 'vendor-r3f';
            }
            if (id.includes('chess.js') || id.includes('socket.io-client') || id.includes('engine.io-client')) {
              return 'vendor-chess';
            }
            if (id.includes('lucide-react') || id.includes('canvas-confetti')) {
              return 'vendor-ui';
            }
            if (id.includes('react') || id.includes('scheduler') || id.includes('zustand')) {
              return 'vendor-react';
            }
          }
        },
      },
    },
  },
});
