import type {
  VideoItemDetail,
  VideoLibraryPlayMode,
  VideoLibraryPlayRequest,
  VideoUserDataUpdateRequest,
} from '@bindings';
import { DetailHero } from '@components/library/DetailHero';
import { LibraryPlaybackChooser } from '@components/library/LibraryPlaybackChooser';
import type {
  LibraryPlaybackSelection,
  PendingLibraryPlayback,
} from '@components/library/LibraryPlaybackChooser';
import {
  LibraryStatusPanel,
  UserDataControls,
  detailSubtitleElement,
  formatRuntime,
} from '@components/library/shared';
import { Button, StatusBadge } from '@components/ui';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { Exit } from 'effect';
import { Film, Play, RotateCcw, Tv } from 'lucide-solid';
import { For, Show, Suspense, createMemo, createSignal } from 'solid-js';
import { commandFailureMessage } from '~effects/commands';
import { fetchConnectionState } from '~effects/connection';
import {
  fetchVideoItemDetail,
  startLibraryPlayback,
  updateLibraryUserData,
} from '~effects/library';
import {
  isLibrarySessionKeyConnected,
  librarySessionKeyFromConnectionExit,
  queryKeys,
  runExit,
} from '~effects/query';

export const Route = createFileRoute('/_authenticated/library/items/$itemId')({
  component: LibraryItemDetailRoute,
});

