import type { JSX } from 'solid-js';
import { css, cx } from '../../../styled-system/css';
import { card } from '../../../styled-system/recipes';

type CardVariant = 'filled' | 'elevated' | 'outlined';

interface CardProps {
  variant?: CardVariant;
  class?: string;
  children: JSX.Element;
}

/**
 * M3 Card component with surface tint overlay.
 * @param variant - 'filled' (default), 'elevated', or 'outlined'
 */
export default function Card(props: CardProps) {
  const variant = () => props.variant ?? 'filled';

  return (
    <div
      class={cx(
        card({ variant: variant() }),
        css({ position: 'relative', overflow: 'hidden' }),
        props.class,
      )}
    >
      {/* Surface Tint Overlay for M3 elevation effect */}
      <div
        class={css({
          position: 'absolute',
          inset: 0,
          backgroundColor: 'primary/3',
          pointerEvents: 'none',
        })}
      />
      <div class={css({ position: 'relative', zIndex: 10 })}>
        {props.children}
      </div>
    </div>
  );
}
