import { Bot } from 'lucide-solid';
import { For, Show } from 'solid-js';

import type { IntroSkipperMode } from '../../bindings';
import { SectionCard } from '../ui';
import { INTRO_SKIPPER_MODES } from './introSkipperModes';
import { useOperationsConsoleStore } from './store';

interface IntroSkipCardProps {
  currentMode: IntroSkipperMode;
  onModeChange: (mode: IntroSkipperMode) => void;
}

export default function IntroSkipCard(props: IntroSkipCardProps) {
  const [ui] = useOperationsConsoleStore();

  return (
    <SectionCard
      icon={<Bot class="text-secondary h-5 w-5 drop-shadow-[0_0_8px_rgba(129,140,248,0.4)]" />}
      title="Intro Skip"
    >
      <div class="space-y-4">
        <fieldset class="grid grid-cols-1 gap-3" aria-label="Intro Skip Mode">
          <For each={INTRO_SKIPPER_MODES}>
            {(option) => (
              <button
                type="button"
                class={`cursor-pointer rounded-2xl border px-4 py-3 text-left backdrop-blur-sm transition-all duration-300 ${
                  props.currentMode === option.mode
                    ? 'border-primary bg-primary-container/35 text-on-primary-container shadow-brand-glow-lg font-semibold'
                    : 'border-outline-variant bg-surface-container-high/40 text-on-surface hover:border-primary/50 hover:bg-surface-container-high/60'
                }`}
                aria-pressed={props.currentMode === option.mode}
                onClick={() => props.onModeChange(option.mode)}
              >
                <span class="text-title-medium block">{option.label}</span>
                <span class="text-body-small mt-1 block opacity-80">{option.description}</span>
              </button>
            )}
          </For>
        </fieldset>
        <Show when={ui.introSkipperSaving}>
          <p class="text-body-small text-secondary flex animate-pulse items-center gap-1.5 font-semibold">
            <span class="bg-secondary h-1.5 w-1.5 animate-ping rounded-full" />
            Saving preference…
          </p>
        </Show>
        <p class="text-body-small text-on-surface-variant/80">
          Changes take effect after restarting MPV.
        </p>
        <Show when={ui.introSkipperError}>
          {(message) => (
            <p class="bg-error-container/20 border-error/30 text-body-small text-on-error-container rounded-2xl border px-4 py-3 font-semibold">
              {message()}
            </p>
          )}
        </Show>
      </div>
    </SectionCard>
  );
}
