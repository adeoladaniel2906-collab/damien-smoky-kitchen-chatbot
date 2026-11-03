import path from 'path';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const rawPort = process.env.PORT ?? '5173';
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  // Clerk publishable keys are designed for browser use; the secret key remains a Worker-only secret.
  define: {
    'import.meta.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify('pk_test_d2lyZWQtbW9uaXRvci0zNDY0LmNsZXJrLmFjY291bnRzLmRldiQ'),
  },
  base: basePath,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
      '@assets': path.resolve(import.meta.dirname, '..', '..', 'attached_assets'),
    },
    dedupe: ['react', 'react-dom'],
  },
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': {
        // The legacy API server was removed; the Cloudflare Worker is the API.
        target: process.env.WORKER_DEV_URL ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
    fs: { strict: true },
  },
  preview: {
    port,
    host: '0.0.0.0',
    allowedHosts: true,
  },
});
