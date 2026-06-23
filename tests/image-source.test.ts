import { expect, test } from '@rstest/core';

import { imageSource } from '../src/utils/imageSource';

test('imageSource keeps remote URLs unchanged', () => {
  expect(imageSource('https://media.example.com/Items/1/Images/Primary?tag=a')).toBe(
    'https://media.example.com/Items/1/Images/Primary?tag=a',
  );
});

test('imageSource converts local cache paths to asset URLs', () => {
  expect(imageSource('/home/user/.cache/jellypilot/image.png')).toBe(
    'asset://localhost//home/user/.cache/jellypilot/image.png',
  );
});
