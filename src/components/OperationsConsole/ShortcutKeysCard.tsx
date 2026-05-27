import { Field as ArkField } from '@ark-ui/solid/field';
import { Keyboard } from 'lucide-solid';
import { SectionCard } from '../ui';
import type { OperationsConsoleForm } from './types';

interface ShortcutKeysCardProps {
  form: OperationsConsoleForm;
  onSaveTextSetting: (
    field: 'keybindNext' | 'keybindPrev' | 'keybindIntroSkip',
    value: string,
  ) => void;
}

export default function ShortcutKeysCard(props: ShortcutKeysCardProps) {
  return (
    <SectionCard icon={<Keyboard class="h-6 w-6" />} title="Shortcut keys">
      <div class="space-y-4">
        <p class="text-body-small text-on-surface-variant">
          MPV input bindings for episode navigation and manual intro skipping.
        </p>

        <props.form.Field
          name="keybindNext"
          validators={{
            onBlur: ({ value }) =>
              !value.trim() ? 'Keybinding is required' : undefined,
          }}
        >
          {(field) => (
            <ArkField.Root
              class="block"
              invalid={field().state.meta.errors.length > 0}
            >
              <ArkField.Label class="mb-1 block text-label-medium uppercase text-on-surface-variant">
                Next episode key
              </ArkField.Label>
              <ArkField.Input
                id={field().name}
                name={field().name}
                type="text"
                value={field().state.value}
                onInput={(event) =>
                  field().handleChange(event.currentTarget.value)
                }
                onBlur={(event) => {
                  field().handleBlur();
                  props.onSaveTextSetting(
                    'keybindNext',
                    event.currentTarget.value,
                  );
                }}
                class="input-filled w-full font-mono"
                placeholder="Shift+>"
              />
            </ArkField.Root>
          )}
        </props.form.Field>

        <props.form.Field
          name="keybindPrev"
          validators={{
            onBlur: ({ value }) =>
              !value.trim() ? 'Keybinding is required' : undefined,
          }}
        >
          {(field) => (
            <ArkField.Root
              class="block"
              invalid={field().state.meta.errors.length > 0}
            >
              <ArkField.Label class="mb-1 block text-label-medium uppercase text-on-surface-variant">
                Previous episode key
              </ArkField.Label>
              <ArkField.Input
                id={field().name}
                name={field().name}
                type="text"
                value={field().state.value}
                onInput={(event) =>
                  field().handleChange(event.currentTarget.value)
                }
                onBlur={(event) => {
                  field().handleBlur();
                  props.onSaveTextSetting(
                    'keybindPrev',
                    event.currentTarget.value,
                  );
                }}
                class="input-filled w-full font-mono"
                placeholder="Shift+<"
              />
            </ArkField.Root>
          )}
        </props.form.Field>

        <props.form.Field
          name="keybindIntroSkip"
          validators={{
            onBlur: ({ value }) =>
              !value.trim() ? 'Keybinding is required' : undefined,
          }}
        >
          {(field) => (
            <ArkField.Root
              class="block"
              invalid={field().state.meta.errors.length > 0}
            >
              <ArkField.Label class="mb-1 block text-label-medium uppercase text-on-surface-variant">
                Intro skip key
              </ArkField.Label>
              <ArkField.Input
                id={field().name}
                name={field().name}
                type="text"
                value={field().state.value}
                onInput={(event) =>
                  field().handleChange(event.currentTarget.value)
                }
                onBlur={(event) => {
                  field().handleBlur();
                  props.onSaveTextSetting(
                    'keybindIntroSkip',
                    event.currentTarget.value,
                  );
                }}
                class="input-filled w-full font-mono"
                placeholder="g"
              />
            </ArkField.Root>
          )}
        </props.form.Field>
      </div>
    </SectionCard>
  );
}
