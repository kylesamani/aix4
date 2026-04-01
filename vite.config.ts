import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Strip crossorigin attributes from HTML - breaks file:// loading in Electron
function stripCrossorigin(): Plugin {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), stripCrossorigin()],
  base: './',
  root: 'src/renderer',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    port: 5173,
  },
})
