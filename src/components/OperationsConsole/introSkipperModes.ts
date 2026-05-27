import type { IntroSkipperMode } from '../../bindings';

export const INTRO_SKIPPER_MODES: {
  mode: IntroSkipperMode;
  label: string;
  description: string;
}[] = [
  {
    mode: 'automatic',
    label: 'Automatic',
    description: 'Skip ranges as playback reaches them.',
  },
  {
    mode: 'manual',
    label: 'Manual',
    description: 'Show an MPV prompt and wait for the shortcut.',
  },
  {
    mode: 'off',
    label: 'Off',
    description: 'Do not fetch or apply Intro Skipper ranges.',
  },
];
