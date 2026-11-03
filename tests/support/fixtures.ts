// Test fixtures from tests/fixtures (made by tests/fixtures/make-fixtures.sh), read in Vitest's Node
// environment.
// @ts-expect-error -- Node built-in; the project tsconfig has no Node types
import { readFileSync } from 'node:fs';

export const fixtureBytes = (name: string): Uint8Array<ArrayBuffer> =>
  new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)) as ArrayBuffer);
