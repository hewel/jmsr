import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  createContext,
  createSignal,
  For,
  onCleanup,
  onMount,
  type ParentProps,
  useContext,
} from 'solid-js';
import Toast, { type NotificationLevel } from './Toast';

export interface ToastMessage {
  id: string;
  level: NotificationLevel;
  message: string;
}

/** Payload from backend AppNotification event */
interface AppNotificationPayload {
  level: NotificationLevel;
  message: string;
}

interface ToastContextValue {
  showToast: (level: NotificationLevel, message: string) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>();

export function ToastProvider(props: ParentProps) {
  const [toasts, setToasts] = createSignal<ToastMessage[]>([]);
  let unlisten: UnlistenFn | undefined;

  const showToast = (level: NotificationLevel, message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, level, message }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Listen for backend AppNotification events
  onMount(async () => {
    try {
      unlisten = await listen<AppNotificationPayload>(
        'app-notification',
        (event) => {
          showToast(event.payload.level, event.payload.message);
        },
      );
    } catch (e) {
      console.error('Failed to listen for app notifications:', e);
    }
  });

  onCleanup(() => {
    unlisten?.();
  });

  return (
    <ToastContext.Provider value={{ showToast, removeToast }}>
      {props.children}
      <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <div class="pointer-events-auto">
          <For each={toasts()}>
            {(toast) => (
              <Toast
                id={toast.id}
                level={toast.level}
                message={toast.message}
                onDismiss={removeToast}
              />
            )}
          </For>
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
