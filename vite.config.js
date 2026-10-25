import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cowartWorkbenchPlugin } from './packages/workbench/cowart-storage.js';
import { workbenchServicePlugin } from './packages/workbench/service.js';

export default defineConfig(({ command }) => ({
  plugins: command === 'serve' ? [cowartWorkbenchPlugin(resolve('.')), workbenchServicePlugin(resolve('.'))] : [],
  optimizeDeps: { include: ['react', 'react-dom/client', 'tldraw', '@tiptap/pm/state'], exclude: ['@tldraw/assets'] },
  server: { port: 4173, strictPort: true, fs: { strict: true }, watch: { ignored: ['**/.harness/**', '**/public/runs/**/*.tmp', '**/.gh-local/**'] } },
  build: { rollupOptions: { input: {
    home: resolve('index.html'),
    portal: resolve('apps/portal/index.html'),
    web: resolve('apps/web/index.html'),
    designer: resolve('apps/designer/index.html'),
    directions: resolve('apps/designer/directions/index.html')
  } } }
}));
