// Node 16 compatibility polyfills
import crypto from "node:crypto";
if (!crypto.getRandomValues && crypto.webcrypto) {
  crypto.getRandomValues = crypto.webcrypto.getRandomValues.bind(crypto.webcrypto);
}
if (!globalThis.structuredClone) {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}

// run vite build
const { build } = await import("vite");
await build();
