import { Check, Info, TriangleAlert, X } from 'lucide-solid';
import { onCleanup, onMount } from 'solid-js';
import { css, cx } from '../../styled-system/css';
import type { NotificationLevel } from '../bindings';

export type { NotificationLevel };

interface ToastProps {
  id: string;
  level: NotificationLevel;
  message: string;
  onDismiss: (id: string) => void;
}

export default function Toast(props: ToastProps) {
  let timer: ReturnType<typeof setTimeout>;

  onMount(() => {
    timer = setTimeout(() => {
      props.onDismiss(props.id);
    }, 5000);
  });

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  const getStyles = () => {
    switch (props.level) {
      case 'success':
        return css({
          backgroundColor: 'surfaceContainerHigh',
          color: 'onSurface',
          borderColor: 'outlineVariant/30',
          boxShadow: 'lg',
        });
      case 'error':
        return css({
          backgroundColor: 'errorContainer',
          color: 'onErrorContainer',
          borderColor: 'transparent',
          boxShadow: 'lg',
        });
      case 'warning':
        return css({
          backgroundColor: 'secondaryContainer',
          color: 'onSecondaryContainer',
          borderColor: 'transparent',
          boxShadow: 'lg',
        });
      default:
        return css({
          backgroundColor: 'surfaceContainerHigh',
          color: 'onSurface',
          borderColor: 'outlineVariant/30',
          boxShadow: 'lg',
        });
    }
  };

  const getIcon = () => {
    const iconClass = css({ width: '20px', height: '20px' });
    switch (props.level) {
      case 'success':
        return <Check class={cx(iconClass, css({ color: 'tertiary' }))} />;
      case 'error':
        return <X class={iconClass} />;
      case 'warning':
        return <TriangleAlert class={iconClass} />;
      default:
        return <Info class={cx(iconClass, css({ color: 'primary' }))} />;
    }
  };

  return (
    <div
      class={cx(
        css({
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          maxWidth: '384px',
          padding: '16px',
          marginBottom: '16px',
          borderRadius: '12px',
          borderWidth: '1px',
          borderStyle: 'solid',
          animation: 'slideInFromRight 0.3s ease-out',
        }),
        getStyles(),
      )}
      role="alert"
    >
      <div
        class={css({
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        })}
      >
        {getIcon()}
      </div>
      <div
        class={css({
          marginLeft: '12px',
          textStyle: 'bodyMedium',
          fontWeight: 'normal',
          wordBreak: 'break-word',
          flex: 1,
        })}
      >
        {props.message}
      </div>
      <button
        type="button"
        class={css({
          marginLeft: 'auto',
          marginX: '-6px',
          marginY: '-6px',
          borderRadius: '9999px',
          padding: '6px',
          display: 'inline-flex',
          height: '32px',
          width: '32px',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'inherit',
          _hover: {
            backgroundColor: 'onSurface/10',
          },
          transition: 'colors',
        })}
        onClick={() => props.onDismiss(props.id)}
        aria-label="Close"
      >
        <span class={css({ srOnly: true })}>Close</span>
        <X class={css({ width: '16px', height: '16px' })} />
      </button>
    </div>
  );
}
