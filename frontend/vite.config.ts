import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API base is read at runtime from VITE_API_BASE (defaults to localhost:8000).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on LAN so a phone can reach the dev server
    port: 5173,
  },
});
