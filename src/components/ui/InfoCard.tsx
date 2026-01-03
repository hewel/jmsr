import type { JSX } from 'solid-js';
import { css } from '../../../styled-system/css';

interface InfoCardProps {
  label: string;
  children: JSX.Element;
}

/**
 * Small info card for displaying labeled values (e.g., status, server name).
 */
export default function InfoCard(props: InfoCardProps) {
  return (
    <div
      class={css({
        backgroundColor: 'surfaceContainerHigh/50',
        padding: '16px',
        borderRadius: '12px',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: 'outlineVariant/30',
      })}
    >
      <span
        class={css({
          textStyle: 'labelSmall',
          color: 'onSurfaceVariant',
          textTransform: 'uppercase',
          letterSpacing: 'wider',
          display: 'block',
          marginBottom: '4px',
        })}
      >
        {props.label}
      </span>
      {props.children}
    </div>
  );
}
