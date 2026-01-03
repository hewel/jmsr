import type { JSX } from 'solid-js';
import { css, cx } from '../../../styled-system/css';
import { card } from '../../../styled-system/recipes';

interface SectionCardProps {
  icon: JSX.Element;
  title: string;
  children: JSX.Element;
  trailing?: JSX.Element;
}

/**
 * M3 Section Card with icon + title header.
 */
export default function SectionCard(props: SectionCardProps) {
  return (
    <div
      class={cx(
        card({ variant: 'filled' }),
        css({ position: 'relative', overflow: 'hidden' }),
      )}
    >
      <div
        class={css({
          position: 'absolute',
          inset: 0,
          backgroundColor: 'primary/3',
          pointerEvents: 'none',
        })}
      />
      <div class={css({ position: 'relative', zIndex: 10 })}>
        <div
          class={css({
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '24px',
          })}
        >
          <h2
            class={css({
              textStyle: 'titleMedium',
              color: 'primary',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            })}
          >
            {props.icon}
            {props.title}
          </h2>
          {props.trailing}
        </div>
        {props.children}
      </div>
    </div>
  );
}
