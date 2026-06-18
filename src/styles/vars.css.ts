import { createGlobalThemeContract } from '@vanilla-extract/css';

export const vars = createGlobalThemeContract(
  {
    color: {
      primary: 'color-primary',
      onPrimary: 'color-on-primary',
      primaryContainer: 'color-primary-container',
      onPrimaryContainer: 'color-on-primary-container',

      secondary: 'color-secondary',
      onSecondary: 'color-on-secondary',
      secondaryContainer: 'color-secondary-container',
      onSecondaryContainer: 'color-on-secondary-container',

      tertiary: 'color-tertiary',
      onTertiary: 'color-on-tertiary',
      tertiaryContainer: 'color-tertiary-container',
      onTertiaryContainer: 'color-on-tertiary-container',

      warning: 'color-warning',
      onWarning: 'color-on-warning',
      warningContainer: 'color-warning-container',
      onWarningContainer: 'color-on-warning-container',

      error: 'color-error',
      onError: 'color-on-error',
      errorContainer: 'color-error-container',
      onErrorContainer: 'color-on-error-container',

      background: 'color-background',
      onBackground: 'color-on-background',
      surface: 'color-surface',
      onSurface: 'color-on-surface',
      surfaceVariant: 'color-surface-variant',
      onSurfaceVariant: 'color-on-surface-variant',

      surfaceContainerLowest: 'color-surface-container-lowest',
      surfaceContainerLow: 'color-surface-container-low',
      surfaceContainer: 'color-surface-container',
      surfaceContainerHigh: 'color-surface-container-high',
      surfaceContainerHighest: 'color-surface-container-highest',
      surfaceTint: 'color-surface-tint',
      brandGlow: 'color-brand-glow',
      consoleGrid: 'color-console-grid',

      outline: 'color-outline',
      outlineVariant: 'color-outline-variant',
    },
    font: {
      sans: 'font-sans',
      display: 'font-display',
      mono: 'font-mono',
    },
  },
  (value) => value || '',
);
