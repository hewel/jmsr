import { load } from '@tauri-apps/plugin-store';
import type { Accessor, Setter } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';

import type { VideoLibraryPlayedFilter, VideoLibrarySort } from '../bindings';

export type LibrarySortDirection = 'asc' | 'desc';

const PREFERENCES_STORE_FILE = 'preferences.json';
const LIBRARY_FILTERS_STORE_KEY = 'library_filters';
const LEGACY_STORAGE_KEY = 'jellypilot_library_filters';
const DEFAULT_SORT: VideoLibrarySort = 'title';
const DEFAULT_PLAYED_FILTER: VideoLibraryPlayedFilter = 'all';
const DEFAULT_FAVORITES_ONLY = false;
const DEFAULT_SORT_DIRECTION: LibrarySortDirection = 'asc';

interface LibraryFilterSnapshot {
  sort: VideoLibrarySort;
  playedFilter: VideoLibraryPlayedFilter;
  favoritesOnly: boolean;
  sortDirection: LibrarySortDirection;
}

const [ready, setReady] = createSignal(false);
const [sort, setSort] = createSignal<VideoLibrarySort>(DEFAULT_SORT);
const [playedFilter, setPlayedFilter] =
  createSignal<VideoLibraryPlayedFilter>(DEFAULT_PLAYED_FILTER);
const [favoritesOnly, setFavoritesOnly] = createSignal(DEFAULT_FAVORITES_ONLY);
const [sortDirection, setSortDirection] =
  createSignal<LibrarySortDirection>(DEFAULT_SORT_DIRECTION);
let writeQueue: Promise<void> | null = null;
let hydratedSnapshot: LibraryFilterSnapshot | null = null;

export interface SharedLibraryFilters {
  ready: Accessor<boolean>;
  sort: Accessor<VideoLibrarySort>;
  setSort: Setter<VideoLibrarySort>;
  playedFilter: Accessor<VideoLibraryPlayedFilter>;
  setPlayedFilter: Setter<VideoLibraryPlayedFilter>;
  favoritesOnly: Accessor<boolean>;
  setFavoritesOnly: Setter<boolean>;
  sortDirection: Accessor<LibrarySortDirection>;
  setSortDirection: Setter<LibrarySortDirection>;
}

function parseSort(value: string | undefined): VideoLibrarySort {
  switch (value) {
    case 'recentlyAdded':
    case 'releaseDate':
    case 'title':
      return value;
    default:
      return DEFAULT_SORT;
  }
}

function parsePlayedFilter(value: string | undefined): VideoLibraryPlayedFilter {
  switch (value) {
    case 'played':
    case 'unplayed':
    case 'all':
      return value;
    default:
      return DEFAULT_PLAYED_FILTER;
  }
}

function parseSortDirection(value: string | undefined): LibrarySortDirection {
  return value === 'desc' ? 'desc' : DEFAULT_SORT_DIRECTION;
}

function defaultSnapshot(): LibraryFilterSnapshot {
  return {
    sort: DEFAULT_SORT,
    playedFilter: DEFAULT_PLAYED_FILTER,
    favoritesOnly: DEFAULT_FAVORITES_ONLY,
    sortDirection: DEFAULT_SORT_DIRECTION,
  };
}

function snapshot(): LibraryFilterSnapshot {
  return {
    sort: sort(),
    playedFilter: playedFilter(),
    favoritesOnly: favoritesOnly(),
    sortDirection: sortDirection(),
  };
}

function snapshotsEqual(left: LibraryFilterSnapshot, right: LibraryFilterSnapshot) {
  return (
    left.sort === right.sort &&
    left.playedFilter === right.playedFilter &&
    left.favoritesOnly === right.favoritesOnly &&
    left.sortDirection === right.sortDirection
  );
}

function applySnapshot(filters: LibraryFilterSnapshot) {
  setSort(filters.sort);
  setPlayedFilter(filters.playedFilter);
  setFavoritesOnly(filters.favoritesOnly);
  setSortDirection(filters.sortDirection);
}

function parseStoreSnapshot(value: unknown): LibraryFilterSnapshot | null {
  if (value === null || typeof value !== 'object') {
    return null;
  }
  const obj = value as Record<string, unknown>;
  return {
    sort: parseSort(typeof obj.sort === 'string' ? obj.sort : undefined),
    playedFilter: parsePlayedFilter(
      typeof obj.playedFilter === 'string' ? obj.playedFilter : undefined,
    ),
    favoritesOnly: obj.favoritesOnly === true,
    sortDirection: parseSortDirection(
      typeof obj.sortDirection === 'string' ? obj.sortDirection : undefined,
    ),
  };
}

function readLegacySnapshot(): LibraryFilterSnapshot | null {
  try {
    const value = localStorage.getItem(LEGACY_STORAGE_KEY);
    const [storedSort, storedPlayedFilter, storedFavoritesOnly, storedSortDirection] =
      value?.split('|') ?? [];

    if (value === null) {
      return null;
    }

    return {
      sort: parseSort(storedSort),
      playedFilter: parsePlayedFilter(storedPlayedFilter),
      favoritesOnly: storedFavoritesOnly === '1',
      sortDirection: parseSortDirection(storedSortDirection),
    };
  } catch {
    return null;
  }
}

function removeLegacySnapshot() {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Store is now authoritative; failed cleanup should not break rendering.
  }
}

async function hydrateFilters() {
  try {
    await writeQueue;
    const store = await load(PREFERENCES_STORE_FILE, { defaults: {}, autoSave: false });
    const stored = parseStoreSnapshot(await store.get(LIBRARY_FILTERS_STORE_KEY));

    if (stored) {
      applySnapshot(stored);
      hydratedSnapshot = stored;
      return;
    }

    const legacy = readLegacySnapshot();
    if (!legacy) {
      const defaults = defaultSnapshot();
      applySnapshot(defaults);
      hydratedSnapshot = defaults;
      return;
    }

    applySnapshot(legacy);
    hydratedSnapshot = legacy;
    await store.set(LIBRARY_FILTERS_STORE_KEY, legacy);
    await store.save();
    removeLegacySnapshot();
  } catch {
    // Tauri Store can be unavailable in browser-only contexts; in-memory filters still work.
  }
}

function persistFilters(filters: LibraryFilterSnapshot) {
  const write = async () => {
    try {
      const store = await load(PREFERENCES_STORE_FILE, { defaults: {}, autoSave: false });
      await store.set(LIBRARY_FILTERS_STORE_KEY, filters);
      await store.save();
    } catch {
      // Persistence is best-effort; rendering keeps the current in-memory signals.
    }
  };

  writeQueue = (writeQueue ?? Promise.resolve()).then(write, write);
}

export function createSharedLibraryFilters(): SharedLibraryFilters {
  setReady(false);
  void hydrateFilters().finally(() => setReady(true));

  createEffect(() => {
    if (!ready()) {
      return;
    }
    const filters = snapshot();
    if (hydratedSnapshot && snapshotsEqual(filters, hydratedSnapshot)) {
      hydratedSnapshot = null;
      return;
    }
    persistFilters(filters);
  });

  return {
    ready,
    sort,
    setSort,
    playedFilter,
    setPlayedFilter,
    favoritesOnly,
    setFavoritesOnly,
    sortDirection,
    setSortDirection,
  };
}
