import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    build: {
      outDir: env.VITE_OUT_DIR || "dist"
    },
    plugins: [react()],
    server: {
      host: "127.0.0.1",
      port: 5174,
      strictPort: true,
      proxy: {
        "/api": env.VITE_DEV_API_PROXY || "http://127.0.0.1:8000"
      }
    }
  };
});
