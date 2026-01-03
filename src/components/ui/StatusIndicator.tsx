import { css } from '../../../styled-system/css';

interface StatusIndicatorProps {
  connected: boolean;
  connectedText?: string;
  disconnectedText?: string;
}

/**
 * Status indicator with glowing dot and text.
 */
export default function StatusIndicator(props: StatusIndicatorProps) {
  const connectedText = () => props.connectedText ?? 'Connected';
  const disconnectedText = () => props.disconnectedText ?? 'Disconnected';

  return (
    <div class={css({ display: 'flex', alignItems: 'center', gap: '8px' })}>
      <span
        class={css({
          width: '10px',
          height: '10px',
          borderRadius: '9999px',
          backgroundColor: props.connected ? 'tertiary' : 'error',
          boxShadow: props.connected
            ? '0 0 8px color-mix(in srgb, var(--colors-tertiary) 50%, transparent)'
            : 'none',
        })}
      />
      <span
        class={css({
          fontWeight: 'medium',
          color: props.connected ? 'onSurface' : 'error',
        })}
      >
        {props.connected ? connectedText() : disconnectedText()}
      </span>
    </div>
  );
}
