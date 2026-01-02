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
  1: { name: 'ERROR', color: 'text-error' },
  2: { name: 'WARN', color: 'text-secondary' },
  3: { name: 'INFO', color: 'text-primary' },
  4: { name: 'DEBUG', color: 'text-on-surface-variant' },
  5: { name: 'TRACE', color: 'text-outline' },
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
  };

  return (
    <div class="card-outlined overflow-hidden p-0">
      {/* Header */}
      <button
        type="button"
        class="w-full flex items-center justify-between p-4 hover:bg-surface-container-high/50 transition-colors group"
        onClick={toggleExpand}
      >
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary/10 rounded-full group-hover:bg-primary/20 transition-colors">
            <svg
              class="w-5 h-5 text-primary"
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
          </div>
          <div>
            <h2 class="text-title-medium text-on-surface text-left">Logs</h2>
            <div class="text-on-surface-variant text-label-small mt-0.5 flex gap-2">
              <span>System events & debugging</span>
              <span class="px-1.5 py-0.5 bg-surface-container-highest rounded-md font-mono">
                {logs().length} entries
              </span>
            </div>
          </div>
        </div>
        <svg
          class={`w-5 h-5 text-on-surface-variant transition-transform duration-300 ${expanded() ? 'rotate-180' : ''}`}
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
        <div class="border-t border-outline-variant/30 animate-in slide-in-from-top-2 fade-in duration-200">
          {/* Toolbar */}
          <div class="flex items-center justify-between px-4 py-2 bg-surface-container-low">
            <div class="flex items-center gap-2">
              <label class="flex items-center gap-1.5 text-label-small text-on-surface-variant cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll()}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  class="rounded bg-surface-container-high border-outline-variant text-primary focus:ring-primary/50"
                />
                Auto-scroll
              </label>
            </div>
            <button
              type="button"
              onClick={clearLogs}
              class="btn-text h-8 min-w-0 px-3 text-label-small"
            >
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            class="h-64 overflow-y-auto bg-surface-container-lowest/50 font-mono text-body-small p-2 space-y-0.5"
          >
            <Show
              when={logs().length > 0}
              fallback={
                <p class="text-outline text-center py-8">
                  No logs yet. Logs from the Rust backend will appear here.
                </p>
              }
            >
              <For each={logs()}>
                {(log) => (
                  <div class="flex gap-2 hover:bg-on-surface/5 px-1 rounded">
                    <span class={`shrink-0 w-12 ${getLevelColor(log.level)}`}>
                      {getLevelName(log.level)}
                    </span>
                    <span class="text-on-surface-variant break-all">
                      {log.message}
                    </span>
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
