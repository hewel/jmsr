import { Check, Info, TriangleAlert, X } from 'lucide-solid';
import { onCleanup, onMount } from 'solid-js';
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
        return 'bg-surface-container-high/90 text-on-surface border-tertiary/20 shadow-2xl backdrop-blur-md shadow-tertiary/5';
      case 'error':
        return 'bg-error-container/85 text-on-error-container border-error/25 shadow-2xl backdrop-blur-md shadow-error/10';
      case 'warning':
        return 'bg-warning-container/85 text-on-warning-container border-warning/25 shadow-2xl backdrop-blur-md shadow-warning/10';
      default:
        return 'bg-surface-container-high/90 text-on-surface border-outline-variant/60 shadow-2xl backdrop-blur-md';
    }
  };

  const getIcon = () => {
    switch (props.level) {
      case 'success':
        return <Check class="w-5 h-5 text-tertiary" />;
      case 'error':
        return <X class="w-5 h-5 text-error" />;
      case 'warning':
        return <TriangleAlert class="w-5 h-5 text-warning" />;
      default:
        return <Info class="w-5 h-5 text-primary" />;
    }
  };

  return (
    <div
      class={`flex items-center w-full max-w-sm p-4 mb-4 rounded-xl border animate-in slide-in-from-right duration-300 shadow-md pointer-events-auto ${getStyles()}`}
      role="alert"
    >
      <div class="inline-flex items-center justify-center flex-shrink-0">
        {getIcon()}
      </div>
      <div class="ml-3 text-body-medium font-normal break-words flex-1">
        {props.message}
      </div>
      <button
        type="button"
        class="ml-auto -mx-1.5 -my-1.5 rounded-full p-1.5 inline-flex h-8 w-8 hover:bg-on-surface/10 transition-colors items-center justify-center"
        onClick={() => props.onDismiss(props.id)}
        aria-label="Close"
      >
        <span class="sr-only">Close</span>
        <X class="w-4 h-4" />
      </button>
    </div>
  );
}
