import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [sveltekit()],
  
  // Standard Vite development server options
  server: {
    port: 5173,
    open: true,
    // Add headers to prevent caching in development
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    // Force more aggressive HMR
    hmr: {
      overlay: true
    }
  },
  
  // Force re-optimization of dependencies to prevent stale module cache
  optimizeDeps: {
    force: true
  }
});