import { css, cx } from '../../../styled-system/css';

type StatusBadgeVariant = 'success' | 'warning' | 'error' | 'neutral';

interface StatusBadgeProps {
  variant?: StatusBadgeVariant;
  children: string;
}

/**
 * M3 Status Badge for displaying status indicators.
 */
export default function StatusBadge(props: StatusBadgeProps) {
  const variant = () => props.variant ?? 'neutral';

  const variantStyles = () => {
    switch (variant()) {
      case 'success':
        return css({
          backgroundColor: 'tertiaryContainer',
          color: 'onTertiaryContainer',
          borderColor: 'tertiary/20',
        });
      case 'warning':
        return css({
          backgroundColor: 'secondaryContainer',
          color: 'onSecondaryContainer',
          borderColor: 'secondary/20',
        });
      case 'error':
        return css({
          backgroundColor: 'errorContainer',
          color: 'onErrorContainer',
          borderColor: 'error/20',
        });
      default:
        return css({
          backgroundColor: 'surfaceContainerHighest',
          color: 'onSurfaceVariant',
          borderColor: 'outlineVariant',
        });
    }
  };

  return (
    <span
      class={cx(
        css({
          paddingX: '12px',
          paddingY: '4px',
          borderRadius: '9999px',
          textStyle: 'labelSmall',
          borderWidth: '1px',
          borderStyle: 'solid',
        }),
        variantStyles(),
      )}
    >
      {props.children}
    </span>
  );
}
