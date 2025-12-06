import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      // Only scan the console package's tsconfig, not the entire monorepo
      projects: ['./tsconfig.json'],
    }),
  ],
  appType: 'spa',
  build: {
    sourcemap: false,
    rollupOptions: {
      // Suppress sourcemap warnings from dependencies
      onwarn(warning, warn) {
        // Ignore sourcemap resolution errors from node_modules
        if (warning.code === 'SOURCEMAP_ERROR') return;
        warn(warning);
      },
    },
  },
});
