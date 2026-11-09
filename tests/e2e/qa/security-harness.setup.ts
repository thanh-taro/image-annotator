// QA security harness setup: two builds with their real deploy headers (the configured host allowed;
// an empty HOST_ORIGINS list), served on their own origins with the request log of
// tests/e2e/support/server.mjs, plus the stub host and a foreign origin. Returns the teardown.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// @ts-expect-error -- plain ESM build script without type declarations
import { pageCsp, PERMISSIONS_POLICY, SW_CSP } from '../../../scripts/gen-headers.mjs';
// @ts-expect-error -- plain ESM harness module without type declarations
import { hostServer, staticServer } from '../support/server.mjs';
import { HOST_ALLOWED, PORTS } from '../support/urls';

const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const OUT = path.join(ROOT, 'dist-e2e', 'qa-security');

function headersFile(origins: string[]): string {
  return `/*
  Content-Security-Policy: ${pageCsp(origins)}
  Permissions-Policy: ${PERMISSIONS_POLICY}
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Cross-Origin-Opener-Policy: same-origin
  Cache-Control: no-cache
/assets/*
  ! Cache-Control
  Cache-Control: public, max-age=31536000, immutable
/sw.js
  ! Content-Security-Policy
  ! Cache-Control
  Content-Security-Policy: ${SW_CSP}
  Cache-Control: no-cache
`;
}

function build(dir: string, hostOrigins: string, origins: string[]): void {
  fs.rmSync(dir, { recursive: true, force: true });
  execFileSync('pnpm', ['exec', 'vite', 'build', '--outDir', dir, '--emptyOutDir', '--logLevel', 'warn'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, HOST_ORIGINS: hostOrigins },
  });
  fs.writeFileSync(path.join(dir, '_headers'), headersFile(origins));
}

export default async function setup(): Promise<() => Promise<void>> {
  const allowed = path.join(OUT, 'allowed');
  const empty = path.join(OUT, 'empty');
  build(allowed, HOST_ALLOWED, [HOST_ALLOWED]);
  build(empty, '', []);
  const servers: { close(cb: () => void): void; closeAllConnections?: () => void }[] = await Promise.all([
    staticServer({ root: allowed, port: PORTS.toolAllowed }),
    staticServer({ root: empty, port: PORTS.toolEmpty }),
    hostServer({ port: PORTS.hostAllowed }),
    hostServer({ port: PORTS.hostOther }),
  ]);
  return async () => {
    await Promise.all(
      servers.map(
        (s) =>
          new Promise<void>((r) => {
            s.closeAllConnections?.();
            s.close(() => r());
          }),
      ),
    );
  };
}
