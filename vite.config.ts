import crypto from "node:crypto";
// Node 16 crypto polyfill
if (!(crypto as any).getRandomValues && (crypto as any).webcrypto) {
  (crypto as any).getRandomValues = (crypto as any).webcrypto.getRandomValues.bind((crypto as any).webcrypto);
}

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  build: {
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === "EVAL" && warning.id?.includes("react-jvectormap")) return;
        warn(warning);
      },
    },
  },
  esbuild: {
    logOverride: { "css-syntax-error": "silent" },
  },
});
