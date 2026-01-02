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
import { createEffect, createResource, createSignal, Show } from 'solid-js';
import { type AppConfig, type ConnectionState, commands } from '../bindings';
import { clearSavedSession } from '../router';
import AppVersion from './AppVersion';
import LogPanel from './LogPanel';
import { useToast } from './ToastProvider';

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
    <div class="min-h-screen bg-background p-6 md:p-10">
      <div class="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div class="flex items-center justify-between pb-4">
          <div>
            <h1 class="text-3xl font-bold text-on-surface tracking-tight">
              Settings
            </h1>
            <p class="text-on-surface-variant mt-1">
              Manage your connection and preferences
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            class="p-3 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-full transition-all duration-200 hover:rotate-180"
            title="Refresh status"
          >
            <RefreshCw class="w-6 h-6" />
          </button>
        </div>

        {/* Jellyfin Connection Card */}
        <div class="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden group">
          <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
          <div class="relative z-10">
            <h2 class="text-lg font-medium text-primary mb-6 flex items-center gap-3">
              <CircleCheckBig class="w-6 h-6" />
              Jellyfin Connection
            </h2>

            <Show
              when={!connectionState.loading}
              fallback={
                <div class="animate-pulse h-24 bg-surface-container-high rounded-xl"></div>
              }
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant/30">
                  <span class="text-xs font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                    Status
                  </span>
                  <div class="flex items-center gap-2">
                    <span
                      class={`w-2.5 h-2.5 rounded-full ${state()?.connected ? 'bg-tertiary shadow-[0_0_8px_rgba(var(--color-tertiary),0.5)]' : 'bg-error'}`}
                    ></span>
                    <span
                      class={`font-medium ${state()?.connected ? 'text-on-surface' : 'text-error'}`}
                    >
                      {state()?.connected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                </div>

                <Show when={state()?.serverName}>
                  <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant/30">
                    <span class="text-xs font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                      Server
                    </span>
                    <span
                      class="text-on-surface font-medium truncate block"
                      title={state()?.serverName ?? ''}
                    >
                      {state()?.serverName}
                    </span>
                  </div>
                </Show>

                <Show when={state()?.serverUrl}>
                  <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant/30">
                    <span class="text-xs font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                      URL
                    </span>
                    <span
                      class="text-on-surface font-medium truncate block"
                      title={state()?.serverUrl ?? ''}
                    >
                      {state()?.serverUrl}
                    </span>
                  </div>
                </Show>

                <Show when={state()?.userName}>
                  <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant/30">
                    <span class="text-xs font-medium text-on-surface-variant uppercase tracking-wider block mb-1">
                      User
                    </span>
                    <span
                      class="text-on-surface font-medium truncate block"
                      title={state()?.userName ?? ''}
                    >
                      {state()?.userName}
                    </span>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        {/* Settings Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
          class="space-y-6"
        >
          {/* Device Settings Card */}
          <div class="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden">
            <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
            <div class="relative z-10">
              <h2 class="flex items-center gap-3 text-lg font-medium text-primary mb-6">
                <Cast class="w-6 h-6" />
                Device Settings
              </h2>
              <div class="space-y-4">
                <form.Field
                  name="deviceName"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? 'Device name is required' : undefined,
                  }}
                >
                  {(field) => (
                    <div class="group">
                      <label
                        for={field().name}
                        class="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors"
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
                        class="w-full bg-surface-container-high border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                        placeholder="JMSR"
                      />
                      <Show when={field().state.meta.errors.length > 0}>
                        <p class="text-error text-xs mt-1.5 ml-1">
                          {field().state.meta.errors[0]}
                        </p>
                      </Show>
                      <p class="text-on-surface-variant/70 text-xs mt-1.5 ml-1">
                        Name displayed in Jellyfin cast menu
                      </p>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          </div>

          {/* MPV Player Card */}
          <div class="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden">
            <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
            <div class="relative z-10">
              <div class="flex items-center justify-between mb-6">
                <h2 class="text-lg font-medium text-primary flex items-center gap-3">
                  <Play class="w-6 h-6" />
                  MPV Player
                </h2>
                <Show when={!mpvConnected.loading}>
                  <span
                    class={`px-3 py-1 rounded-full text-xs font-medium border ${
                      mpvConnected()
                        ? 'bg-tertiary-container text-on-tertiary-container border-tertiary/20'
                        : 'bg-surface-container-highest text-on-surface-variant border-outline-variant'
                    }`}
                  >
                    {mpvConnected() ? 'Running' : 'Not Started'}
                  </span>
                </Show>
              </div>

              <div class="space-y-6">
                <form.Field name="mpvPath">
                  {(field) => (
                    <div class="group">
                      <label
                        for={field().name}
                        class="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors"
                      >
                        MPV Executable Path
                      </label>
                      <div class="flex gap-2">
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
                          class="flex-1 bg-surface-container-high border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200"
                        />
                        <button
                          type="button"
                          onClick={handleDetectMpv}
                          disabled={detectingMpv()}
                          class="px-5 py-3 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-95"
                        >
                          {detectingMpv() ? '...' : 'Auto-detect'}
                        </button>
                      </div>
                    </div>
                  )}
                </form.Field>

                <form.Field name="mpvArgs">
                  {(field) => (
                    <div class="group">
                      <label
                        for={field().name}
                        class="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors"
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
                        class="w-full bg-surface-container-high border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 font-mono text-sm leading-relaxed"
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            </div>
          </div>

          {/* Keybindings Card */}
          <div class="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden">
            <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
            <div class="relative z-10">
              <h2 class="text-lg font-medium text-primary mb-2 flex items-center gap-3">
                <Keyboard class="w-6 h-6" />
                Keybindings
              </h2>

              <p class="text-on-surface-variant/80 text-sm mb-6 ml-9">
                Keyboard shortcuts for MPV episode navigation. Changes take
                effect on next MPV restart.
              </p>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <form.Field
                  name="keybindNext"
                  validators={{
                    onChange: ({ value }) =>
                      !value.trim() ? 'Keybinding is required' : undefined,
                  }}
                >
                  {(field) => (
                    <div class="group">
                      <label
                        for={field().name}
                        class="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors"
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
                        class="w-full bg-surface-container-high border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 font-mono text-center"
                        placeholder="Shift+n"
                      />
                      <Show when={field().state.meta.errors.length > 0}>
                        <p class="text-error text-xs mt-1.5 ml-1">
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
                    <div class="group">
                      <label
                        for={field().name}
                        class="block text-xs font-medium text-on-surface-variant mb-1.5 ml-1 uppercase tracking-wider group-focus-within:text-primary transition-colors"
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
                        class="w-full bg-surface-container-high border border-outline-variant/50 rounded-xl px-4 py-3 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 font-mono text-center"
                        placeholder="Shift+p"
                      />
                      <Show when={field().state.meta.errors.length > 0}>
                        <p class="text-error text-xs mt-1.5 ml-1">
                          {field().state.meta.errors[0]}
                        </p>
                      </Show>
                    </div>
                  )}
                </form.Field>
              </div>

              <p class="text-on-surface-variant/60 text-xs mt-6 text-center border-t border-outline-variant/20 pt-4">
                Use MPV keybinding syntax (e.g., Shift+n, Ctrl+Left, Alt+q)
              </p>
            </div>
          </div>

          {/* Save Settings Button */}
          <div class="sticky bottom-6 z-20">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class="w-full py-4 px-6 bg-primary hover:bg-primary/90 text-on-primary hover:text-on-primary font-bold rounded-full shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] backdrop-blur-md"
                >
                  {isSubmitting() ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </form.Subscribe>

            <Show when={saveMessage()}>
              <div
                class={`mt-4 p-4 rounded-xl text-sm font-medium text-center animate-in slide-in-from-bottom-2 fade-in duration-300 ${
                  saveMessage()?.type === 'success'
                    ? 'bg-tertiary-container text-on-tertiary-container'
                    : 'bg-error-container text-on-error-container'
                }`}
              >
                {saveMessage()?.text}
              </div>
            </Show>
          </div>
        </form>

        {/* Actions Card */}
        <div class="bg-surface-container rounded-3xl p-6 shadow-sm border border-outline-variant/30 relative overflow-hidden">
          <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
          <div class="relative z-10">
            <h2 class="text-lg font-medium text-on-surface mb-6">
              Danger Zone
            </h2>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={disconnecting() || !state()?.connected}
                class="flex items-center justify-center gap-2 py-3 px-6 bg-surface-container-high hover:bg-error/20 text-error font-medium rounded-xl border border-outline-variant/50 hover:border-error/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <LogOut class="w-5 h-5" />
                {disconnecting() ? 'Disconnecting...' : 'Disconnect'}
              </button>

              <button
                type="button"
                onClick={handleClearSession}
                disabled={clearingSession()}
                class="flex items-center justify-center gap-2 py-3 px-6 bg-surface-container-high hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface font-medium rounded-xl border border-outline-variant/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 class="w-5 h-5" />
                {clearingSession() ? 'Clearing...' : 'Clear Session'}
              </button>
            </div>
            <p class="text-on-surface-variant/60 text-xs mt-4 text-center">
              Clear saved session will remove stored credentials and return to
              login
            </p>
          </div>
        </div>

        {/* Log Panel */}
        <LogPanel />

        {/* Version Footer */}
        <div class="py-8 text-center">
          <p class="text-on-surface-variant/70 text-sm">
            JMSR - Jellyfin MPV Shim Rust
          </p>
          <AppVersion />
        </div>
      </div>
    </div>
  );
}
