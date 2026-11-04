// Minimal Node typings for the host/offline harness (the e2e tsconfig uses no @types/node, keeping
// the suite free of an unregistered dependency; adapters/tests.md). Extend as the harness needs more.
declare module 'node:child_process' {
  export function execFileSync(
    file: string,
    args: readonly string[],
    options?: { cwd?: string; stdio?: string; env?: Record<string, string | undefined> },
  ): unknown;
}
declare module 'node:fs' {
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { isDirectory(): boolean };
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: string): Uint8Array;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
  export function extname(path: string): string;
}
declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string;
}
declare module 'node:http' {
  export interface Server {
    listen(port: number, cb: () => void): Server;
    close(cb: () => void): Server;
  }
  export function createServer(handler: (req: unknown, res: unknown) => void): Server;
}
declare const process: { env: Record<string, string | undefined> };
declare module 'node:zlib' {
  export function inflateSync(data: Uint8Array): Uint8Array;
  export function deflateSync(data: Uint8Array): Uint8Array;
}
