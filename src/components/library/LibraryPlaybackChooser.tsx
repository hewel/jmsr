import { Dialog } from '@ark-ui/solid/dialog';
import { Play, X } from 'lucide-solid';
import { createEffect, createMemo, createSignal } from 'solid-js';
import { Portal } from 'solid-js/web';

import type {
  VideoItemDetail,
  VideoLibraryPlayMode,
  VideoPlaybackStreamOption,
} from '../../bindings';
import { Button, Card, JellyPilotSelect } from '../ui';
import type { JellyPilotSelectItem } from '../ui';

const SUBTITLE_AUTO = 'auto';
const SUBTITLE_OFF = 'off';

export interface PendingLibraryPlayback {
  detail: VideoItemDetail;
  mode: VideoLibraryPlayMode;
  startPositionSeconds: number | null;
}

export interface LibraryPlaybackSelection {
  audioStreamIndex: number | null;
  subtitleStreamIndex: number | null;
}

export function LibraryPlaybackChooser(props: {
  pending: PendingLibraryPlayback;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (selection: LibraryPlaybackSelection) => void;
}) {
  const audioItems = createMemo<JellyPilotSelectItem[]>(() => {
    const streams = props.pending.detail.audioStreams;
    if (streams.length === 0) {
      return [{ disabled: true, label: 'No audio tracks', value: '' }];
    }

    return streams.map((stream) => ({
      label: streamLabel(stream),
      value: String(stream.index),
    }));
  });
  const subtitleItems = createMemo<JellyPilotSelectItem[]>(() => [
    { label: 'Auto', value: SUBTITLE_AUTO },
    { label: 'Off', value: SUBTITLE_OFF },
    ...props.pending.detail.subtitleStreams.map((stream) => ({
      label: streamLabel(stream),
      value: String(stream.index),
    })),
  ]);
  const defaultAudioValue = createMemo(() => {
    const streams = props.pending.detail.audioStreams;
    const preferred = streams.find((stream) => stream.isDefault) ?? streams[0];
    return preferred ? String(preferred.index) : '';
  });
  const [audioValue, setAudioValue] = createSignal(defaultAudioValue());
  const [subtitleValue, setSubtitleValue] = createSignal(SUBTITLE_AUTO);

  createEffect(() => {
    props.pending.detail.id;
    props.pending.mode;
    setAudioValue(defaultAudioValue());
    setSubtitleValue(SUBTITLE_AUTO);
  });

  const audioStreamIndex = () => (audioValue() === '' ? null : Number(audioValue()));
  const subtitleStreamIndex = () => {
    const value = subtitleValue();
    if (value === SUBTITLE_AUTO) {
      return null;
    }
    if (value === SUBTITLE_OFF) {
      return -1;
    }
    return Number(value);
  };
  const confirmLabel = () =>
    props.pending.mode === 'resume' ? 'Resume playback' : 'Start playback';

  return (
    <Dialog.Root
      open={true}
      onOpenChange={(event) => {
        if (!event.open) {
          props.onCancel();
        }
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-60 bg-black/70 backdrop-blur-sm transition-[backdrop-filter,background-color,opacity] duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <Dialog.Positioner class="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto p-4">
          <Dialog.Content class="relative w-full max-w-2xl outline-none">
            <Card
              as="section"
              variant="filled"
              class="border-secondary/40 bg-secondary-container/10 space-y-4"
            >
              <div>
                <p class="text-secondary text-[11px] leading-[16px] font-bold tracking-[0.08em] uppercase">
                  {props.pending.detail.itemType}
                </p>
                <Dialog.Title class="text-on-surface text-[22px] leading-[28px] font-bold">
                  {props.pending.detail.name}
                </Dialog.Title>
              </div>

              <div class="grid gap-4 sm:grid-cols-2">
                <JellyPilotSelect
                  label="Audio track"
                  items={audioItems()}
                  disabled={props.busy || props.pending.detail.audioStreams.length === 0}
                  value={audioValue()}
                  placeholder="No audio tracks"
                  size="compact"
                  onValueChange={setAudioValue}
                />

                <JellyPilotSelect
                  label="Subtitle track"
                  items={subtitleItems()}
                  disabled={props.busy}
                  value={subtitleValue()}
                  size="compact"
                  onValueChange={setSubtitleValue}
                />
              </div>

              <div class="flex flex-wrap justify-end gap-3">
                <Dialog.CloseTrigger
                  class="border-outline text-on-surface hover:border-primary hover:bg-primary/5 inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border bg-transparent px-5 py-3 text-[14px] leading-[20px] font-bold transition-[background-color,border-color,color,transform] duration-200 select-none active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50"
                  disabled={props.busy}
                >
                  <X class="h-4 w-4" />
                  Cancel
                </Dialog.CloseTrigger>
                <Button
                  type="button"
                  variant="primary"
                  class="rounded-full"
                  disabled={props.busy}
                  onClick={() =>
                    props.onConfirm({
                      audioStreamIndex: audioStreamIndex(),
                      subtitleStreamIndex: subtitleStreamIndex(),
                    })
                  }
                  leadingIcon={<Play class="h-4 w-4 fill-current" />}
                >
                  {props.busy ? 'Starting...' : confirmLabel()}
                </Button>
              </div>
            </Card>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
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