function LibraryItemDetailRoute() {
  const params = Route.useParams();
  const queryClient = useQueryClient();
  const connectionQuery = createQuery(() => ({
    queryKey: queryKeys.connectionState,
    queryFn: () => runExit(fetchConnectionState()),
    staleTime: Infinity,
  }));
  const sessionKey = createMemo(() => librarySessionKeyFromConnectionExit(connectionQuery.data));
  const detailQuery = createQuery(() => ({
    queryKey: queryKeys.libraryItemDetail(sessionKey(), params().itemId),
    enabled: isLibrarySessionKeyConnected(sessionKey()),
    queryFn: () => runExit(fetchVideoItemDetail(params().itemId)),
  }));
  const playbackMutation = createMutation(() => ({
    mutationFn: (request: VideoLibraryPlayRequest) => runExit(startLibraryPlayback(request)),
  }));
  const userDataMutation = createMutation(() => ({
    mutationFn: (request: VideoUserDataUpdateRequest) => runExit(updateLibraryUserData(request)),
  }));
  const [confirmBusy, setConfirmBusy] = createSignal(false);
  const [pendingPlayback, setPendingPlayback] = createSignal<PendingLibraryPlayback | null>(null);
  const [playError, setPlayError] = createSignal<string | null>(null);

  const detail = () =>
    detailQuery.data && Exit.isSuccess(detailQuery.data) ? detailQuery.data.value : null;
  const statusTitle = () => {
    const current = detailQuery.data;
    if (current && !Exit.isSuccess(current)) {
      return 'Could not load item detail';
    }
    return 'Loading item detail';
  };
  const statusDescription = () => {
    const current = detailQuery.data;
    if (current && !Exit.isSuccess(current)) {
      return commandFailureMessage(current.cause, 'Could not load item detail');
    }
    return 'JellyPilot is loading Movie or Episode detail data from Jellyfin.';
  };
  const openPlaybackChooser = (item: VideoItemDetail, mode: VideoLibraryPlayMode) => {
    if (confirmBusy()) {
      return;
    }

    setPlayError(null);
    setPendingPlayback({
      detail: item,
      mode,
      startPositionSeconds: mode === 'resume' ? item.resumePositionSeconds : 0,
    });
  };
  const confirmPlayback = async (selection: LibraryPlaybackSelection) => {
    const pending = pendingPlayback();
    if (!pending || confirmBusy()) {
      return;
    }

    setConfirmBusy(true);
    setPlayError(null);
    const result = await playbackMutation.mutateAsync({
      audioStreamIndex: selection.audioStreamIndex,
      itemId: pending.detail.id,
      mode: pending.mode,
      startPositionSeconds: pending.startPositionSeconds,
      subtitleStreamIndex: selection.subtitleStreamIndex,
    });
    const message = Exit.match(result, {
      onFailure: (cause) => commandFailureMessage(cause, 'Could not start playback'),
      onSuccess: () => null,
    });
    setPlayError(message);
    setConfirmBusy(false);
    if (!message) {
      setPendingPlayback(null);
    }
  };

  return (
    <div class="space-y-6">
      <Suspense fallback={<ItemDetailSkeleton />}>
        <Show
          when={detail()}
          fallback={<LibraryStatusPanel title={statusTitle()} description={statusDescription()} />}
        >
          {(item) => {
            const isEpisode = () => item().itemType === 'Episode';
            const resumeProgress = () =>
              item().canResume ? (item().playedPercentage ?? 0) / 100 : null;

            return (
              <>
                <DetailHero
                  title={item().name}
                  subtitle={detailSubtitleElement(item())}
                  backdropUrl={item().backdropUrl ?? null}
                  artworkUrl={item().artworkUrl ?? null}
                  artworkAspect={isEpisode() ? 'landscape' : 'poster'}
                  typeLabel={item().itemType}
                  typeIcon={isEpisode() ? <Tv class="h-6 w-6" /> : <Film class="h-6 w-6" />}
                  badges={
                    <>
                      <StatusBadge variant={item().played ? 'success' : 'neutral'}>
                        {item().played ? 'Played' : 'Unplayed'}
                      </StatusBadge>
                      <StatusBadge variant={item().favorite ? 'success' : 'neutral'}>
                        {item().favorite ? 'Favorite' : 'Not favorite'}
                      </StatusBadge>
                      <Show when={formatRuntime(item().runtimeSeconds)}>
                        {(runtime) => <StatusBadge variant="neutral">{runtime()}</StatusBadge>}
                      </Show>
                    </>
                  }
                  actions={
                    <>
                      <Show
                        when={item().canResume}
                        fallback={
                          <Button
                            type="button"
                            variant="primary"
                            class="rounded-full"
                            disabled={!item().canPlay || confirmBusy()}
                            onClick={() => openPlaybackChooser(item(), 'start')}
                            leadingIcon={<Play class="h-4 w-4 fill-current" />}
                          >
                            Play
                          </Button>
                        }
                      >
                        <Button
                          type="button"
                          variant="primary"
                          class="rounded-full"
                          disabled={!item().canPlay || confirmBusy()}
                          onClick={() => openPlaybackChooser(item(), 'resume')}
                          leadingIcon={<Play class="h-4 w-4 fill-current" />}
                        >
                          Resume
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          class="rounded-full"
                          disabled={!item().canPlay || confirmBusy()}
                          onClick={() => openPlaybackChooser(item(), 'start')}
                          leadingIcon={<RotateCcw class="h-4 w-4" />}
                        >
                          Play from beginning
                        </Button>
                      </Show>
                      <UserDataControls
                        itemId={item().id}
                        played={item().played}
                        favorite={item().favorite}
                        subject={item().itemType.toLowerCase()}
                        onUpdate={(request) => userDataMutation.mutateAsync(request)}
                        onSuccess={() => {
                          const itemType = item().itemType;
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.libraryItemDetail(sessionKey(), params().itemId),
                          });
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.libraryMediaDetail(
                              sessionKey(),
                              itemType,
                              params().itemId,
                            ),
                          });
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.libraryHome(sessionKey()),
                          });
                          queryClient.invalidateQueries({
                            queryKey: queryKeys.libraryBrowseRoot(sessionKey()),
                          });
                        }}
                      />
                    </>
                  }
                  resumeProgress={resumeProgress()}
                />

                <div class="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-6 lg:px-10 xl:px-12">
                  <Show when={item().overview}>
                    {(overview) => (
                      <p class="text-on-surface-variant max-w-[1100px] text-[14px] leading-[22px] text-pretty lg:text-[15px] lg:leading-[24px]">
                        {overview()}
                      </p>
                    )}
                  </Show>
                  <Show when={item().genres.length > 0}>
                    <div class="flex flex-wrap gap-2">
                      <For each={item().genres}>
                        {(genre) => (
                          <span class="border-outline-variant text-on-surface-variant/90 rounded-full border px-3 py-1 text-[11px] leading-[16px] font-bold tracking-[0.08em] uppercase">
                            {genre}
                          </span>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </>
            );
          }}
        </Show>
      </Suspense>
      <Show when={pendingPlayback()}>
        {(pending) => (
          <LibraryPlaybackChooser
            pending={pending()}
            busy={confirmBusy()}
            onCancel={() => setPendingPlayback(null)}
            onConfirm={(selection) => void confirmPlayback(selection)}
          />
        )}
      </Show>
      <Show when={playError()}>
        {(message) => <p class="text-error px-6 text-[12px] leading-[16px]">{message()}</p>}
      </Show>
    </div>
  );
}

function ItemDetailSkeleton() {
  return (
    <article class="space-y-6" aria-hidden="true">
      <div class="bg-surface-container-lowest/60 h-[clamp(280px,44vh,560px)] animate-pulse" />
      <div class="mx-auto w-full max-w-[1400px] space-y-4 px-6 py-2 lg:px-10 xl:px-12">
        <div class="bg-surface-container-high/60 h-4 w-full max-w-[1100px] animate-pulse rounded" />
        <div class="bg-surface-container-high/60 h-4 w-10/12 max-w-[900px] animate-pulse rounded" />
        <div class="flex flex-wrap gap-2">
          <For each={[0, 1, 2]}>
            {() => <div class="bg-surface-container-high/70 h-7 w-24 animate-pulse rounded-full" />}
          </For>
        </div>
      </div>
    </article>
  );
}
