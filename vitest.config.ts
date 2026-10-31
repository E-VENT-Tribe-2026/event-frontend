import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/__tests__/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    maxWorkers: 4,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
