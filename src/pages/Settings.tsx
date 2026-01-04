import { createForm } from '@tanstack/solid-form';
import {
  Cast,
  CircleCheckBig,
  Keyboard,
  LogOut,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-solid';
import {
  createEffect,
  createResource,
  createSignal,
  Show,
} from 'solid-js';
import { css, cx } from '../../styled-system/css';
import { button, card, input } from '../../styled-system/recipes';
import { type AppConfig, type ConnectionState, commands } from '../bindings';
import LogPanel from '../components/LogPanel';
import { useToast } from '../components/ToastProvider';
import {
  InfoCard,
  PageFooter,
  PageHeader,
  SectionCard,
  StatusBadge,
  StatusIndicator,
} from '../components/ui';
import { clearSavedSession } from '../router';

interface SettingsPageProps {
  onDisconnected: () => void;
}

async function fetchConnectionState(): Promise<ConnectionState> {
  return await commands.jellyfinGetState();
}

async function fetchMpvStatus(): Promise<boolean> {
  return await commands.mpvIsConnected();
}

export default function SettingsPage(props: SettingsPageProps) {
  const { showToast } = useToast();
  const [disconnecting, setDisconnecting] = createSignal(false);
  const [clearingSession, setClearingSession] = createSignal(false);
  const [detectingMpv, setDetectingMpv] = createSignal(false);
  const [saveMessage, setSaveMessage] = createSignal<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [connectionState, { refetch: refetchConnection }] =
    createResource(fetchConnectionState);
  const [mpvConnected, { refetch: refetchMpv }] =
    createResource(fetchMpvStatus);

  // Load initial configuration
  const [initialConfig] = createResource(async () => {
    try {
      return await commands.configGet();
    } catch (e) {
      console.error('Failed to load config:', e);
      return null;
    }
  });

  // Create form with @tanstack/solid-form
  const form = createForm(() => ({
    defaultValues: {
      deviceName: 'JMSR',
      mpvPath: '',
      mpvArgs: '',
      keybindNext: 'Shift+n',
      keybindPrev: 'Shift+p',
    },
    onSubmit: async ({ value }) => {
      setSaveMessage(null);
      try {
        const cfg = initialConfig();

        const argsList = value.mpvArgs
          .split('\n')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);

        const newConfig: AppConfig = {
          deviceName: value.deviceName,
          mpvPath: value.mpvPath || null,
          mpvArgs: argsList,
          progressInterval: cfg?.progressInterval ?? 5,
          startMinimized: cfg?.startMinimized ?? false,
          keybindNext: value.keybindNext,
          keybindPrev: value.keybindPrev,
        };

        const result = await commands.configSet(newConfig);
        if (result.status === 'ok') {
          setSaveMessage({
            type: 'success',
            text: 'Settings saved successfully',
          });
          setTimeout(() => setSaveMessage(null), 3000);
        } else {
          setSaveMessage({ type: 'error', text: result.error.message });
        }
      } catch (e) {
        setSaveMessage({ type: 'error', text: String(e) });
      }
    },
  }));

  // Update form values when config is loaded
  createEffect(() => {
    const cfg = initialConfig();
    if (cfg) {
      form.setFieldValue('deviceName', cfg.deviceName ?? 'JMSR');
      form.setFieldValue('mpvPath', cfg.mpvPath ?? '');
      form.setFieldValue('mpvArgs', (cfg.mpvArgs ?? []).join('\n'));
      form.setFieldValue('keybindNext', cfg.keybindNext ?? 'Shift+n');
      form.setFieldValue('keybindPrev', cfg.keybindPrev ?? 'Shift+p');
    }
  });

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await commands.jellyfinDisconnect();
      if (result.status === 'ok') {
        clearSavedSession();
        props.onDisconnected();
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleClearSession = async () => {
    setClearingSession(true);
    try {
      await commands.jellyfinClearSession();
      clearSavedSession();
      props.onDisconnected();
    } finally {
      setClearingSession(false);
    }
  };

  const handleRefresh = () => {
    refetchConnection();
    refetchMpv();
  };

  const handleDetectMpv = async () => {
    setDetectingMpv(true);
    try {
      const path = await commands.configDetectMpv();
      if (path) {
        form.setFieldValue('mpvPath', path);
        showToast('success', 'MPV detected successfully');
      } else {
        showToast(
          'warning',
          'MPV not found in PATH. Please specify path manually.',
        );
      }
    } catch (e) {
      console.error('Failed to detect MPV:', e);
      showToast('error', 'Failed to detect MPV');
    } finally {
      setDetectingMpv(false);
    }
  };

  const state = () => connectionState();

  return (
    <div
      class={css({
        minHeight: '100vh',
        backgroundColor: 'background',
        padding: '24px',
        md: { padding: '40px' },
      })}
    >
      <div
        class={css({
          maxWidth: '768px',
          marginX: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        })}
      >
        {/* Header */}
        <PageHeader
          title="Settings"
          description="Manage your connection and preferences"
          trailing={
            <button
              type="button"
              onClick={handleRefresh}
              class={cx(
                button({ variant: 'icon' }),
                css({
                  _hover: { transform: 'rotate(180deg)' },
                  transition: 'transform 0.3s',
                }),
              )}
              title="Refresh status"
            >
              <RefreshCw class={css({ width: '24px', height: '24px' })} />
            </button>
          }
        />

        {/* Jellyfin Connection Card */}
        <SectionCard
          icon={
            <CircleCheckBig class={css({ width: '24px', height: '24px' })} />
          }
          title="Jellyfin Connection"
        >
          <Show
            when={!connectionState.loading}
            fallback={
              <div
                class={css({
                  animation: 'pulse 2s infinite',
                  height: '96px',
                  backgroundColor: 'surfaceContainerHigh',
                  borderRadius: '12px',
                })}
              />
            }
          >
            <div
              class={css({
                display: 'grid',
                gridTemplateColumns: '1fr',
                md: { gridTemplateColumns: 'repeat(2, 1fr)' },
                gap: '16px',
              })}
            >
              <InfoCard label="Status">
                <StatusIndicator connected={state()?.connected ?? false} />
              </InfoCard>

              <Show when={state()?.serverName}>
                <InfoCard label="Server">
                  <span
                    class={css({
                      color: 'onSurface',
                      fontWeight: 'medium',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    })}
                    title={state()?.serverName ?? ''}
                  >
                    {state()?.serverName}
                  </span>
                </InfoCard>
              </Show>

              <Show when={state()?.serverUrl}>
                <InfoCard label="URL">
                  <span
                    class={css({
                      color: 'onSurface',
                      fontWeight: 'medium',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    })}
                    title={state()?.serverUrl ?? ''}
                  >
                    {state()?.serverUrl}
                  </span>
                </InfoCard>
              </Show>

              <Show when={state()?.userName}>
                <InfoCard label="User">
                  <span
                    class={css({
                      color: 'onSurface',
                      fontWeight: 'medium',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      display: 'block',
                    })}
                    title={state()?.userName ?? ''}
                  >
                    {state()?.userName}
                  </span>
                </InfoCard>
              </Show>
            </div>
          </Show>
        </SectionCard>

        {/* Settings Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          class={css({ display: 'flex', flexDirection: 'column', gap: '24px' })}
        >
          {/* Device Settings Card */}
          <SectionCard
            icon={<Cast class={css({ width: '24px', height: '24px' })} />}
            title="Device Settings"
          >
            <div
              class={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              })}
            >
              <form.Field
                name="deviceName"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? 'Device name is required' : undefined,
                }}
              >
                {(field) => (
                  <div
                    class={css({
                      _focusWithin: { '& label': { color: 'primary' } },
                    })}
                  >
                    <label
                      for={field().name}
                      class={css({
                        display: 'block',
                        textStyle: 'labelSmall',
                        color: 'onSurfaceVariant',
                        marginBottom: '6px',
                        marginLeft: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'colors',
                      })}
                    >
                      Device Name
                    </label>
                    <input
                      id={field().name}
                      name={field().name}
                      type="text"
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={() => field().handleBlur()}
                      class={input({ variant: 'filled' })}
                      placeholder="JMSR"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p
                        class={css({
                          color: 'error',
                          textStyle: 'bodySmall',
                          marginTop: '6px',
                          marginLeft: '4px',
                        })}
                      >
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                    <p
                      class={css({
                        color: 'onSurfaceVariant/70',
                        textStyle: 'bodySmall',
                        marginTop: '6px',
                        marginLeft: '4px',
                      })}
                    >
                      Name displayed in Jellyfin cast menu
                    </p>
                  </div>
                )}
              </form.Field>
            </div>
          </SectionCard>

          {/* MPV Player Card */}
          <SectionCard
            icon={<Play class={css({ width: '24px', height: '24px' })} />}
            title="MPV Player"
            trailing={
              <Show when={!mpvConnected.loading}>
                <StatusBadge variant={mpvConnected() ? 'success' : 'neutral'}>
                  {mpvConnected() ? 'Running' : 'Not Started'}
                </StatusBadge>
              </Show>
            }
          >
            <div
              class={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              })}
            >
              <form.Field name="mpvPath">
                {(field) => (
                  <div
                    class={css({
                      _focusWithin: { '& label': { color: 'primary' } },
                    })}
                  >
                    <label
                      for={field().name}
                      class={css({
                        display: 'block',
                        textStyle: 'labelSmall',
                        color: 'onSurfaceVariant',
                        marginBottom: '6px',
                        marginLeft: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'colors',
                      })}
                    >
                      MPV Executable Path
                    </label>
                    <div
                      class={css({
                        display: 'flex',
                        gap: '8px',
                        alignItems: 'flex-start',
                      })}
                    >
                      <input
                        id={field().name}
                        name={field().name}
                        type="text"
                        value={field().state.value}
                        onInput={(e) =>
                          field().handleChange(e.currentTarget.value)
                        }
                        onBlur={() => field().handleBlur()}
                        placeholder="Path to mpv.exe or mpv binary"
                        class={cx(
                          input({ variant: 'filled' }),
                          css({ flex: 1, minWidth: 0 }),
                        )}
                      />
                      <button
                        type="button"
                        onClick={handleDetectMpv}
                        disabled={detectingMpv()}
                        class={cx(
                          button({ variant: 'tonal' }),
                          css({ height: '56px' }),
                        )}
                      >
                        {detectingMpv() ? '...' : 'Auto-detect'}
                      </button>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="mpvArgs">
                {(field) => (
                  <div
                    class={css({
                      _focusWithin: { '& label': { color: 'primary' } },
                    })}
                  >
                    <label
                      for={field().name}
                      class={css({
                        display: 'block',
                        textStyle: 'labelSmall',
                        color: 'onSurfaceVariant',
                        marginBottom: '6px',
                        marginLeft: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'colors',
                      })}
                    >
                      Extra Arguments (one per line)
                    </label>
                    <textarea
                      id={field().name}
                      name={field().name}
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={() => field().handleBlur()}
                      rows={4}
                      placeholder="--fullscreen&#10;--force-window"
                      class={css({
                        width: '100%',
                        backgroundColor: 'surfaceContainerHighest',
                        borderTopLeftRadius: '8px',
                        borderTopRightRadius: '8px',
                        borderBottomWidth: '1px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: 'onSurfaceVariant',
                        paddingX: '16px',
                        paddingY: '12px',
                        color: 'onSurface',
                        fontFamily: 'mono',
                        textStyle: 'bodySmall',
                        lineHeight: 'relaxed',
                        outline: 'none',
                        transition: 'colors',
                        _placeholder: { color: 'onSurfaceVariant' },
                        _focus: {
                          borderBottomWidth: '2px',
                          borderBottomColor: 'primary',
                        },
                      })}
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </SectionCard>

          {/* Keybindings Card */}
          <SectionCard
            icon={<Keyboard class={css({ width: '24px', height: '24px' })} />}
            title="Keybindings"
          >
            <p
              class={css({
                color: 'onSurfaceVariant/80',
                textStyle: 'bodyMedium',
                marginBottom: '24px',
                marginTop: '-16px',
                marginLeft: '36px',
              })}
            >
              Keyboard shortcuts for MPV episode navigation. Changes take effect
              on next MPV restart.
            </p>

            <div
              class={css({
                display: 'grid',
                gridTemplateColumns: '1fr',
                md: { gridTemplateColumns: 'repeat(2, 1fr)' },
                gap: '24px',
              })}
            >
              <form.Field
                name="keybindNext"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? 'Keybinding is required' : undefined,
                }}
              >
                {(field) => (
                  <div
                    class={css({
                      _focusWithin: { '& label': { color: 'primary' } },
                    })}
                  >
                    <label
                      for={field().name}
                      class={css({
                        display: 'block',
                        textStyle: 'labelSmall',
                        color: 'onSurfaceVariant',
                        marginBottom: '6px',
                        marginLeft: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'colors',
                      })}
                    >
                      Next Episode
                    </label>
                    <input
                      id={field().name}
                      name={field().name}
                      type="text"
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={() => field().handleBlur()}
                      class={cx(
                        input({ variant: 'filled' }),
                        css({ fontFamily: 'mono', textAlign: 'center' }),
                      )}
                      placeholder="Shift+n"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p
                        class={css({
                          color: 'error',
                          textStyle: 'bodySmall',
                          marginTop: '6px',
                          marginLeft: '4px',
                        })}
                      >
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </div>
                )}
              </form.Field>

              <form.Field
                name="keybindPrev"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? 'Keybinding is required' : undefined,
                }}
              >
                {(field) => (
                  <div
                    class={css({
                      _focusWithin: { '& label': { color: 'primary' } },
                    })}
                  >
                    <label
                      for={field().name}
                      class={css({
                        display: 'block',
                        textStyle: 'labelSmall',
                        color: 'onSurfaceVariant',
                        marginBottom: '6px',
                        marginLeft: '4px',
                        textTransform: 'uppercase',
                        letterSpacing: 'wider',
                        transition: 'colors',
                      })}
                    >
                      Previous Episode
                    </label>
                    <input
                      id={field().name}
                      name={field().name}
                      type="text"
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={() => field().handleBlur()}
                      class={cx(
                        input({ variant: 'filled' }),
                        css({ fontFamily: 'mono', textAlign: 'center' }),
                      )}
                      placeholder="Shift+p"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p
                        class={css({
                          color: 'error',
                          textStyle: 'bodySmall',
                          marginTop: '6px',
                          marginLeft: '4px',
                        })}
                      >
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </div>
                )}
              </form.Field>
            </div>

            <p
              class={css({
                color: 'onSurfaceVariant/60',
                textStyle: 'bodySmall',
                marginTop: '24px',
                textAlign: 'center',
                borderTopWidth: '1px',
                borderTopStyle: 'solid',
                borderTopColor: 'outlineVariant/20',
                paddingTop: '16px',
              })}
            >
              Use MPV keybinding syntax (e.g., Shift+n, Ctrl+Left, Alt+q)
            </p>
          </SectionCard>

          {/* Save Settings Button */}
          <div class={css({ position: 'sticky', bottom: '24px', zIndex: 20 })}>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class={cx(
                    button({ variant: 'primary' }),
                    css({
                      width: '100%',
                      height: '56px',
                      textStyle: 'titleMedium',
                      boxShadow: 'lg',
                      _hover: {
                        boxShadow: 'xl',
                        transform: 'translateY(-4px)',
                      },
                      _active: {
                        transform: 'translateY(0) scale(0.99)',
                      },
                      backdropFilter: 'blur(12px)',
                    }),
                  )}
                >
                  {isSubmitting() ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </form.Subscribe>

            <Show when={saveMessage()}>
              <div
                class={cx(
                  css({
                    marginTop: '16px',
                    padding: '16px',
                    borderRadius: '12px',
                    textStyle: 'bodyMedium',
                    fontWeight: 'medium',
                    textAlign: 'center',
                    animation:
                      'slideInFromBottom 0.3s ease-out, fadeIn 0.3s ease-out',
                  }),
                  saveMessage()?.type === 'success'
                    ? css({
                        backgroundColor: 'tertiaryContainer',
                        color: 'onTertiaryContainer',
                      })
                    : css({
                        backgroundColor: 'errorContainer',
                        color: 'onErrorContainer',
                      }),
                )}
              >
                {saveMessage()?.text}
              </div>
            </Show>
          </div>
        </form>

        {/* Actions Card */}
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
            <h2
              class={css({
                textStyle: 'titleMedium',
                color: 'onSurface',
                marginBottom: '24px',
              })}
            >
              Danger Zone
            </h2>

            <div
              class={css({
                display: 'grid',
                gridTemplateColumns: '1fr',
                md: { gridTemplateColumns: 'repeat(2, 1fr)' },
                gap: '16px',
              })}
            >
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting() || !state()?.connected}
                class={cx(
                  button({ variant: 'outlined' }),
                  css({
                    borderColor: 'error/50',
                    color: 'error',
                    width: '100%',
                    _hover: {
                      backgroundColor: 'error/10',
                      borderColor: 'error',
                    },
                  }),
                )}
              >
                <LogOut class={css({ width: '20px', height: '20px' })} />
                {disconnecting() ? 'Disconnecting...' : 'Disconnect'}
              </button>

              <button
                type="button"
                onClick={handleClearSession}
                disabled={clearingSession()}
                class={cx(button({ variant: 'tonal' }), css({ width: '100%' }))}
              >
                <Trash2 class={css({ width: '20px', height: '20px' })} />
                {clearingSession() ? 'Clearing...' : 'Clear Session'}
              </button>
            </div>
            <p
              class={css({
                color: 'onSurfaceVariant/60',
                textStyle: 'bodySmall',
                marginTop: '16px',
                textAlign: 'center',
              })}
            >
              Clear saved session will remove stored credentials and return to
              login
            </p>
          </div>
        </div>

        {/* Log Panel */}
        <LogPanel />

        {/* Version Footer */}
        <PageFooter />
      </div>
    </div>
  );
}
