import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [sveltekit()],
  
  // Standard Vite development server options
  server: {
    port: 5173,
    open: true
  }
});