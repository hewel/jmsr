import { listen } from '@tauri-apps/api/event';
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import { css, cx } from '../../styled-system/css';
import { button, card } from '../../styled-system/recipes';

interface LogEntry {
  level: number;
  message: string;
}

const MAX_LOGS = 200;

const LogLevel: Record<number, { name: string; color: string }> = {
  1: { name: 'ERROR', color: 'error' },
  2: { name: 'WARN', color: 'secondary' },
  3: { name: 'INFO', color: 'primary' },
  4: { name: 'DEBUG', color: 'onSurfaceVariant' },
  5: { name: 'TRACE', color: 'outline' },
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
    return LogLevel[level]?.color ?? 'outline';
  };
  const getLevelName = (level: number) => {
    return LogLevel[level]?.name ?? 'UNKNOWN';
  };

  return (
    <div
      class={cx(
        card({ variant: 'outlined' }),
        css({ overflow: 'hidden', padding: 0 }),
      )}
    >
      {/* Header */}
      <button
        type="button"
        class={css({
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px',
          cursor: 'pointer',
          backgroundColor: 'transparent',
          border: 'none',
          color: 'inherit',
          _hover: {
            backgroundColor: 'surfaceContainerHigh/50',
          },
          transition: 'colors',
        })}
        onClick={toggleExpand}
      >
        <div
          class={css({ display: 'flex', alignItems: 'center', gap: '12px' })}
        >
          <div
            class={css({
              padding: '8px',
              backgroundColor: 'primary/10',
              borderRadius: '9999px',
              _groupHover: {
                backgroundColor: 'primary/20',
              },
              transition: 'colors',
            })}
          >
            <svg
              class={css({ width: '20px', height: '20px', color: 'primary' })}
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
            <h2
              class={css({
                textStyle: 'titleMedium',
                color: 'onSurface',
                textAlign: 'left',
              })}
            >
              Logs
            </h2>
            <div
              class={css({
                color: 'onSurfaceVariant',
                textStyle: 'labelSmall',
                marginTop: '2px',
                display: 'flex',
                gap: '8px',
              })}
            >
              <span>System events & debugging</span>
              <span
                class={css({
                  paddingX: '6px',
                  paddingY: '2px',
                  backgroundColor: 'surfaceContainerHighest',
                  borderRadius: '6px',
                  fontFamily: 'mono',
                })}
              >
                {logs().length} entries
              </span>
            </div>
          </div>
        </div>
        <svg
          class={css({
            width: '20px',
            height: '20px',
            color: 'onSurfaceVariant',
            transition: 'transform 0.3s',
            transform: expanded() ? 'rotate(180deg)' : 'rotate(0deg)',
          })}
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
        <div
          class={css({
            borderTopWidth: '1px',
            borderTopStyle: 'solid',
            borderTopColor: 'outlineVariant/30',
            animation: 'slideInFromTop 0.2s ease-out, fadeIn 0.2s ease-out',
          })}
        >
          {/* Toolbar */}
          <div
            class={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingX: '16px',
              paddingY: '8px',
              backgroundColor: 'surfaceContainerLow',
            })}
          >
            <div
              class={css({ display: 'flex', alignItems: 'center', gap: '8px' })}
            >
              <label
                class={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  textStyle: 'labelSmall',
                  color: 'onSurfaceVariant',
                  cursor: 'pointer',
                })}
              >
                <input
                  type="checkbox"
                  checked={autoScroll()}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  class={css({
                    borderRadius: '4px',
                    backgroundColor: 'surfaceContainerHigh',
                    borderColor: 'outlineVariant',
                    color: 'primary',
                  })}
                />
                Auto-scroll
              </label>
            </div>
            <button
              type="button"
              onClick={clearLogs}
              class={cx(
                button({ variant: 'text' }),
                css({
                  height: '32px',
                  minWidth: 0,
                  paddingX: '12px',
                  textStyle: 'labelSmall',
                }),
              )}
            >
              Clear
            </button>
          </div>

          {/* Log entries */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            class={css({
              height: '256px',
              overflowY: 'auto',
              backgroundColor: 'surfaceContainerLowest/50',
              fontFamily: 'mono',
              textStyle: 'bodySmall',
              padding: '8px',
            })}
          >
            <Show
              when={logs().length > 0}
              fallback={
                <p
                  class={css({
                    color: 'outline',
                    textAlign: 'center',
                    paddingY: '32px',
                  })}
                >
                  No logs yet. Logs from the Rust backend will appear here.
                </p>
              }
            >
              <For each={logs()}>
                {(log) => (
                  <div
                    class={css({
                      display: 'flex',
                      gap: '8px',
                      paddingX: '4px',
                      borderRadius: '4px',
                      _hover: {
                        backgroundColor: 'onSurface/5',
                      },
                    })}
                  >
                    <span
                      class={css({
                        flexShrink: 0,
                        width: '48px',
                      })}
                      style={{
                        color: `var(--colors-${getLevelColor(log.level)})`,
                      }}
                    >
                      {getLevelName(log.level)}
                    </span>
                    <span
                      class={css({
                        color: 'onSurfaceVariant',
                        wordBreak: 'break-all',
                      })}
                    >
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
