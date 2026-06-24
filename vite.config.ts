import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone prototype. Fully client-side; no backend.
// The demo performance video lives in /public so Vite serves it as a plain
// static asset (no bundling of the 47MB file) and so it can be fetched and
// inlined at export time.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // expose on LAN so tablets/phones can test against the dev server
  },
});
