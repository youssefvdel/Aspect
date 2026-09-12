import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync } from 'node:fs';

/* The app version lives in the parent package.json (the desktop app's single
   source of truth). Read it here so the embedded <ReconApp /> reports the real
   version instead of falling back to 0.0.0 in the browser. */
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
) as { version?: string };

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version ?? '0.0.0'),
  },
  /* Port 5173 belongs to the DESKTOP app: src-tauri/tauri.conf.json points
     devUrl at http://localhost:5173 and the app's vite runs with strictPort.
     Squatting on it makes `tauri dev` fail to bind and then load the website
     instead of the app. Keep the site on its own port. */
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
  },
});
