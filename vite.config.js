import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages project sites are served from /<repository-name>/.
  // Local development and other hosting services use the root path by default.
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react()],
  server: { host: '0.0.0.0' },
});
