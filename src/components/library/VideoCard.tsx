import { Check, Film, Heart, Tv } from 'lucide-solid';
import { Show } from 'solid-js';

import type { VideoHomeItem, VideoLibraryItem, VideoLibraryKind } from '../../bindings';
import { imageSource } from '../../utils/imageSource';

export type VideoCardAspectClass = 'aspect-[2/3]' | 'aspect-video';

export type VideoCardProps =
  | {
      kind: 'home';
      item: VideoHomeItem;
      aspectClass: VideoCardAspectClass;
    }
  | {
      kind: 'library';
      item: VideoLibraryItem;
      collectionType?: VideoLibraryKind;
    };

export function VideoCard(props: VideoCardProps) {
  const href = () => {
    if (props.kind === 'home') {
      return `/library/items/${props.item.id}`;
    }
    return props.item.itemType === 'Series'
      ? `/library/shows/${props.item.id}`
      : `/library/items/${props.item.id}`;
  };

  const aspectClass = (): VideoCardAspectClass => {
    if (props.kind === 'home') {
      return props.aspectClass;
    }
    return props.collectionType === 'tvshows' ||
      props.item.itemType === 'Series' ||
      props.item.itemType === 'Movie'
      ? 'aspect-[2/3]'
      : 'aspect-video';
  };

  const subtitle = () => {
    if (props.kind === 'home') {
      const item = props.item;
      if (!item.seriesName) {
        return item.productionYear ? `${item.itemType} · ${item.productionYear}` : item.itemType;
      }
      const number =
        item.seasonNumber !== null && item.episodeNumber !== null
          ? `S${item.seasonNumber.toString().padStart(2, '0')}E${item.episodeNumber.toString().padStart(2, '0')}`
          : item.itemType;
      return `${item.seriesName} · ${number}`;
    }

    const year = props.item.productionYear
      ? props.item.productionYear.toString()
      : props.item.itemType;
    return year;
  };

  const usesTvIcon = () =>
    (props.kind === 'library' && props.collectionType === 'tvshows') ||
    props.item.itemType === 'Series' ||
    props.item.itemType === 'Episode';

  const cardAriaLabel = () => `Open ${props.item.name}${props.item.favorite ? ', favorite' : ''}`;

  return (
    <a
      href={href()}
      aria-label={cardAriaLabel()}
      class="border-outline-variant/80 bg-surface/50 focus-visible:ring-secondary/70 hover:border-primary/50 block overflow-hidden rounded-2xl border bg-[linear-gradient(135deg,rgba(21,24,35,0.5)_0%,rgba(11,13,20,0.7)_100%)] p-0! shadow-xl backdrop-blur-md transition-[background-color,border-color,box-shadow] duration-300 focus-visible:ring-2 focus-visible:outline-none active:scale-[0.96]"
    >
      <div
        class={`${aspectClass()} border-outline-variant bg-surface-container-lowest/60 relative overflow-hidden border-b`}
      >
        <Show
          when={props.item.artworkUrl}
          fallback={
            <div class="text-on-surface-variant flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-[11px] leading-4 font-bold tracking-[0.08em] uppercase">
              <Show when={usesTvIcon()} fallback={<Film class="h-5 w-5" aria-hidden="true" />}>
                <Tv class="h-5 w-5" aria-hidden="true" />
              </Show>
              <span>No artwork</span>
            </div>
          }
        >
          {(artworkUrl) => (
            <img
              src={imageSource(artworkUrl())}
              alt={`${props.item.name} artwork`}
              class="h-full w-full object-cover outline -outline-offset-1 outline-white/10"
              loading="lazy"
            />
          )}
        </Show>
        <Show when={props.item.favorite}>
          <span
            class="bg-secondary text-on-secondary absolute top-2 right-2 inline-flex h-7 w-7 items-center justify-center rounded-full shadow-lg"
            aria-hidden="true"
          >
            <Heart class="h-4 w-4" fill="currentColor" aria-hidden="true" />
          </span>
        </Show>
      </div>
      <div class="flex items-center gap-2 px-4 pt-2 pb-3">
        <div class="min-w-0 flex-1 space-y-1">
          <p class="text-on-surface line-clamp-1 text-[16px] leading-6 font-semibold">
            {props.item.name}
          </p>
          <p class="text-on-surface-variant/80 text-[12px] leading-4">{subtitle()}</p>
        </div>
        <Show when={props.item.played}>
          <span
            class="text-tertiary inline-flex h-5 w-5 shrink-0 items-center justify-center"
            role="img"
            aria-label="Played"
          >
            <Check class="h-4 w-4" aria-hidden="true" />
          </span>
        </Show>
      </div>
    </a>
  );
}
