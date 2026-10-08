import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { studioMiddleware } from "./server/middleware.ts";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "studio-saved-results",
      configureServer(server) {
        server.middlewares.use(studioMiddleware());
      },
      configurePreviewServer(server) {
        server.middlewares.use(studioMiddleware());
      },
    },
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    proxy: {
      "/api": {
        target: process.env.TAMPER_API_URL || "http://127.0.0.1:7501",
        changeOrigin: true,
      },
    },
  },
});
