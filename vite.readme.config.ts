import { defineConfig } from "vite";

export default defineConfig({
  build: {
    target: "es2022",
    outDir: "readme-package",
    emptyOutDir: true,
    minify: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: "src/readme-entry.ts",
      name: "HNBPaymentFileValidator",
      formats: ["iife"],
      fileName: () => "custom-javascript.js",
      cssFileName: "custom-css",
    },
    rollupOptions: {
      output: {
        banner: "/* HNB Payment File Validator — generated ReadMe bundle; edit the TypeScript source, not this file. */",
      },
    },
  },
});
