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
        return <Check class="w-5 h-5" />;
      case 'error':
        return <X class="w-5 h-5" />;
      case 'warning':
        return <TriangleAlert class="w-5 h-5" />;
      default:
        return <Info class="w-5 h-5" />;
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
        <X class="w-4 h-4" />
      </button>
    </div>
  );
}
