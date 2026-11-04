// Minimal typings for Node's zlib (the project uses no @types/node; adapters/tests.md).
declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
  export function deflateSync(data: Uint8Array): Uint8Array;
}
