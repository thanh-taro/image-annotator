// `pnpm check` — every local gate in one command (ADR-0014: no code-host workflows; MOD-Build).
// Stops at the first failing step. `pnpm check:full` (`--e2e`) also runs the end-to-end suites on
// Chromium and WebKit (the preview suite and the host/offline harness).
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib/util.mjs';

const e2e = process.argv.includes('--e2e');
const steps = [
  ['codegen up to date', 'pnpm', ['gen:check']],
  ['typecheck', 'pnpm', ['typecheck']],
  ['lint + format', 'pnpm', ['lint']],
  ['unit + property tests', 'pnpm', ['test']],
  ['spec lint', 'python3', ['tools/spec_lint.py']],
  ['build', 'pnpm', ['build']],
  ['licence audit + dist scan', 'pnpm', ['check:licenses']],
  ['size budgets', 'pnpm', ['check:size']],
  ['dist contents', 'pnpm', ['check:dist']],
  ...(e2e
    ? [
        ['e2e (preview, chromium + webkit)', 'pnpm', ['test:e2e']],
        ['e2e (host + offline harness, chromium + webkit)', 'pnpm', ['test:e2e:host']],
      ]
    : []),
];

const done = [];
for (const [name, cmd, args] of steps) {
  console.log(`\n── ${name}: ${cmd} ${args.join(' ')}`);
  const started = Date.now();
  const { status } = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  done.push(`${status === 0 ? '✓' : '✗'} ${name} (${secs} s)`);
  if (status !== 0) {
    console.error(`\n${done.join('\n')}\ncheck: FAILED at "${name}"`);
    process.exit(1);
  }
}
console.log(
  `\n${done.join('\n')}\ncheck: all ${done.length} steps passed${e2e ? '' : ' (e2e: run `pnpm check:full`)'}`,
);
