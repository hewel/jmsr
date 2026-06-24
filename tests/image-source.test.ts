import { expect, test } from '@rstest/core';

import { imageSource } from '../src/utils/imageSource';

test('imageSource creates a JellyPilot image protocol URL from a signed image id', () => {
  expect(imageSource('signed/image id')).toBe('jellypilot-image://localhost/signed%2Fimage%20id');
});
