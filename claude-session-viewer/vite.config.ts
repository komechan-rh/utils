import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// See https://tauri.app/start/frontend/vite/ — this config follows Tauri's
// documented recommended setup (fixed dev port matching tauri.conf.json's
// devUrl, ignore src-tauri from the watcher, etc).
export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
