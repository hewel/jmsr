import { StatusBadge } from '@components/ui';
import { Show } from 'solid-js';
import type { JSX } from 'solid-js';
import { imageSource } from '~utils/imageSource';

export interface DetailHeroProps {
  title: string;
  subtitle: JSX.Element;
  backdropUrl: string | null;
  artworkUrl: string | null;
  artworkAspect: 'poster' | 'landscape';
  typeLabel: string;
  typeIcon: JSX.Element;
  badges: JSX.Element;
  actions: JSX.Element;
  resumeProgress?: number | null;
}

export function DetailHero(props: DetailHeroProps) {
  const heroImage = () => props.backdropUrl ?? props.artworkUrl;
  const artworkWidthClass = () =>
    props.artworkAspect === 'poster'
      ? 'w-[140px] lg:w-[190px] 2xl:w-[220px]'
      : 'w-[200px] lg:w-[280px] 2xl:w-[340px]';
  const artworkAspectClass = () =>
    props.artworkAspect === 'poster' ? 'aspect-[2/3]' : 'aspect-video';
  const progressPercent = () => Math.max(0, Math.min(1, props.resumeProgress ?? 0)) * 100;

  return (
    <section class="relative h-[clamp(280px,44vh,560px)] overflow-hidden">
      <div class="absolute inset-0">
        <Show
          when={heroImage()}
          fallback={
            <div class="from-primary-container/30 to-surface h-full w-full bg-gradient-to-b" />
          }
        >
          {(url) => (
            <img
              src={imageSource(url())}
              alt=""
              aria-hidden="true"
              class="h-full w-full scale-110 object-cover blur-[20px] brightness-[0.3]"
            />
          )}
        </Show>
      </div>
      <div class="from-surface via-surface/60 absolute inset-0 bg-gradient-to-t to-transparent" />

      <div class="relative z-10 flex h-full items-end gap-6 px-6 pb-6 lg:gap-8 lg:px-10 lg:pb-8 xl:gap-10 xl:px-12 xl:pb-10">
        <div
          class={`bg-surface-container-lowest/70 relative hidden shrink-0 overflow-hidden rounded-xl shadow-2xl outline outline-1 -outline-offset-1 outline-white/10 sm:block ${artworkWidthClass()} ${artworkAspectClass()}`}
        >
          <Show
            when={props.artworkUrl}
            fallback={
              <div class="text-on-surface-variant flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <div class="text-secondary bg-secondary-container/30 flex h-12 w-12 items-center justify-center rounded-2xl">
                  {props.typeIcon}
                </div>
                <p class="text-on-surface line-clamp-3 text-[13px] leading-[18px] font-semibold text-balance">
                  {props.title}
                </p>
              </div>
            }
          >
            {(artworkUrl) => (
              <img
                src={imageSource(artworkUrl())}
                alt={`${props.title} artwork`}
                class="h-full w-full object-cover"
              />
            )}
          </Show>
          <Show when={props.resumeProgress != null}>
            <div class="bg-surface/70 absolute right-0 bottom-0 left-0 h-1">
              <div class="bg-secondary h-full" style={{ width: `${progressPercent()}%` }} />
            </div>
          </Show>
        </div>

        <div class="min-w-0 flex-1 space-y-3 lg:space-y-4">
          <StatusBadge variant="neutral">{props.typeLabel}</StatusBadge>
          <div class="space-y-1">
            <h1 class="font-display text-on-surface text-[28px] leading-[36px] font-bold tracking-tight text-balance lg:text-[42px] lg:leading-[50px] xl:text-[48px] xl:leading-[56px]">
              {props.title}
            </h1>
            <p class="text-on-surface-variant text-[14px] leading-[20px] lg:text-[16px] lg:leading-[24px]">
              {props.subtitle}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">{props.badges}</div>
          <div class="flex flex-wrap items-center gap-3">{props.actions}</div>
        </div>
      </div>
    </section>
  );
}
