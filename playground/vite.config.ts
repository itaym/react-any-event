import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Imports the library straight from ../src so playground edits show up
// instantly via HMR, with no build step in between.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')],
    },
  },
});
