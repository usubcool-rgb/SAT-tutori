import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "../sat-tutor/src"),
      "@assets": path.resolve(import.meta.dirname, "../../attached_assets"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(import.meta.dirname, "../sat-tutor"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/renderer"),
    emptyOutDir: true,
  },
});
