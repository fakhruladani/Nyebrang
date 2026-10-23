import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

// Game dilayani di https://<host>/nyebrang/ (Caddy handle_path), jadi base = "/nyebrang/".
export default defineConfig({
  base: "/nyebrang/",
  resolve: {
    alias: { "@shared": fileURLToPath(new URL("../shared/src", import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Saat dev, /nyebrang/api/* diteruskan ke server lokal tanpa prefix (meniru handle_path Caddy)
      "/nyebrang/api": {
        target: "http://127.0.0.1:3100",
        rewrite: (p) => p.replace(/^\/nyebrang/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 2000, // Phaser ~1,2 MB; diterima
  },
});
