import {
  AppScrollAreaProvider,
  createAppScrollAreaController,
} from '@components/AppScrollAreaContext';
import { Outlet, createRootRoute } from '@tanstack/solid-router';
import { onCleanup } from 'solid-js';
import type { Component } from 'solid-js';

const ScrollerWrapper: Component = () => {
  const appScroll = createAppScrollAreaController();
  onCleanup(() => appScroll.setViewport(null));

  return (
    <AppScrollAreaProvider value={appScroll}>
      <div
        ref={appScroll.setViewport}
        onScroll={appScroll.handleViewportScroll}
        data-testid="app-scroll-viewport"
        class="h-screen w-screen overflow-auto overscroll-contain"
      >
        <div class="min-w-fit">
          <Outlet />
        </div>
      </div>
    </AppScrollAreaProvider>
  );
};

export const Route = createRootRoute({
  component: ScrollerWrapper,
});
