import { readFileSync } from 'node:fs';
import { expect, test } from '@rstest/core';

test('Saved Session JSON parsing uses an Effect throwing boundary', () => {
  const authSource = readFileSync('src/effects/auth.ts', 'utf8');

  expect(authSource).toContain('yield* Effect.try({');
  expect(authSource).toContain('try: () => JSON.parse(raw)');
  expect(authSource).toContain('new StorageParseError({');
});
