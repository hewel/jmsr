import type { IntroSkipperMode } from '../../bindings';

export const INTRO_SKIPPER_MODES: {
  mode: IntroSkipperMode;
  label: string;
  description: string;
}[] = [
  {
    description: 'Skip ranges as playback reaches them.',
    label: 'Automatic',
    mode: 'automatic',
  },
  {
    description: 'Show an MPV prompt and wait for the shortcut.',
    label: 'Manual',
    mode: 'manual',
  },
  {
    description: 'Do not fetch or apply Intro Skipper ranges.',
    label: 'Off',
    mode: 'off',
  },
];
