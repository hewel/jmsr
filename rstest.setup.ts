import { expect } from '@rstest/core';
import * as jestDomMatchers from '@testing-library/jest-dom/matchers';

expect.extend(jestDomMatchers);

class TestResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class TestIntersectionObserver implements IntersectionObserver {
  static instances = new Set<TestIntersectionObserver>();

  readonly root = null;
  readonly rootMargin = '';
  readonly thresholds = [];
  private readonly callback: IntersectionObserverCallback;
  private readonly elements = new Set<Element>();

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    TestIntersectionObserver.instances.add(this);
  }

  observe(element: Element) {
    this.elements.add(element);
  }

  unobserve(element: Element) {
    this.elements.delete(element);
  }

  disconnect() {
    this.elements.clear();
    TestIntersectionObserver.instances.delete(this);
  }

  takeRecords() {
    return [];
  }

  static trigger(isIntersecting = true) {
    for (const instance of TestIntersectionObserver.instances) {
      const entries = [...instance.elements].map((element) => ({
        boundingClientRect: element.getBoundingClientRect(),
        intersectionRatio: isIntersecting ? 1 : 0,
        intersectionRect: isIntersecting ? element.getBoundingClientRect() : new DOMRect(),
        isIntersecting,
        rootBounds: null,
        target: element,
        time: performance.now(),
      }));
      instance.callback(entries, instance);
    }
  }
}

declare global {
  interface Window {
    __TEST_INTERSECTION_OBSERVER__: typeof TestIntersectionObserver;
  }
}

Object.assign(window, {
  IntersectionObserver: TestIntersectionObserver,
  ResizeObserver: TestResizeObserver,
  __TEST_INTERSECTION_OBSERVER__: TestIntersectionObserver,
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
