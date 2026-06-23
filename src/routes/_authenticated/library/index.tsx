import { VideoHomeRow } from '@components/library/shared';
import { Card } from '@components/ui';
import { createQuery } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { Exit } from 'effect';
import { For, Show, createMemo } from 'solid-js';
import { fetchConnectionState } from '~effects/connection';
import { fetchLibraryHome } from '~effects/library';
import {
  isLibrarySessionKeyConnected,
  librarySessionKeyFromConnectionExit,
  queryKeys,
  runExit,
} from '~effects/query';

const homeSkeletonRows = [
  { id: 'continue-watching-skeleton', aspectClass: 'aspect-video' },
  { id: 'next-up-skeleton', aspectClass: 'aspect-video' },
  { id: 'latest-movies-skeleton', aspectClass: 'aspect-[2/3]' },
  { id: 'latest-episodes-skeleton', aspectClass: 'aspect-video' },
] as const;

export const Route = createFileRoute('/_authenticated/library/')({
  component: LibraryLanding,
});

function LibraryLanding() {
  const connectionQuery = createQuery(() => ({
    queryKey: queryKeys.connectionState,
    queryFn: () => runExit(fetchConnectionState()),
    staleTime: Infinity,
  }));
  const sessionKey = createMemo(() => librarySessionKeyFromConnectionExit(connectionQuery.data));
  const homeQuery = createQuery(() => ({
    queryKey: queryKeys.libraryHome(sessionKey()),
    enabled: isLibrarySessionKeyConnected(sessionKey()),
    queryFn: () => runExit(fetchLibraryHome()),
  }));
  const home = () =>
    homeQuery.data && Exit.isSuccess(homeQuery.data) ? homeQuery.data.value : null;

  return (
    <div class="space-y-6">
      <Show when={!homeQuery.isPending} fallback={<VideoHomeSkeleton />}>
        <Show when={home()}>
          {(value) => (
            <div class="space-y-6">
              <VideoHomeRow
                id="continue-watching"
                title="Continue Watching"
                kind="continueWatching"
                items={value().continueWatching}
              />
              <VideoHomeRow id="next-up" title="Next Up" kind="nextUp" items={value().nextUp} />
              <VideoHomeRow
                id="latest-movies"
                title="Latest Movies"
                kind="latestMovies"
                items={value().latestMovies}
              />
              <VideoHomeRow
                id="latest-episodes"
                title="Latest Episodes"
                kind="latestEpisodes"
                items={value().latestEpisodes}
              />
            </div>
          )}
        </Show>
      </Show>
    </div>
  );
}

function VideoHomeSkeleton() {
  return (
    <div class="space-y-6" aria-hidden="true">
      <For each={homeSkeletonRows}>
        {(row) => (
          <section class="space-y-3">
            <div class="bg-surface-container-high/70 h-6 w-44 animate-pulse rounded-md" />
            <div class="grid gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
              <For each={[0, 1, 2, 3]}>
                {() => (
                  <Card variant="filled" surfaceTint={false} class="overflow-hidden !p-0">
                    <div
                      class={`${row.aspectClass} border-outline-variant bg-surface-container-lowest/60 animate-pulse border-b`}
                    />
                    <div class="space-y-2 px-4 pt-2 pb-3">
                      <div class="bg-surface-container-high/80 h-4 w-4/5 animate-pulse rounded" />
                      <div class="bg-surface-container-high/60 h-3 w-3/5 animate-pulse rounded" />
                    </div>
                  </Card>
                )}
              </For>
            </div>
          </section>
        )}
      </For>
    </div>
  );
}
