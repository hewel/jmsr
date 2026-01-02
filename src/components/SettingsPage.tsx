import { createForm } from '@tanstack/solid-form';
import { Cast, CircleCheckBig, Keyboard, Play, RefreshCw } from 'lucide-solid';
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
    <div class="min-h-screen bg-background p-6">
      <div class="max-w-2xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-2xl font-bold text-on-surface">Settings</h1>
            <p class="text-on-surface-variant text-sm mt-1">
              Manage your connection and preferences
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            class="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-colors"
            title="Refresh status"
          >
            <RefreshCw class="w-5 h-5" />
          </button>
        </div>

        {/* Jellyfin Connection Card */}
        <div class="bg-surface-container rounded-xl p-6 border border-outline-variant mb-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
            <CircleCheckBig class="w-5 h-5 text-primary" />
            Jellyfin Connection
          </h2>

          <Show
            when={!connectionState.loading}
            fallback={<p class="text-on-surface-variant">Loading...</p>}
          >
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-on-surface-variant">Status</span>
                <span
                  class={state()?.connected ? 'text-tertiary' : 'text-error'}
                >
                  {state()?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <Show when={state()?.serverName}>
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">Server</span>
                  <span class="text-on-surface">{state()?.serverName}</span>
                </div>
              </Show>

              <Show when={state()?.serverUrl}>
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">URL</span>
                  <span class="text-on-surface-variant text-sm truncate max-w-xs">
                    {state()?.serverUrl}
                  </span>
                </div>
              </Show>

              <Show when={state()?.userName}>
                <div class="flex items-center justify-between">
                  <span class="text-on-surface-variant">User</span>
                  <span class="text-on-surface">{state()?.userName}</span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* Settings Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void form.handleSubmit();
          }}
        >
          {/* Device Settings Card */}
          <div class="bg-surface-container rounded-xl p-6 border border-outline-variant mb-6">
            <h2 class="flex items-center gap-2 text-lg font-semibold text-on-surface mb-4">
              <Cast class="w-5 h-5 text-primary" />
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
                  <div>
                    <label
                      for={field().name}
                      class="block text-on-surface-variant text-sm mb-2"
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
                      class="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors"
                      placeholder="JMSR"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-error text-xs mt-1">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                    <p class="text-outline text-xs mt-1">
                      Name displayed in Jellyfin cast menu
                    </p>
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          {/* MPV Player Card */}
          <div class="bg-surface-container rounded-xl p-6 border border-outline-variant mb-6">
            <h2 class="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Play class="w-5 h-5 text-primary" />
              MPV Player
            </h2>

            <Show
              when={!mpvConnected.loading}
              fallback={<p class="text-on-surface-variant">Loading...</p>}
            >
              <div class="flex items-center justify-between mb-6">
                <span class="text-on-surface-variant">Status</span>
                <span
                  class={mpvConnected() ? 'text-tertiary' : 'text-secondary'}
                >
                  {mpvConnected() ? 'Running' : 'Not Started'}
                </span>
              </div>
            </Show>

            <div class="space-y-4 pt-6 border-t border-outline-variant/50">
              <form.Field name="mpvPath">
                {(field) => (
                  <div>
                    <label
                      for={field().name}
                      class="block text-on-surface-variant text-sm mb-2"
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
                        class="flex-1 bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleDetectMpv}
                        disabled={detectingMpv()}
                        class="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface-variant rounded-lg border border-outline-variant transition-colors disabled:opacity-50"
                      >
                        {detectingMpv() ? '...' : 'Auto-detect'}
                      </button>
                    </div>
                  </div>
                )}
              </form.Field>

              <form.Field name="mpvArgs">
                {(field) => (
                  <div>
                    <label
                      for={field().name}
                      class="block text-on-surface-variant text-sm mb-2"
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
                      class="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors font-mono text-sm"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          {/* Keybindings Card */}
          <div class="bg-surface-container rounded-xl p-6 border border-outline-variant mb-6">
            <h2 class="text-lg font-semibold text-on-surface mb-4 flex items-center gap-2">
              <Keyboard class="w-5 h-5 text-primary" />
              Keybindings
            </h2>

            <p class="text-on-surface-variant text-sm mb-4">
              Keyboard shortcuts for MPV episode navigation. Changes take effect
              on next MPV restart.
            </p>

            <div class="space-y-4">
              <form.Field
                name="keybindNext"
                validators={{
                  onChange: ({ value }) =>
                    !value.trim() ? 'Keybinding is required' : undefined,
                }}
              >
                {(field) => (
                  <div>
                    <label
                      for={field().name}
                      class="block text-on-surface-variant text-sm mb-2"
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
                      class="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors font-mono"
                      placeholder="Shift+n"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-error text-xs mt-1">
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
                  <div>
                    <label
                      for={field().name}
                      class="block text-on-surface-variant text-sm mb-2"
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
                      class="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors font-mono"
                      placeholder="Shift+p"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-error text-xs mt-1">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                  </div>
                )}
              </form.Field>
            </div>

            <p class="text-outline text-xs mt-4">
              Use MPV keybinding syntax (e.g., Shift+n, Ctrl+Left, Alt+q)
            </p>
          </div>

          {/* Save Settings Button */}
          <div class="mb-6">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class="w-full py-3 px-6 bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isSubmitting() ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </form.Subscribe>

            <Show when={saveMessage()}>
              <div
                class={`mt-3 p-3 rounded-lg text-sm text-center ${
                  saveMessage()?.type === 'success'
                    ? 'bg-tertiary-container/30 text-tertiary border border-tertiary-container/50'
                    : 'bg-error-container/30 text-error border border-error-container/50'
                }`}
              >
                {saveMessage()?.text}
              </div>
            </Show>
          </div>
        </form>

        {/* Actions Card */}
        <div class="bg-surface-container rounded-xl p-6 border border-outline-variant mb-6">
          <h2 class="text-lg font-semibold text-on-surface mb-4">Actions</h2>

          <div class="space-y-3">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting() || !state()?.connected}
              class="w-full py-3 px-6 bg-error/20 hover:bg-error/30 text-error font-medium rounded-lg border border-error/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disconnecting() ? 'Disconnecting...' : 'Disconnect from Server'}
            </button>

            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearingSession()}
              class="w-full py-3 px-6 bg-surface-container-high/50 hover:bg-surface-container-highest/50 text-on-surface-variant font-medium rounded-lg border border-outline-variant transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingSession() ? 'Clearing...' : 'Clear Saved Session'}
            </button>

            <p class="text-outline text-xs text-center">
              Clear saved session will remove stored credentials and return to
              login.
            </p>
          </div>
        </div>

        {/* Log Panel */}
        <LogPanel />

        {/* Version Footer */}
        <div class="mt-8 text-center">
          <p class="text-outline text-sm">JMSR - Jellyfin MPV Shim Rust</p>
          <AppVersion />
        </div>
      </div>
    </div>
  );
}
