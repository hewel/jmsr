import { createForm } from '@tanstack/solid-form';
import type { IntroSkipperMode } from '../../bindings';

export interface FormDefaultValues {
  deviceName: string;
  mpvPath: string;
  mpvArgs: string;
  keybindNext: string;
  keybindPrev: string;
  keybindIntroSkip: string;
  introSkipperMode: IntroSkipperMode;
}

/**
 * Helper used only for type inference — never called at runtime.
 * Captures the full return type of `createForm` with our default values
 * so card components can accept the form without `any`.
 */
function inferFormType() {
  return createForm(() => ({
    defaultValues: {
      deviceName: '',
      mpvPath: '',
      mpvArgs: '',
      keybindNext: '',
      keybindPrev: '',
      keybindIntroSkip: '',
      introSkipperMode: 'automatic' as IntroSkipperMode,
    },
  }));
}

export type OperationsConsoleForm = ReturnType<typeof inferFormType>;
