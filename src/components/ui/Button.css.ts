import { style, styleVariants } from '@vanilla-extract/css';

import { vars } from '../../styles/vars.css';

export const baseButton = style({
  alignItems: 'center',
  boxSizing: 'border-box',
  cursor: 'pointer',
  display: 'inline-flex',
  fontFamily: vars.font.sans,
  fontWeight: '700',
  justifyContent: 'center',
  outline: 'none',
  position: 'relative',
  selectors: {
    '&:disabled': {
      opacity: 0.5,
      pointerEvents: 'none',
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.primary}`,
      outlineOffset: '2px',
    },
  },
  textDecoration: 'none',
  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
  userSelect: 'none',
  verticalAlign: 'middle',
});

export const sizeStyles = styleVariants({
  lg: {
    borderRadius: '1.25rem', // 20px
    fontSize: '16px',
    gap: '0.625rem',
    lineHeight: '24px',
    minHeight: '3.25rem', // 52px
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    vars: {
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
      '--py': '1.2em',
    },
  },
  md: {
    borderRadius: '1rem', // 16px
    fontSize: '14px',
    gap: '0.5rem',
    lineHeight: '20px',
    minHeight: '2.75rem', // 44px
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    vars: {
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
      '--py': '0.875em',
    },
  },
  sm: {
    borderRadius: '0.75rem', // 12px
    fontSize: '12px',
    gap: '0.375rem',
    lineHeight: '16px',
    minHeight: '2.25rem', // 36px
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    vars: {
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
      '--py': '0.5em',
    },
  },
});

export const variantStyles = styleVariants({
  icon: {
    background: 'transparent',
    color: vars.color.onSurfaceVariant,
    padding: 0,
    selectors: {
      '&:active': {
        transform: 'scale(0.95)',
      },
      '&:hover': {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        color: vars.color.onSurface,
      },
    },
  },
  outlined: {
    background: 'transparent',
    borderColor: vars.color.outline,
    borderStyle: 'solid',
    borderWidth: '1px',
    color: vars.color.onSurface,
    selectors: {
      '&:active': {
        transform: 'scale(0.97)',
      },
      '&:hover': {
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
        borderColor: vars.color.primary,
      },
    },
  },
  primary: {
    background: `linear-gradient(90deg, ${vars.color.primary} 0%, #7a7eff 100%)`,
    boxShadow: `0 10px 15px -3px rgba(79, 70, 229, 0.2), 0 0 10px rgba(79, 70, 229, 0.1)`,
    color: vars.color.onPrimary,
    selectors: {
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
      '&:hover': {
        boxShadow: `0 12px 20px -3px rgba(79, 70, 229, 0.45), 0 0 15px rgba(79, 70, 229, 0.25)`,
        filter: 'brightness(1.1)',
        transform: 'translateY(-2px)',
      },
    },
  },
  secondary: {
    background: `linear-gradient(90deg, ${vars.color.secondaryContainer} 0%, #0b4b60 100%)`,
    borderColor: vars.color.outlineVariant,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    color: vars.color.onSecondaryContainer,
    selectors: {
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
      '&:hover': {
        borderColor: vars.color.outline,
        boxShadow: '0 6px 8px -1px rgba(0, 0, 0, 0.3)',
        transform: 'translateY(-2px)',
      },
    },
  },
  text: {
    background: 'transparent',
    color: vars.color.secondary,
    selectors: {
      '&:active': {
        transform: 'scale(0.97)',
      },
      '&:hover': {
        backgroundColor: 'rgba(129, 140, 248, 0.1)',
      },
    },
  },
  tonal: {
    background: `linear-gradient(90deg, ${vars.color.secondaryContainer} 0%, #0b4b60 100%)`,
    borderColor: vars.color.outlineVariant,
    borderStyle: 'solid',
    borderWidth: '1px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    color: vars.color.onSecondaryContainer,
    selectors: {
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
      '&:hover': {
        borderColor: vars.color.outline,
        boxShadow: '0 6px 8px -1px rgba(0, 0, 0, 0.3)',
        transform: 'translateY(-2px)',
      },
    },
  },
});

export const iconSizeStyles = styleVariants({
  lg: {
    borderRadius: '1.25rem',
    height: '3.25rem',
    minHeight: '3.25rem',
    minWidth: '3.25rem',
    width: '3.25rem',
  },
  md: {
    borderRadius: '1rem',
    height: '2.75rem',
    minHeight: '2.75rem',
    minWidth: '2.75rem',
    width: '2.75rem',
  },
  sm: {
    borderRadius: '0.75rem',
    height: '2.25rem',
    minHeight: '2.25rem',
    minWidth: '2.25rem',
    width: '2.25rem',
  },
});

export const buttonIcon = style({
  alignItems: 'center',
  display: 'inline-flex',
  flexShrink: 0,
  height: '1lh',
  justifyContent: 'center',
  width: '1lh',
});

export const buttonIconLeading = style([
  buttonIcon,
  {
    marginLeft: 'calc(var(--py) - var(--px))',
  },
]);

export const buttonIconTrailing = style([
  buttonIcon,
  {
    marginRight: 'calc(var(--py) - var(--px))',
  },
]);
