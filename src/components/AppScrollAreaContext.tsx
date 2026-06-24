import { createContext, createSignal, onCleanup, useContext } from 'solid-js';
import type { Accessor, JSX, ParentProps } from 'solid-js';

export interface AppScrollSnapshot {
  scrollTop: number;
  scrollLeft: number;
  clientWidth: number;
  clientHeight: number;
  scrollWidth: number;
  scrollHeight: number;
  atTop: boolean;
  atBottom: boolean;
  atLeft: boolean;
  atRight: boolean;
}

export type AppScrollListener = (snapshot: AppScrollSnapshot, event: Event | null) => void;

export interface AppScrollAreaApi {
  viewport: Accessor<HTMLElement | null>;
  snapshot: Accessor<AppScrollSnapshot>;
  setViewport: (el: HTMLElement | null) => void;
  handleViewportScroll: JSX.EventHandler<HTMLElement, Event>;
  measure: () => AppScrollSnapshot;
  scrollTo: (options: ScrollToOptions) => void;
  subscribe: (listener: AppScrollListener) => () => void;
}

const INITIAL_SCROLL_SNAPSHOT: AppScrollSnapshot = {
  scrollTop: 0,
  scrollLeft: 0,
  clientWidth: 0,
  clientHeight: 0,
  scrollWidth: 0,
  scrollHeight: 0,
  atTop: true,
  atBottom: true,
  atLeft: true,
  atRight: true,
};

const SCROLL_EDGE_TOLERANCE_PX = 1;

const AppScrollAreaContext = createContext<AppScrollAreaApi>();

function snapshotFromViewport(viewport: HTMLElement | null): AppScrollSnapshot {
  if (!viewport) {
    return INITIAL_SCROLL_SNAPSHOT;
  }

  const scrollBottom = viewport.scrollTop + viewport.clientHeight;
  const scrollRight = viewport.scrollLeft + viewport.clientWidth;

  return {
    scrollTop: viewport.scrollTop,
    scrollLeft: viewport.scrollLeft,
    clientWidth: viewport.clientWidth,
    clientHeight: viewport.clientHeight,
    scrollWidth: viewport.scrollWidth,
    scrollHeight: viewport.scrollHeight,
    atTop: viewport.scrollTop <= SCROLL_EDGE_TOLERANCE_PX,
    atBottom: scrollBottom >= viewport.scrollHeight - SCROLL_EDGE_TOLERANCE_PX,
    atLeft: viewport.scrollLeft <= SCROLL_EDGE_TOLERANCE_PX,
    atRight: scrollRight >= viewport.scrollWidth - SCROLL_EDGE_TOLERANCE_PX,
  };
}

function snapshotFromScrollOffset(
  viewport: HTMLElement,
  previous: AppScrollSnapshot,
): AppScrollSnapshot {
  const scrollTop = viewport.scrollTop;
  const scrollLeft = viewport.scrollLeft;
  const scrollBottom = scrollTop + previous.clientHeight;
  const scrollRight = scrollLeft + previous.clientWidth;

  return {
    ...previous,
    scrollTop,
    scrollLeft,
    atTop: scrollTop <= SCROLL_EDGE_TOLERANCE_PX,
    atBottom: scrollBottom >= previous.scrollHeight - SCROLL_EDGE_TOLERANCE_PX,
    atLeft: scrollLeft <= SCROLL_EDGE_TOLERANCE_PX,
    atRight: scrollRight >= previous.scrollWidth - SCROLL_EDGE_TOLERANCE_PX,
  };
}

export function createAppScrollAreaController(): AppScrollAreaApi {
  const [viewport, setViewportSignal] = createSignal<HTMLElement | null>(null);
  const [snapshot, setSnapshot] = createSignal<AppScrollSnapshot>(INITIAL_SCROLL_SNAPSHOT);
  const listeners = new Set<AppScrollListener>();

  const publish = (nextSnapshot: AppScrollSnapshot, event: Event | null) => {
    setSnapshot(nextSnapshot);
    for (const listener of listeners) {
      listener(nextSnapshot, event);
    }
    return nextSnapshot;
  };

  const measure = () => publish(snapshotFromViewport(viewport()), null);

  const setViewport = (el: HTMLElement | null) => {
    setViewportSignal(el);
    publish(snapshotFromViewport(el), null);
  };

  const handleViewportScroll: JSX.EventHandler<HTMLElement, Event> = (event) => {
    const currentViewport = event.currentTarget;
    if (viewport() !== currentViewport) {
      setViewportSignal(currentViewport);
    }
    publish(snapshotFromScrollOffset(currentViewport, snapshot()), event);
  };

  return {
    viewport,
    snapshot,
    setViewport,
    handleViewportScroll,
    measure,
    scrollTo: (options) => {
      viewport()?.scrollTo(options);
      measure();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function AppScrollAreaProvider(props: ParentProps<{ value: AppScrollAreaApi }>) {
  return (
    <AppScrollAreaContext.Provider value={props.value}>
      {props.children}
    </AppScrollAreaContext.Provider>
  );
}

export function useAppScrollArea(): AppScrollAreaApi {
  const context = useContext(AppScrollAreaContext);

  if (!context) {
    throw new Error('App scroll area is only available under the root route');
  }

  return context;
}

export function createAppScrollListener(listener: AppScrollListener): () => void {
  const appScroll = useAppScrollArea();
  const unsubscribe = appScroll.subscribe(listener);
  onCleanup(unsubscribe);
  return unsubscribe;
}
