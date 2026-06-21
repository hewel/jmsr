import { expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';

expect.extend(jestDomMatchers);

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class TestIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.assign(window, {
  IntersectionObserver: TestIntersectionObserver,
  ResizeObserver: TestResizeObserver,
});

Object.assign(window, {
  __TAURI_EVENT_PLUGIN_INTERNALS__: {
    unregisterListener: () => {},
  },
  __TAURI_INTERNALS__: {
    invoke: async (cmd: string) => {
      if (cmd === 'plugin:app|version') {
        return 'test';
      }
      if (cmd === 'plugin:event|listen') {
        return 1;
      }
      return null;
    },
    transformCallback: () => 1,
    unregisterCallback: () => undefined,
  },
});
