import { style, styleVariants } from '@vanilla-extract/css';
import { vars } from '../../styles/vars.css';

export const baseButton = style({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: '700',
  fontFamily: vars.font.sans,
  cursor: 'pointer',
  userSelect: 'none',
  boxSizing: 'border-box',
  outline: 'none',
  textDecoration: 'none',
  position: 'relative',
  verticalAlign: 'middle',
  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',

  selectors: {
    '&:disabled': {
      pointerEvents: 'none',
      opacity: 0.5,
    },
    '&:focus-visible': {
      outline: `2px solid ${vars.color.primary}`,
      outlineOffset: '2px',
    },
  },
});

export const sizeStyles = styleVariants({
  sm: {
    vars: {
      '--py': '0.5em',
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
    },
    minHeight: '2.25rem', // 36px
    borderRadius: '0.75rem', // 12px
    fontSize: '12px',
    lineHeight: '16px',
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    gap: '0.375rem',
  },
  md: {
    vars: {
      '--py': '0.875em',
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
    },
    minHeight: '2.75rem', // 44px
    borderRadius: '1rem', // 16px
    fontSize: '14px',
    lineHeight: '20px',
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    gap: '0.5rem',
  },
  lg: {
    vars: {
      '--py': '1.2em',
      '--px': 'calc(var(--py) + (1lh - 1cap) / 2)',
    },
    minHeight: '3.25rem', // 52px
    borderRadius: '1.25rem', // 20px
    fontSize: '16px',
    lineHeight: '24px',
    paddingBlock: 'var(--py)',
    paddingInline: 'var(--px)',
    gap: '0.625rem',
  },
});

export const variantStyles = styleVariants({
  primary: {
    background: `linear-gradient(90deg, ${vars.color.primary} 0%, #7a7eff 100%)`,
    color: vars.color.onPrimary,
    boxShadow: `0 10px 15px -3px rgba(79, 70, 229, 0.2), 0 0 10px rgba(79, 70, 229, 0.1)`,
    selectors: {
      '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: `0 12px 20px -3px rgba(79, 70, 229, 0.45), 0 0 15px rgba(79, 70, 229, 0.25)`,
        filter: 'brightness(1.1)',
      },
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
    },
  },
  secondary: {
    background: `linear-gradient(90deg, ${vars.color.secondaryContainer} 0%, #0b4b60 100%)`,
    color: vars.color.onSecondaryContainer,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: vars.color.outlineVariant,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    selectors: {
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: vars.color.outline,
        boxShadow: '0 6px 8px -1px rgba(0, 0, 0, 0.3)',
      },
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
    },
  },
  tonal: {
    background: `linear-gradient(90deg, ${vars.color.secondaryContainer} 0%, #0b4b60 100%)`,
    color: vars.color.onSecondaryContainer,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: vars.color.outlineVariant,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
    selectors: {
      '&:hover': {
        transform: 'translateY(-2px)',
        borderColor: vars.color.outline,
        boxShadow: '0 6px 8px -1px rgba(0, 0, 0, 0.3)',
      },
      '&:active': {
        transform: 'translateY(0) scale(0.97)',
      },
    },
  },
  outlined: {
    background: 'transparent',
    color: vars.color.onSurface,
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: vars.color.outline,
    selectors: {
      '&:hover': {
        borderColor: vars.color.primary,
        backgroundColor: 'rgba(79, 70, 229, 0.05)',
      },
      '&:active': {
        transform: 'scale(0.97)',
      },
    },
  },
  text: {
    background: 'transparent',
    color: vars.color.secondary,
    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(129, 140, 248, 0.1)',
      },
      '&:active': {
        transform: 'scale(0.97)',
      },
    },
  },
  icon: {
    background: 'transparent',
    color: vars.color.onSurfaceVariant,
    padding: 0,
    selectors: {
      '&:hover': {
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        color: vars.color.onSurface,
      },
      '&:active': {
        transform: 'scale(0.95)',
      },
    },
  },
});

export const iconSizeStyles = styleVariants({
  sm: {
    width: '2.25rem',
    height: '2.25rem',
    minWidth: '2.25rem',
    minHeight: '2.25rem',
    borderRadius: '0.75rem',
  },
  md: {
    width: '2.75rem',
    height: '2.75rem',
    minWidth: '2.75rem',
    minHeight: '2.75rem',
    borderRadius: '1rem',
  },
  lg: {
    width: '3.25rem',
    height: '3.25rem',
    minWidth: '3.25rem',
    minHeight: '3.25rem',
    borderRadius: '1.25rem',
  },
});

export const buttonIcon = style({
  width: '1lh',
  height: '1lh',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
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
