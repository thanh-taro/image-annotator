// Close the harness servers started in global-setup.
import type { Server } from 'node:http';

async function globalTeardown(): Promise<void> {
  const servers = (globalThis as unknown as { __harnessServers?: Server[] }).__harnessServers ?? [];
  await Promise.all(servers.map((s) => new Promise<void>((resolve) => s.close(() => resolve()))));
}

export default globalTeardown;
