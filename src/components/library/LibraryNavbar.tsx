import { SegmentGroup } from '@ark-ui/solid/segment-group';
import type { VideoLibraryShortcut } from '@bindings';
import { useNavigate } from '@tanstack/solid-router';
import { For, Show } from 'solid-js';
import type { JSX } from 'solid-js';

export interface LibraryNavbarProps {
  shortcuts: VideoLibraryShortcut[];
  activeValue: string;
  controls?: JSX.Element | null;
}

interface LibraryNavbarItem {
  value: string;
  label: string;
  target: string;
}

export default function LibraryNavbar(props: LibraryNavbarProps) {
  const navigate = useNavigate();
  const items = (): LibraryNavbarItem[] => [
    { value: 'home', label: 'Home', target: '/library' },
    ...props.shortcuts.map((shortcut) => ({
      value: `${shortcut.collectionType}:${shortcut.id}`,
      label: shortcut.name,
      target: `/library/${shortcut.collectionType}/${shortcut.id}`,
    })),
  ];

  const navigateToSegment = (value: string | null) => {
    const target = items().find((item) => item.value === value)?.target;

    if (!target) {
      return;
    }

    void navigate({ to: target });
  };

  return (
    <nav
      aria-label="Library navigation"
      class="border-outline-variant bg-surface-container-low/75 sticky top-2 z-30 rounded-2xl border p-3 shadow-xl backdrop-blur-md lg:p-4"
    >
      <div class="flex flex-row flex-wrap items-center justify-between gap-4">
        <SegmentGroup.Root
          value={props.activeValue}
          onValueChange={(details) => navigateToSegment(details.value)}
          class="bg-surface-container-high/50 border-outline-variant/80 relative flex min-w-0 flex-wrap gap-1 rounded-xl border p-1"
        >
          <SegmentGroup.Indicator class="bg-secondary-container/70 border-secondary/40 rounded-lg border shadow-sm" />
          <For each={items()}>
            {(item) => (
              <SegmentGroup.Item
                value={item.value}
                class="text-on-surface-variant data-[state=checked]:text-on-secondary-container relative z-10 inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-4 text-[14px] leading-[20px] font-bold transition-colors data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
              >
                <SegmentGroup.ItemText>{item.label}</SegmentGroup.ItemText>
                <SegmentGroup.ItemControl />
                <SegmentGroup.ItemHiddenInput />
              </SegmentGroup.Item>
            )}
          </For>
        </SegmentGroup.Root>

        <Show when={props.controls}>
          <div class="min-w-0 flex-1 xl:flex-none">{props.controls}</div>
        </Show>
      </div>
    </nav>
  );
}
