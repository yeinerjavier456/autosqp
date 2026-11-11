import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom', 'axios'] },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false, rewrite: path => path.replace(/^\/api/, '') } }
  },
});
