import {
  LibraryShortcutRow,
  LibraryStatusPanel,
  VideoHomeRow,
  VideoLibraryCard,
} from '@components/library/shared';
import { createFileRoute } from '@tanstack/solid-router';
import { Exit } from 'effect';
import { RefreshCw } from 'lucide-solid';
import { createResource, createSignal, For, Show } from 'solid-js';
import {
  fetchLibraryHome,
  fetchVideoSearchPage,
  type LibrarySearchState,
} from './-data';

export const Route = createFileRoute('/_authenticated/library/')({
  component: LibraryLanding,
});

function LibraryLanding() {
  const [home, { refetch }] = createResource(fetchLibraryHome);
  const loadedHome = () => {
    const current = home();
    if (!current) {
      return null;
    }
    return Exit.match(current, {
      onFailure: () => null,
      onSuccess: (v) => v,
    });
  };

  // Lifted search state
  const [query, setQuery] = createSignal('');
  const [submittedQuery, setSubmittedQuery] = createSignal('');
  const [state, setState] = createSignal<LibrarySearchState | null>(null);
  const [loading, setLoading] = createSignal(false);

  const loadSearchPage = async (
    nextQuery: string,
    startIndex: number,
    replace = false,
  ) => {
    if (loading()) return;
    setLoading(true);
    const result = await fetchVideoSearchPage(nextQuery, startIndex);
    setState((current) => {
      if (!replace && current?.kind === 'ready' && result.kind === 'ready') {
        return {
          kind: 'ready',
          page: result.page,
          items: [...current.items, ...result.items],
        };
      }
      return result;
    });
    setLoading(false);
  };

  const submitSearch = () => {
    const nextQuery = query().trim();
    if (!nextQuery) {
      clearSearch();
      return;
    }
    setSubmittedQuery(nextQuery);
    setState(null);
    void loadSearchPage(nextQuery, 0, true);
  };

  const clearSearch = () => {
    setQuery('');
    setSubmittedQuery('');
    setState(null);
  };

  const readyState = () => {
    const current = state();
    return current?.kind === 'ready' ? current : null;
  };

  const loadMoreStartIndex = () => {
    const current = readyState();
    return current ? current.page.startIndex + current.page.limit : 0;
  };

  const isSearchActive = () => state() !== null || loading();
  const renderHomeContent = () => {
    if (home.loading) return <LibraryStatusPanel title="Loading Video Home" />;
    return (
      <div class="space-y-6">
        <VideoHomeRow
          id="continue-watching"
          title="Continue Watching"
          items={loadedHome()?.continueWatching ?? []}
        />
        <VideoHomeRow
          id="next-up"
          title="Next Up"
          items={loadedHome()?.nextUp ?? []}
        />
        <VideoHomeRow
          id="latest-movies"
          title="Latest Movies"
          items={loadedHome()?.latestMovies ?? []}
        />
        <VideoHomeRow
          id="latest-episodes"
          title="Latest Episodes"
          items={loadedHome()?.latestEpisodes ?? []}
        />
      </div>
    );
  };

  const renderSearchContent = () => {
    return (
      <section class="space-y-4" aria-labelledby="library-search-results">
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="library-search-results" class="text-title-large">
            Search results
          </h2>
          <div class="flex items-center gap-3">
            <p class="text-body-small">
              {readyState()?.items.length ?? 0} of{' '}
              {readyState()?.page.totalRecordCount ?? 0} for "{submittedQuery()}
              "
            </p>
            <button
              type="button"
              class="btn-text min-h-0 py-1 px-3 text-[12px] font-bold"
              onClick={clearSearch}
            >
              Clear Search
            </button>
          </div>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 animate-fade-in">
          <For each={readyState()?.items ?? []}>
            {(item) => <VideoLibraryCard item={item} />}
          </For>
        </div>
        <Show when={readyState()?.page.hasMore}>
          <div class="flex justify-center pt-2">
            <button
              type="button"
              class="btn-secondary rounded-full"
              disabled={loading()}
              onClick={() =>
                void loadSearchPage(submittedQuery(), loadMoreStartIndex())
              }
            >
              <RefreshCw class="h-4 w-4" />
              <span>{loading() ? 'Loading more' : 'Load more results'}</span>
            </button>
          </div>
        </Show>
      </section>
    );
  };

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-label-small text-secondary">Library Browser</p>
          <h1 class="text-headline-large">Library</h1>
          <p class="mt-2 max-w-2xl text-body-large">
            Video Home will use live Jellyfin data for Continue Watching, Next
            Up, latest video rows, and library shortcuts.
          </p>
        </div>
        <button
          type="button"
          class="btn-outlined rounded-full"
          onClick={() => void refetch()}
          disabled={home.loading}
        >
          <RefreshCw class="h-4 w-4" />
          <span>Retry Library</span>
        </button>
      </div>

      <div class="console-grid">
        {/* Left Column: Media Rows OR Search Results */}
        <div class="space-y-6 min-w-0">
          {isSearchActive() ? renderSearchContent() : renderHomeContent()}
        </div>

        {/* Right Column (Sidebar): Search and Shortcuts */}
        <aside class="space-y-6">
          <LibrarySearchPanel
            query={query}
            setQuery={setQuery}
            loading={loading}
            onSubmit={submitSearch}
          />
          <Show when={!home.loading}>
            <LibraryShortcutRow
              shortcuts={loadedHome()?.libraryShortcuts ?? []}
              layout="list"
            />
          </Show>
        </aside>
      </div>
    </div>
  );
}

function LibrarySearchPanel(props: {
  query: () => string;
  setQuery: (val: string) => void;
  loading: () => boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      class="card-filled flex flex-col gap-3"
      aria-label="Library search"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <label class="min-w-0 flex-1 space-y-2">
        <span class="text-label-small">Search video library</span>
        <input
          class="input-filled w-full"
          value={props.query()}
          disabled={props.loading()}
          onInput={(event) => props.setQuery(event.currentTarget.value)}
          placeholder="Search movies, shows..."
        />
      </label>
      <button
        type="submit"
        class="btn-primary rounded-full w-full"
        disabled={props.loading()}
      >
        <span>{props.loading() ? 'Searching' : 'Search'}</span>
      </button>
    </form>
  );
}
