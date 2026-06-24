import type {
  VideoLibraryItem,
  VideoLibraryPlayRequest,
  VideoSeason,
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
  formatRuntime,
  seasonLabel,
  showSubtitle,
} from '@components/library/shared';
import { Button, Card, JellyPilotSelect, StatusBadge } from '@components/ui';
import type { JellyPilotSelectItem } from '@components/ui';
import { createMutation, createQuery, useQueryClient } from '@tanstack/solid-query';
import { createFileRoute } from '@tanstack/solid-router';
import { Exit, Option } from 'effect';
import { Film, Play, RefreshCw, Tv } from 'lucide-solid';
import { For, Show, Suspense, createMemo, createSignal } from 'solid-js';
import { commandFailureMessage } from '~effects/commands';
import { fetchConnectionState } from '~effects/connection';
import {
  fetchSeasonEpisodes,
  fetchVideoItemDetail,
  fetchVideoShowDetail,
  initialSeasonForShow,
  startLibraryPlayback,
  updateLibraryUserData,
} from '~effects/library';
import type { LibraryExit, SeasonEpisodesState } from '~effects/library';
import {
  isLibrarySessionKeyConnected,
  librarySessionKeyFromConnectionExit,
  queryKeys,
  runExit,
} from '~effects/query';
import { imageSource } from '~utils/imageSource';

export const Route = createFileRoute('/_authenticated/library/shows/$seriesId')({
  component: LibraryShowDetailRoute,
});

