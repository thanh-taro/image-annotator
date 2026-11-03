// Per-worktree e2e ports, so several checkouts (parallel builders) can run the suites at once without
// colliding or attaching to another checkout's servers. Every port is above 20000, clear of WebKit's
// blocked-port list (all ≤ 10080). Environment overrides: E2E_PORT (preview), E2E_HOST_PORT_BASE
// (the four host-harness servers use base … base + 3).
import { fileURLToPath } from 'node:url';

/** FNV-1a over this checkout's path: stable per worktree, different between worktrees. */
function checkoutHash(): number {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  let h = 0x811c9dc5;
  for (let i = 0; i < root.length; i++) {
    h ^= root.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 2000;
}

const fromEnv = (name: string): number | null => {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : null;
};

/** `pnpm preview` port for the default suite: 30000–31999 unless E2E_PORT is set. */
export const PREVIEW_PORT = fromEnv('E2E_PORT') ?? 30000 + checkoutHash();

/** First of the four host-harness ports: 20000–27996 (step 4) unless E2E_HOST_PORT_BASE is set. */
export const HOST_PORT_BASE = fromEnv('E2E_HOST_PORT_BASE') ?? 20000 + checkoutHash() * 4;
