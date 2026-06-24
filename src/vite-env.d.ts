/// <reference types="vite/client" />

// Raw-source imports (used to inline the shared renderer into the exported player).
declare module "*?raw" {
  const src: string;
  export default src;
}
