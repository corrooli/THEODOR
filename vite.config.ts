import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// GitHub Pages serves the app from /THEODOR/
export default defineConfig({
  base: process.env.THEODOR_BASE ?? '/THEODOR/',
  plugins: [svelte()],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
