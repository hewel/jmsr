import { listen } from '@tauri-apps/api/event';
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

interface LogEntry {
  level: number;
  message: string;
}

const MAX_LOGS = 200;

const LogLevel: Record<number, { name: string; color: string }> = {
  1: { name: 'ERROR', color: 'text-red-500' },
  2: { name: 'WARN', color: 'text-yellow-500' },
  3: { name: 'INFO', color: 'text-blue-500' },
  4: { name: 'DEBUG', color: 'text-gray-400' },
  5: { name: 'TRACE', color: 'text-gray-600' },
};

export default function LogPanel() {
  const [logs, setLogs] = createSignal<LogEntry[]>([]);
  const [expanded, setExpanded] = createSignal(false);
  const [autoScroll, setAutoScroll] = createSignal(true);
  let containerRef: HTMLDivElement | undefined;

  onMount(async () => {
    const unlisten = await listen<LogEntry>('log://log', (event) => {
      setLogs((prev) => [...prev.slice(-MAX_LOGS), event.payload]);
    });

    onCleanup(() => {
      unlisten();
    });
  });

  // Auto-scroll to bottom when new logs arrive
  createEffect(() => {
    if (autoScroll() && containerRef) {
      // Access logs() to create dependency
      logs();
      containerRef.scrollTop = containerRef.scrollHeight;
    }
  });

  // Handle expand/collapse with window resize
  const toggleExpand = async () => {
    setExpanded(!expanded());
  };

  const handleScroll = () => {
    if (containerRef) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef;
      // If user scrolls up, disable auto-scroll; if at bottom, enable it
      setAutoScroll(scrollTop + clientHeight >= scrollHeight - 10);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const getLevelColor = (level: number) => {
    return LogLevel[level]?.color ?? 'text-gray-400';
  };
  const getLevelName = (level: number) => {
    return LogLevel[level]?.name ?? 'UNKNOWN';
  }

  return (
    <div class="bg-surface-light rounded-xl border border-surface-lighter overflow-hidden">
      {/* Header */}
      <button
        type="button"
        class="w-full flex items-center justify-between p-4 hover:bg-surface-lighter/50 transition-colors"
        onClick={toggleExpand}
      >
        <div class="flex items-center gap-2">
          <svg
            class="w-5 h-5 text-jellyfin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h2 class="text-lg font-semibold text-white">Logs</h2>
          <span class="text-gray-500 text-sm">({logs().length})</span>
        </div>
        <svg
          class={`w-5 h-5 text-gray-400 transition-transform ${expanded() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Log content */}
      <Show when={expanded()}>
        <div class="border-t border-surface-lighter">
          {/* Toolbar */}
          <div class="flex items-center justify-between px-4 py-2 bg-surface/50">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll()}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  class="rounded bg-surface-lighter border-surface-lighter text-jellyfin focus:ring-jellyfin/50"
                />
                Auto-scroll
              </label>
            </div>
            <button
              type="button"
              onClick={clearLogs}
              class="text-xs text-gray-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-surface-lighter"
            >
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            class="h-64 overflow-y-auto bg-black/30 font-mono text-xs p-2 space-y-0.5"
          >
            <Show
              when={logs().length > 0}
              fallback={
                <p class="text-gray-500 text-center py-8">
                  No logs yet. Logs from the Rust backend will appear here.
                </p>
              }
            >
              <For each={logs()}>
                {(log) => (
                  <div class="flex gap-2 hover:bg-white/5 px-1 rounded">
                    <span
                      class={`shrink-0 w-12 ${getLevelColor(log.level)}`}
                    >
                      {getLevelName(log.level)}
                    </span>
                    <span class="text-gray-300 break-all">{log.message}</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </Show>
    </div>
  );
}
