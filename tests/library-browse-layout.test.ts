import { expect, test } from '@rstest/core';

import { libraryBrowseColumnCount } from '../src/utils/libraryBrowseLayout';

test('library browse column count auto-fits by available width', () => {
  expect(libraryBrowseColumnCount(360)).toBe(2);
  expect(libraryBrowseColumnCount(800)).toBe(4);
  expect(libraryBrowseColumnCount(1024)).toBe(6);
});

test('library browse column count falls back to one column for unknown widths', () => {
  expect(libraryBrowseColumnCount(0)).toBe(1);
  expect(libraryBrowseColumnCount(Number.NaN)).toBe(1);
});
