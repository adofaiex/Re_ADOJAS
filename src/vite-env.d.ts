/// <reference types="vite/client" />

/**
 * Virtual modules provided by vite-plugin-wasm-inline.
 * Each exports the WASM binary as a base64-encoded string.
 */
declare module 'virtual:wasm-easing' {
  const base64: string;
  export default base64;
}

declare module 'virtual:wasm-tile-color' {
  const base64: string;
  export default base64;
}

declare module 'virtual:wasm-level-loader' {
  const base64: string;
  export default base64;
}
