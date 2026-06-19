import type { VideoLibraryPlayMode, VideoPlaybackStreamOption } from '@bindings';
import {
  LibraryStatusPanel,
  UserDataControls,
  detailSubtitle,
  formatRuntime,
} from '@components/library/shared';
import { Button, JmsrSelect, StatusBadge } from '@components/ui';
import type { JmsrSelectItem } from '@components/ui';
import { createFileRoute } from '@tanstack/solid-router';
import { Exit } from 'effect';
import { Film, Library, Play, RefreshCw, RotateCcw } from 'lucide-solid';
import { For, Show, createEffect, createMemo, createResource, createSignal } from 'solid-js';
import { commandFailureMessage } from '~effects/commands';
import {
  fetchVideoItemDetail,
  startLibraryPlayback,
  updateLibraryUserData,
} from '~effects/library';

const AUDIO_AUTO = 'auto';
const SUBTITLE_AUTO = 'auto';
const SUBTITLE_OFF = 'off';

export const Route = createFileRoute('/_authenticated/library/items/$itemId')({
  component: LibraryItemDetailRoute,
});

function LibraryItemDetailRoute() {
  const params = Route.useParams();
  const [state, { refetch }] = createResource(() => fetchVideoItemDetail(params().itemId));
  const [playBusy, setPlayBusy] = createSignal<VideoLibraryPlayMode | null>(null);
  const [audioValue, setAudioValue] = createSignal(AUDIO_AUTO);
  const [subtitleValue, setSubtitleValue] = createSignal(SUBTITLE_AUTO);
  const [playError, setPlayError] = createSignal<string | null>(null);
  const detail = () => {
    const current = state();
    return current && Exit.isSuccess(current) ? current.value : null;
  };
  const audioItems = createMemo<JmsrSelectItem[]>(() => [
    { label: 'Auto (series preference)', value: AUDIO_AUTO },
    ...(detail()?.audioStreams ?? []).map((stream) => ({
      label: streamLabel(stream),
      value: String(stream.index),
    })),
  ]);
  const subtitleItems = createMemo<JmsrSelectItem[]>(() => [
    { label: 'Auto (preferred subtitles)', value: SUBTITLE_AUTO },
    { label: 'Off', value: SUBTITLE_OFF },
    ...(detail()?.subtitleStreams ?? []).map((stream) => ({
      label: streamLabel(stream),
      value: String(stream.index),
    })),
  ]);

  createEffect(() => {
    const itemId = detail()?.id;
    if (!itemId) {
      return;
    }

    setAudioValue(AUDIO_AUTO);
    setSubtitleValue(SUBTITLE_AUTO);
  });

  const selectedAudioStreamIndex = () =>
    audioValue() === AUDIO_AUTO ? null : Number(audioValue());
  const selectedSubtitleStreamIndex = () => {
    const value = subtitleValue();
    if (value === SUBTITLE_AUTO) {
      return null;
    }
    if (value === SUBTITLE_OFF) {
      return -1;
    }
    return Number(value);
  };
  const playItem = async (mode: VideoLibraryPlayMode) => {
    const item = detail();
    if (!item || playBusy()) {
      return;
    }

    setPlayBusy(mode);
    setPlayError(null);
    const result = await startLibraryPlayback({
      audioStreamIndex: selectedAudioStreamIndex(),
      itemId: item.id,
      mode,
      startPositionSeconds: mode === 'resume' ? item.resumePositionSeconds : 0,
      subtitleStreamIndex: selectedSubtitleStreamIndex(),
    });
    setPlayError(
      Exit.match(result, {
        onFailure: (cause) => commandFailureMessage(cause, 'Could not start playback'),
        onSuccess: () => null,
      }),
    );
    setPlayBusy(null);
  };
  const statusTitle = () => {
    const current = state();
    if (current && !Exit.isSuccess(current)) {
      return 'Could not load item detail';
    }
    return 'Loading item detail';
  };
  const statusDescription = () => {
    const current = state();
    if (current && !Exit.isSuccess(current)) {
      return commandFailureMessage(current.cause, 'Could not load item detail');
    }
    return 'JMSR is loading Movie or Episode detail data from Jellyfin.';
  };

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <Button
          href="/library"
          variant="outlined"
          class="rounded-full"
          leadingIcon={<Library class="h-4 w-4" />}
        >
          Video Home
        </Button>
        <Button
          type="button"
          variant="outlined"
          class="rounded-full"
          disabled={state.loading}
          onClick={() => void refetch()}
          leadingIcon={<RefreshCw class="h-4 w-4" />}
        >
          Retry Detail
        </Button>
      </div>

      <Show
        when={detail()}
        fallback={<LibraryStatusPanel title={statusTitle()} description={statusDescription()} />}
      >
        {(item) => {
          const isEpisode = () => item().itemType === 'Episode';
          const artworkAspectClass = () => (isEpisode() ? 'aspect-video' : 'aspect-[2/3]');
          const missingArtworkLabel = () => (isEpisode() ? 'No episode artwork' : 'No artwork');

          return (
            <article class="grid gap-6 lg:grid-cols-[minmax(240px,360px)_1fr]">
              <div class="card-filled overflow-hidden p-0">
                <div class={`${artworkAspectClass()} bg-surface-container-lowest/60`}>
                  <Show
                    when={item().artworkUrl}
                    fallback={
                      <div class="text-on-surface-variant flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                        <Film class="h-8 w-8" />
                        <p class="text-title-medium">{item().name}</p>
                        <p class="text-label-small">{missingArtworkLabel()}</p>
                      </div>
                    }
                  >
                    {(artworkUrl) => (
                      <img
                        src={artworkUrl()}
                        alt={`${item().name} artwork`}
                        class="h-full w-full object-cover"
                      />
                    )}
                  </Show>
                </div>
              </div>
              <div class="space-y-5">
                <div>
                  <p class="text-label-small text-secondary">{item().itemType}</p>
                  <h1 class="text-headline-large">{item().name}</h1>
                  <p class="text-body-large mt-2">{detailSubtitle(item())}</p>
                  <Show when={isEpisode() && item().seriesId}>
                    <a
                      href={`/library/shows/${item().seriesId}`}
                      class="text-body-small text-secondary mt-1 inline-block underline-offset-4 hover:underline"
                    >
                      View series
                    </a>
                  </Show>
                </div>
                <div class="flex flex-wrap gap-2">
                  <StatusBadge variant={item().played ? 'success' : 'neutral'}>
                    {item().played ? 'Played' : 'Unplayed'}
                  </StatusBadge>
                  <StatusBadge variant={item().favorite ? 'success' : 'neutral'}>
                    {item().favorite ? 'Favorite' : 'Not favorite'}
                  </StatusBadge>
                  <Show when={formatRuntime(item().runtimeSeconds)}>
                    {(runtime) => <StatusBadge variant="neutral">{runtime()}</StatusBadge>}
                  </Show>
                </div>
                <UserDataControls
                  itemId={item().id}
                  played={item().played}
                  favorite={item().favorite}
                  subject={item().itemType.toLowerCase()}
                  onUpdate={updateLibraryUserData}
                  onSuccess={() => void refetch()}
                />
                <Show when={item().overview}>
                  {(overview) => <p class="text-body-medium">{overview()}</p>}
                </Show>
                <Show when={item().genres.length > 0}>
                  <div class="flex flex-wrap gap-2">
                    <For each={item().genres}>
                      {(genre) => (
                        <span class="border-outline-variant text-label-small rounded-full border px-3 py-1">
                          {genre}
                        </span>
                      )}
                    </For>
                  </div>
                </Show>
                <Show when={item().resumePositionSeconds !== null}>
                  <p class="text-body-small text-secondary">
                    Resume at {Math.floor(item().resumePositionSeconds ?? 0)}s
                    {item().playedPercentage !== null
                      ? ` · ${Math.round(item().playedPercentage ?? 0)}% watched`
                      : ''}
                  </p>
                </Show>
                <div class="grid gap-4 sm:grid-cols-2">
                  <JmsrSelect
                    label="Audio track"
                    items={audioItems()}
                    disabled={playBusy() !== null}
                    value={audioValue()}
                    size="compact"
                    onValueChange={setAudioValue}
                  />

                  <JmsrSelect
                    label="Subtitle track"
                    items={subtitleItems()}
                    disabled={playBusy() !== null}
                    value={subtitleValue()}
                    size="compact"
                    onValueChange={setSubtitleValue}
                  />
                </div>
                <div class="flex flex-wrap gap-3">
                  <Show
                    when={item().canResume}
                    fallback={
                      <Button
                        type="button"
                        variant="primary"
                        class="rounded-full"
                        disabled={playBusy() !== null}
                        onClick={() => void playItem('start')}
                        leadingIcon={
                          <Show
                            when={playBusy() === 'start'}
                            fallback={<Play class="h-4 w-4 fill-current" />}
                          >
                            <RefreshCw class="h-4 w-4 animate-spin" />
                          </Show>
                        }
                      >
                        {playBusy() === 'start' ? 'Starting...' : 'Play'}
                      </Button>
                    }
                  >
                    <Button
                      type="button"
                      variant="primary"
                      class="rounded-full"
                      disabled={playBusy() !== null}
                      onClick={() => void playItem('resume')}
                      leadingIcon={
                        <Show
                          when={playBusy() === 'resume'}
                          fallback={<Play class="h-4 w-4 fill-current" />}
                        >
                          <RefreshCw class="h-4 w-4 animate-spin" />
                        </Show>
                      }
                    >
                      {playBusy() === 'resume' ? 'Starting...' : 'Resume'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      class="rounded-full"
                      disabled={playBusy() !== null}
                      onClick={() => void playItem('start')}
                      leadingIcon={
                        <Show
                          when={playBusy() === 'start'}
                          fallback={<RotateCcw class="h-4 w-4" />}
                        >
                          <RefreshCw class="h-4 w-4 animate-spin" />
                        </Show>
                      }
                    >
                      {playBusy() === 'start' ? 'Starting...' : 'Play from beginning'}
                    </Button>
                  </Show>
                </div>
                <Show when={playError()}>
                  {(message) => <p class="text-body-small text-error">{message()}</p>}
                </Show>
              </div>
            </article>
          );
        }}
      </Show>
    </div>
  );
}

function streamLabel(stream: VideoPlaybackStreamOption) {
  const tags = [
    stream.language?.toUpperCase() ?? null,
    stream.codec?.toUpperCase() ?? null,
    stream.isExternal ? 'External' : null,
    stream.isDefault ? 'Default' : null,
  ].filter((tag) => tag !== null);

  return tags.length > 0 ? `${stream.label} (${tags.join(', ')})` : stream.label;
}
