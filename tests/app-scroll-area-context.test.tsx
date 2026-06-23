import { expect, test } from '@rstest/core';
import { fireEvent, screen } from '@testing-library/dom';
import { render } from 'solid-js/web';

import {
  AppScrollAreaProvider,
  createAppScrollAreaController,
  createAppScrollListener,
  useAppScrollArea,
} from '../src/components/AppScrollAreaContext';
import type { AppScrollSnapshot } from '../src/components/AppScrollAreaContext';

function defineScrollMetrics(
  viewport: HTMLElement,
  metrics: Pick<AppScrollSnapshot, 'clientHeight' | 'clientWidth' | 'scrollHeight' | 'scrollWidth'>,
) {
  Object.defineProperties(viewport, {
    clientHeight: { configurable: true, value: metrics.clientHeight },
    clientWidth: { configurable: true, value: metrics.clientWidth },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollWidth: { configurable: true, value: metrics.scrollWidth },
  });
}

function ScrollConsumer(props: { onSnapshot: (snapshot: AppScrollSnapshot) => void }) {
  const appScroll = useAppScrollArea();
  createAppScrollListener((snapshot) => props.onSnapshot(snapshot));

  return <span data-testid="scroll-top">{appScroll.snapshot().scrollTop}</span>;
}

function TestScrollArea(props: { onSnapshot: (snapshot: AppScrollSnapshot) => void }) {
  const appScroll = createAppScrollAreaController();

  return (
    <AppScrollAreaProvider value={appScroll}>
      <div
        data-testid="app-scroll-viewport"
        ref={appScroll.setViewport}
        onScroll={appScroll.handleViewportScroll}
      >
        <ScrollConsumer onSnapshot={props.onSnapshot} />
      </div>
    </AppScrollAreaProvider>
  );
}

test('app scroll area context publishes viewport scroll snapshots to descendants', () => {
  const snapshots: AppScrollSnapshot[] = [];
  const root = document.createElement('div');
  document.body.append(root);
  const dispose = render(
    () => <TestScrollArea onSnapshot={(snapshot) => snapshots.push(snapshot)} />,
    root,
  );

  const viewport = screen.getByTestId('app-scroll-viewport');
  defineScrollMetrics(viewport, {
    clientHeight: 100,
    clientWidth: 240,
    scrollHeight: 300,
    scrollWidth: 240,
  });
  viewport.scrollTop = 120;

  fireEvent.scroll(viewport);

  expect(snapshots.at(-1)?.scrollTop).toBe(120);
  expect(snapshots.at(-1)?.atBottom).toBe(false);
  expect(screen.getByTestId('scroll-top')).toHaveTextContent('120');

  dispose();
  root.remove();
});
