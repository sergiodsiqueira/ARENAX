import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, normalizePath } from "vite";

const sourceDirectory = normalizePath(fileURLToPath(new URL("./src", import.meta.url)));

export default defineConfig({
  resolve: {
    alias: { "@": sourceDirectory },
  },
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 5173,
  },
});
