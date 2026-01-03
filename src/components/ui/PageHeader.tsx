import type { JSX } from 'solid-js';
import { css } from '../../../styled-system/css';

interface PageHeaderProps {
  title: string;
  description?: string;
  trailing?: JSX.Element;
}

/**
 * Consistent page header with title, description, and optional trailing action.
 */
export default function PageHeader(props: PageHeaderProps) {
  return (
    <div
      class={css({
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: '16px',
      })}
    >
      <div>
        <h1
          class={css({
            textStyle: 'headlineLarge',
            color: 'onSurface',
            letterSpacing: 'tight',
          })}
        >
          {props.title}
        </h1>
        {props.description && (
          <p
            class={css({
              textStyle: 'bodyLarge',
              color: 'onSurfaceVariant',
              marginTop: '4px',
            })}
          >
            {props.description}
          </p>
        )}
      </div>
      {props.trailing}
    </div>
  );
}
