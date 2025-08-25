import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test-setup.ts',
        '**/*.d.ts',
        '**/*.config.*',
        'src/app.html',
        'src/routes/**/+*.{js,ts,svelte}' // Exclude SvelteKit route files
      ]
    },
    globals: true,
    alias: {
      '$lib': './src/lib',
      '$app': './src/app'
    }
  }
});