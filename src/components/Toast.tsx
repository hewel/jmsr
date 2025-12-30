import { onCleanup, onMount } from 'solid-js';

export type NotificationLevel = 'error' | 'warning' | 'info' | 'success';

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
        return 'bg-green-900/30 text-green-400 border-green-900/50';
      case 'error':
        return 'bg-red-900/30 text-red-400 border-red-900/50';
      case 'warning':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50';
      default:
        return 'bg-[#00a4dc]/20 text-[#00a4dc] border-[#00a4dc]/30';
    }
  };

  const getIcon = () => {
    switch (props.level) {
      case 'success':
        return (
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      case 'warning':
        return (
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      default:
        return (
          <svg
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
    }
  };

  return (
    <div
      class={`flex items-center w-full max-w-sm p-4 mb-4 rounded-lg shadow border backdrop-blur-sm animate-in slide-in-from-right duration-300 ${getStyles()}`}
      role="alert"
    >
      <div class="inline-flex items-center justify-center flex-shrink-0">
        {getIcon()}
      </div>
      <div class="ml-3 text-sm font-normal break-words flex-1">
        {props.message}
      </div>
      <button
        type="button"
        class="ml-auto -mx-1.5 -my-1.5 rounded-lg focus:ring-2 p-1.5 inline-flex h-8 w-8 hover:bg-white/10 transition-colors"
        onClick={() => props.onDismiss(props.id)}
        aria-label="Close"
      >
        <span class="sr-only">Close</span>
        <svg
          class="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