function LibraryShowDetailRoute() {
  const params = Route.useParams();
  const queryClient = useQueryClient();
  const connectionQuery = createQuery(() => ({
    queryKey: queryKeys.connectionState,
    queryFn: () => runExit(fetchConnectionState()),
    staleTime: Infinity,
  }));
  const sessionKey = createMemo(() => librarySessionKeyFromConnectionExit(connectionQuery.data));
  const showQuery = createQuery(() => ({
    queryKey: queryKeys.libraryShowDetail(sessionKey(), params().seriesId),
    enabled: isLibrarySessionKeyConnected(sessionKey()),
    queryFn: () => runExit(fetchVideoShowDetail(params().seriesId)),
  }));
  const [selectedSeason, setSelectedSeason] = createSignal<VideoSeason | null>(null);
  const playbackMutation = createMutation(() => ({
    mutationFn: (request: VideoLibraryPlayRequest) => runExit(startLibraryPlayback(request)),
  }));
  const userDataMutation = createMutation(() => ({
    mutationFn: (request: VideoUserDataUpdateRequest) => runExit(updateLibraryUserData(request)),
  }));
  const [playBusy, setPlayBusy] = createSignal(false);
  const [episodePlayBusy, setEpisodePlayBusy] = createSignal<string | null>(null);
  const [confirmBusy, setConfirmBusy] = createSignal(false);
  const [pendingPlayback, setPendingPlayback] = createSignal<PendingLibraryPlayback | null>(null);
  const [playError, setPlayError] = createSignal<string | null>(null);

  const detail = () =>
    showQuery.data && Exit.isSuccess(showQuery.data) ? showQuery.data.value : null;
  const activeSeason = () => {
    const selected = selectedSeason();
    if (selected) {
      return selected;
    }

    return Option.fromNullishOr(detail()).pipe(
      Option.flatMap((show) => initialSeasonForShow(show)),
      Option.getOrNull,
    );
  };
  const seasonEpisodesQuery = createQuery<LibraryExit<SeasonEpisodesState> | null>(() => {
    const season = activeSeason();
    return {
      queryKey: queryKeys.librarySeasonEpisodes(
        sessionKey(),
        params().seriesId,
        season?.id ?? 'none',
      ),
      enabled: season !== null && isLibrarySessionKeyConnected(sessionKey()),
      queryFn: () => {
        if (!season) {
          return Promise.resolve(null);
        }
        return runExit(
          fetchSeasonEpisodes({
            seasonId: season.id,
            seasonNumber: season.seasonNumber,
            seriesId: params().seriesId,
          }),
        );
      },
    };
  });
  const currentEpisodes = () => seasonEpisodesQuery.data;
  const seasonEpisodes = () => {
    const current = currentEpisodes();
    return current && Exit.isSuccess(current) ? current.value.page.episodes : [];
  };
  const hasSeasonEpisodes = () => seasonEpisodes().length > 0;
  const episodesLoading = () => seasonEpisodesQuery.isPending || seasonEpisodesQuery.isFetching;
  const loadEpisodes = (season: VideoSeason) => {
    setSelectedSeason(season);
  };
  const openEpisodePlaybackChooser = async (itemId: string) => {
    const result = await queryClient.fetchQuery({
      queryKey: queryKeys.libraryItemDetail(sessionKey(), itemId),
      queryFn: () => runExit(fetchVideoItemDetail(itemId)),
    });
    Exit.match(result, {
      onFailure: (cause) => setPlayError(commandFailureMessage(cause, 'Could not load episode')),
      onSuccess: (episodeDetail) => {
        const mode = episodeDetail.canResume ? 'resume' : 'start';
        setPendingPlayback({
          detail: episodeDetail,
          mode,
          startPositionSeconds: mode === 'resume' ? episodeDetail.resumePositionSeconds : 0,
        });
      },
    });
  };
  const playShow = async () => {
    const show = detail();
    if (!show?.nextEpisode || playBusy() || confirmBusy()) {
      return;
    }

    setPlayBusy(true);
    setPlayError(null);
    await openEpisodePlaybackChooser(show.nextEpisode.id);
    setPlayBusy(false);
  };
  const playEpisode = async (episode: VideoLibraryItem) => {
    if (episodePlayBusy() || confirmBusy()) {
      return;
    }

    setEpisodePlayBusy(episode.id);
    setPlayError(null);
    await openEpisodePlaybackChooser(episode.id);
    setEpisodePlayBusy(null);
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
  const statusTitle = () => {
    const current = showQuery.data;
    if (current && !Exit.isSuccess(current)) {
      return 'Could not load show detail';
    }
    return 'Loading show detail';
  };
  const statusDescription = () => {
    const current = showQuery.data;
    if (current && !Exit.isSuccess(current)) {
      return commandFailureMessage(current.cause, 'Could not load show detail');
    }
    return 'JellyPilot is loading Show detail, seasons, and Jellyfin next-up data.';
  };
  const episodesStatusTitle = () => {
    const current = currentEpisodes();
    if (episodesLoading()) {
      return 'Loading season episodes';
    }
    if (current && Exit.isSuccess(current) && current.value.page.episodes.length === 0) {
      return 'Season has no episodes';
    }
    if (current && !Exit.isSuccess(current)) {
      return 'Could not load season episodes';
    }
    return 'Choose a season';
  };
  const episodesStatusDescription = () => {
    const current = currentEpisodes();
    if (episodesLoading()) {
      return 'JellyPilot is loading exact Episode cards for the selected Season.';
    }
    if (current && Exit.isSuccess(current) && current.value.page.episodes.length === 0) {
      return 'Jellyfin returned no Episodes for the selected Season.';
    }
    if (current && !Exit.isSuccess(current)) {
      return commandFailureMessage(current.cause, 'Could not load season episodes');
    }
    return 'Season buttons keep manual episode selection available alongside Jellyfin next-up resolution.';
  };
  const episodeLabel = (ep: VideoLibraryItem) => {
    if (ep.seasonNumber != null && ep.episodeNumber != null) {
      return `S${ep.seasonNumber.toString().padStart(2, '0')}E${ep.episodeNumber.toString().padStart(2, '0')}`;
    }
    return 'Episode';
  };
  const playShowLabel = () => {
    const show = detail();
    const nextEpisode = show?.nextEpisode;
    if (!nextEpisode) {
      return 'Play';
    }
    const prefix =
      nextEpisode.resumePositionSeconds != null &&
      nextEpisode.resumePositionSeconds > 0 &&
      !nextEpisode.played
        ? 'Continue'
        : 'Play';
    return `${prefix} ${episodeLabel(nextEpisode)}`;
  };

  return (
    <div class="space-y-6">
      <Suspense fallback={<ShowDetailSkeleton />}>
        <Show
          when={detail()}
          fallback={<LibraryStatusPanel title={statusTitle()} description={statusDescription()} />}
        >
          {(show) => (
            <>
              <DetailHero
                title={show().name}
                subtitle={showSubtitle(show())}
                backdropUrl={show().backdropUrl ?? null}
                artworkUrl={show().artworkUrl ?? null}
                artworkAspect="poster"
                typeLabel="Series"
                typeIcon={<Tv class="h-6 w-6" />}
                badges={
                  <>
                    <StatusBadge variant={show().played ? 'success' : 'neutral'}>
                      {show().played ? 'Played' : 'Unplayed'}
                    </StatusBadge>
                    <StatusBadge variant={show().favorite ? 'success' : 'neutral'}>
                      {show().favorite ? 'Favorite' : 'Not favorite'}
                    </StatusBadge>
                  </>
                }
                actions={
                  <>
                    <Button
                      type="button"
                      variant="primary"
                      class="rounded-full"
                      disabled={!show().nextEpisode || playBusy() || confirmBusy()}
                      onClick={() => void playShow()}
                      leadingIcon={
                        <Show when={playBusy()} fallback={<Play class="h-4 w-4 fill-current" />}>
                          <RefreshCw class="h-4 w-4 animate-spin" />
                        </Show>
                      }
                    >
                      {playBusy() ? 'Loading...' : playShowLabel()}
                    </Button>
                    <UserDataControls
                      itemId={show().id}
                      played={show().played}
                      favorite={show().favorite}
                      subject="show"
                      onUpdate={(request) => userDataMutation.mutateAsync(request)}
                      onSuccess={() => {
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.libraryShowDetail(sessionKey(), params().seriesId),
                        });
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.libraryMediaDetail(
                            sessionKey(),
                            'Series',
                            params().seriesId,
                          ),
                        });
                        queryClient.invalidateQueries({
                          queryKey: queryKeys.librarySeasonEpisodesRoot(
                            sessionKey(),
                            params().seriesId,
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
              />

              <div class="mx-auto w-full max-w-[1400px] space-y-6 px-6 py-6 lg:px-10 xl:px-12">
                <Show when={show().overview}>
                  {(overview) => (
                    <p class="text-on-surface-variant max-w-[1100px] text-[14px] leading-[22px] text-pretty lg:text-[15px] lg:leading-[24px]">
                      {overview()}
                    </p>
                  )}
                </Show>

                <Show when={show().genres.length > 0}>
                  <div class="flex flex-wrap gap-2">
                    <For each={show().genres}>
                      {(genre) => (
                        <span class="border-outline-variant text-on-surface-variant/90 rounded-full border px-3 py-1 text-[11px] leading-[16px] font-bold tracking-[0.08em] uppercase">
                          {genre}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>

                <section class="space-y-4" aria-labelledby="show-seasons-title">
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2
                        id="show-seasons-title"
                        class="text-on-surface text-[22px] leading-[28px] font-bold"
                      >
                        Episodes
                      </h2>
                    </div>
                    <p class="text-on-surface-variant/80 text-[12px] leading-[16px] tabular-nums">
                      {show().seasons.length} seasons available
                    </p>
                  </div>

                  <Show
                    when={show().seasons.length > 0}
                    fallback={
                      <LibraryStatusPanel
                        title="No seasons available"
                        description="Jellyfin returned no seasons for this show."
                      />
                    }
                  >
                    <SeasonSelector
                      seasons={show().seasons}
                      activeSeason={activeSeason()}
                      disabled={episodesLoading()}
                      onSelect={loadEpisodes}
                    />

                    <Suspense fallback={<SeasonEpisodesSkeleton />}>
                      <Show
                        when={hasSeasonEpisodes()}
                        fallback={
                          episodesLoading() ? (
                            <SeasonEpisodesSkeleton />
                          ) : (
                            <LibraryStatusPanel
                              title={episodesStatusTitle()}
                              description={episodesStatusDescription()}
                            />
                          )
                        }
                      >
                        <section class="space-y-3" aria-labelledby="season-episodes-title">
                          <h3
                            id="season-episodes-title"
                            class="text-on-surface text-[16px] leading-[24px] font-semibold"
                          >
                            {activeSeason() ? `${activeSeason()?.name} Episodes` : 'Episodes'}
                          </h3>
                          <div class="flex animate-[fadeIn_0.3s_cubic-bezier(0.16,1,0.3,1)_forwards] flex-col gap-3">
                            <For each={seasonEpisodes()}>
                              {(episode) => (
                                <EpisodeRow
                                  episode={episode}
                                  label={episodeLabel(episode)}
                                  busy={episodePlayBusy() === episode.id}
                                  disabled={episodePlayBusy() !== null || confirmBusy()}
                                  onPlay={() => void playEpisode(episode)}
                                />
                              )}
                            </For>
                          </div>
                        </section>
                      </Show>
                    </Suspense>
                  </Show>
                </section>
              </div>
            </>
          )}
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

function SeasonSelector(props: {
  seasons: VideoSeason[];
  activeSeason: VideoSeason | null;
  disabled: boolean;
  onSelect: (season: VideoSeason) => void;
}) {
  const seasonItems = createMemo<JellyPilotSelectItem[]>(() =>
    props.seasons.map((season) => ({
      label: seasonLabel(season),
      value: season.id,
    })),
  );
  const selectSeason = (seasonId: string) => {
    const season = props.seasons.find((item) => item.id === seasonId);
    if (season) {
      props.onSelect(season);
    }
  };

  return (
    <Show
      when={props.seasons.length > 6}
      fallback={
        <ul
          class="border-outline-variant bg-surface-container-low/70 flex gap-2 overflow-x-auto rounded-2xl border p-2"
          aria-label="Show seasons"
        >
          <For each={props.seasons}>
            {(season) => (
              <li class="shrink-0">
                <Button
                  type="button"
                  variant="outlined"
                  class={`rounded-full ${
                    props.activeSeason?.id === season.id
                      ? 'border-secondary bg-secondary-container/45 text-on-secondary-container'
                      : ''
                  }`}
                  aria-pressed={props.activeSeason?.id === season.id}
                  disabled={props.disabled}
                  onClick={() => props.onSelect(season)}
                >
                  {seasonLabel(season)}
                </Button>
              </li>
            )}
          </For>
        </ul>
      }
    >
      <div class="max-w-xs">
        <JellyPilotSelect
          label="Season"
          items={seasonItems()}
          disabled={props.disabled}
          value={props.activeSeason?.id ?? ''}
          size="compact"
          onValueChange={selectSeason}
        />
      </div>
    </Show>
  );
}

function EpisodeRow(props: {
  episode: VideoLibraryItem;
  label: string;
  busy: boolean;
  disabled: boolean;
  onPlay: () => void;
}) {
  const hasResume = () =>
    props.episode.resumePositionSeconds != null &&
    props.episode.resumePositionSeconds > 0 &&
    !props.episode.played;

  return (
    <Card
      variant="filled"
      surfaceTint={false}
      class="grid grid-cols-1 items-center gap-4 !p-3 sm:grid-cols-[160px_1fr_auto] lg:grid-cols-[220px_1fr_auto]"
    >
      <div class="bg-surface-container-lowest/60 hidden aspect-video w-[160px] overflow-hidden rounded-lg sm:block lg:w-[220px]">
        <Show
          when={props.episode.artworkUrl}
          fallback={
            <div class="text-on-surface-variant flex h-full items-center justify-center text-[11px] leading-[16px] font-bold tracking-[0.08em] uppercase">
              <Film class="h-5 w-5" />
            </div>
          }
        >
          {(artworkUrl) => (
            <img
              src={imageSource(artworkUrl())}
              alt={`${props.episode.name} artwork`}
              class="h-full w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
              loading="lazy"
            />
          )}
        </Show>
      </div>

      <div class="min-w-0 space-y-1.5">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-secondary text-[11px] leading-[16px] font-bold tracking-[0.08em] uppercase">
            {props.label}
          </span>
          <Show when={props.episode.played}>
            <StatusBadge variant="success">Played</StatusBadge>
          </Show>
          <Show when={props.episode.favorite}>
            <StatusBadge variant="success">Favorite</StatusBadge>
          </Show>
          <Show when={formatRuntime(props.episode.runtimeSeconds)}>
            {(runtime) => (
              <span class="text-on-surface-variant/70 text-[12px] leading-[16px]">{runtime()}</span>
            )}
          </Show>
          <Show when={hasResume()}>
            <span class="text-on-surface-variant/70">·</span>
            <span class="text-secondary text-[12px] leading-[16px] font-semibold tabular-nums">
              {Math.round(props.episode.playedPercentage ?? 0)}% watched
            </span>
          </Show>
        </div>
        <a
          href={`/library/items/${props.episode.id}`}
          class="text-on-surface block truncate text-[16px] leading-[24px] font-semibold hover:underline"
        >
          {props.episode.name}
        </a>
      </div>

      <div class="flex shrink-0">
        <Button
          type="button"
          variant="primary"
          class="rounded-full px-5 py-2 text-[14px] leading-[20px] font-semibold tracking-wide uppercase"
          disabled={props.disabled}
          onClick={props.onPlay}
          leadingIcon={
            <Show when={props.busy} fallback={<Play class="h-4 w-4 fill-current" />}>
              <RefreshCw class="h-4 w-4 animate-spin" />
            </Show>
          }
        >
          {props.busy ? 'Loading...' : hasResume() ? 'Resume' : 'Play'}
        </Button>
      </div>
    </Card>
  );
}

function ShowDetailSkeleton() {
  return (
    <article class="space-y-6" aria-hidden="true">
      <div class="bg-surface-container-lowest/60 h-[clamp(280px,44vh,560px)] animate-pulse" />
      <div class="mx-auto w-full max-w-[1400px] space-y-5 px-6 py-2 lg:px-10 xl:px-12">
        <div class="space-y-2">
          <div class="bg-surface-container-high/60 h-4 w-full max-w-[1100px] animate-pulse rounded" />
          <div class="bg-surface-container-high/60 h-4 w-10/12 max-w-[900px] animate-pulse rounded" />
        </div>
        <div class="flex flex-wrap gap-2">
          <For each={[0, 1, 2]}>
            {() => <div class="bg-surface-container-high/70 h-7 w-24 animate-pulse rounded-full" />}
          </For>
        </div>
        <div class="bg-surface-container-high/80 h-7 w-32 animate-pulse rounded-md" />
        <div class="border-outline-variant bg-surface-container-low/70 flex gap-2 overflow-x-auto rounded-2xl border p-2">
          <For each={[0, 1, 2]}>
            {() => (
              <div class="bg-surface-container-high/70 h-10 w-24 shrink-0 animate-pulse rounded-full" />
            )}
          </For>
        </div>
        <SeasonEpisodesSkeleton />
      </div>
    </article>
  );
}

function SeasonEpisodesSkeleton() {
  return (
    <section class="space-y-3" aria-hidden="true">
      <div class="bg-surface-container-high/70 h-6 w-44 animate-pulse rounded-md" />
      <div class="flex flex-col gap-3">
        <For each={[0, 1, 2]}>
          {() => (
            <Card
              variant="filled"
              surfaceTint={false}
              class="grid grid-cols-1 items-center gap-4 !p-3 sm:grid-cols-[160px_1fr_auto] lg:grid-cols-[220px_1fr_auto]"
            >
              <div class="bg-surface-container-lowest/60 hidden aspect-video w-[160px] animate-pulse rounded-lg sm:block lg:w-[220px]" />
              <div class="min-w-0 space-y-2">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="bg-surface-container-high/70 h-3 w-14 animate-pulse rounded" />
                  <div class="bg-surface-container-high/60 h-6 w-20 animate-pulse rounded-full" />
                </div>
                <div class="bg-surface-container-high/80 h-5 w-4/5 animate-pulse rounded" />
              </div>
              <div class="bg-primary-container/40 h-10 w-24 animate-pulse rounded-full" />
            </Card>
          )}
        </For>
      </div>
    </section>
  );
}
