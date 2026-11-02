// `pnpm reset` — return the local environment to a clean state (docs/local-dev.md). The tool keeps no
// data anywhere (INV-04), so there is no database or seed to reset: this removes build and test output
// and the Vite cache, then regenerates the checked-in generated files. `--all` also removes
// node_modules; run `pnpm bootstrap` afterwards.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { abs, ROOT } from './lib/util.mjs';

const OUTPUT = ['dist', 'dist-e2e', 'test-results', 'playwright-report', '.lighthouseci', 'node_modules/.vite'];
const all = process.argv.includes('--all');
for (const dir of [...OUTPUT, ...(all ? ['node_modules'] : [])]) {
  if (!fs.existsSync(abs(dir))) continue;
  fs.rmSync(abs(dir), { recursive: true, force: true });
  console.log(`removed ${dir}/`);
}
if (all) {
  console.log('reset: done — run `pnpm bootstrap` to reinstall');
} else {
  const { status } = spawnSync('pnpm', ['gen'], { cwd: ROOT, stdio: 'inherit' });
  process.exit(status ?? 1);
}
