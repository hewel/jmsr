import { Check, Images } from 'lucide-solid';
import { Show } from 'solid-js';

import { SectionCard } from '../ui';

interface LibrarySettingsCardProps {
  imageDiskCacheEnabled: boolean;
  onImageDiskCacheEnabledChange: (enabled: boolean) => void;
}

export default function LibrarySettingsCard(props: LibrarySettingsCardProps) {
  return (
    <SectionCard
      icon={<Images class="text-primary h-5 w-5 drop-shadow-[0_0_8px_rgba(79,70,229,0.4)]" />}
      title="Library"
    >
      <button
        type="button"
        role="checkbox"
        aria-label="Image disk cache"
        aria-checked={props.imageDiskCacheEnabled}
        onClick={() => props.onImageDiskCacheEnabledChange(!props.imageDiskCacheEnabled)}
        class="bg-surface-container-high/30 border-outline-variant/60 focus-visible:outline-primary flex cursor-pointer items-start gap-3 rounded-2xl border p-4 text-left shadow-inner backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <span
          aria-hidden="true"
          class={`border-outline bg-surface-container-high text-on-primary hover:border-primary/60 mt-0.5 inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-lg border text-[11px] leading-none transition-[background-color,border-color,box-shadow] duration-200 ${
            props.imageDiskCacheEnabled
              ? 'border-primary from-primary to-primary-gradient-end bg-gradient-to-br'
              : ''
          }`}
        >
          <Show when={props.imageDiskCacheEnabled}>
            <Check class="h-3.5 w-3.5" stroke-width={3} />
          </Show>
        </span>
        <div class="min-w-0">
          <span class="text-on-surface block text-[14px] leading-5 font-semibold">
            Image disk cache
          </span>
          <p class="text-on-surface-variant/80 mt-1 text-[12px] leading-4">
            Cache Library artwork locally for faster repeat browsing.
          </p>
        </div>
      </button>
    </SectionCard>
  );
}
