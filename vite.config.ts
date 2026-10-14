// @ts-ignore build helper is plain Node ESM
import { buildRevision } from "./scripts/build-revision.mjs";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: { __BUILD_REVISION__: JSON.stringify(buildRevision) },
  worker: { plugins: () => [], },
  base: "./",
  build: {
    target: "es2022",
    sourcemap: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
  },
});
