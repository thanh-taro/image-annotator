// Minimal typings for Node's zlib (the project uses no @types/node; adapters/tests.md). The one
// declaration for both the unit and the e2e configs (tsconfig.e2e.json includes this file).
declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
  export function deflateSync(data: Uint8Array): Uint8Array;
}
