import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev: `npm run dev:web` serves the React app on :5173 and forwards API calls
// to the Node server on :4000. Build: `npm run build` writes web/dist, which the
// Node server then serves at http://localhost:4000.
const API = `http://localhost:${process.env.PORT || 4000}`;

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": API, "/stream": API },
  },
  build: { outDir: "dist", emptyOutDir: true },
});
