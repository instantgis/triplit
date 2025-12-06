import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import dts from 'vite-plugin-dts';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths({
      // Only scan the console package's tsconfig, not the entire monorepo
      projects: ['./tsconfig.json'],
    }),
    dts({ rollupTypes: true }),
  ],
  build: {
    lib: {
      entry: 'src/components/index.ts',
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
