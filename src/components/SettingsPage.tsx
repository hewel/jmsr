import { createForm } from '@tanstack/solid-form';
import { createEffect, createResource, createSignal, Show } from 'solid-js';
import { type AppConfig, type ConnectionState, commands } from '../bindings';
import { clearSavedSession } from '../router';
import LogPanel from './LogPanel';

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
        };

        const result = await commands.configSet(newConfig);
        if (result.status === 'ok') {
          setSaveMessage({
            type: 'success',
            text: 'Settings saved successfully',
          });
          setTimeout(() => setSaveMessage(null), 3000);
        } else {
          setSaveMessage({ type: 'error', text: result.error });
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
      }
    } catch (e) {
      console.error('Failed to detect MPV:', e);
    } finally {
      setDetectingMpv(false);
    }
  };

  const state = () => connectionState();

  return (
    <div class="min-h-screen bg-surface p-6">
      <div class="max-w-2xl mx-auto">
        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-2xl font-bold text-white">Settings</h1>
            <p class="text-gray-400 text-sm mt-1">
              Manage your connection and preferences
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            class="p-2 text-gray-400 hover:text-white hover:bg-surface-lighter rounded-lg transition-colors"
            title="Refresh status"
          >
            <svg
              class="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              role="img"
              aria-label="Refresh"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Jellyfin Connection Card */}
        <div class="bg-surface-light rounded-xl p-6 border border-surface-lighter mb-6">
          <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <svg
              class="w-5 h-5 text-jellyfin"
              fill="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            Jellyfin Connection
          </h2>

          <Show
            when={!connectionState.loading}
            fallback={<p class="text-gray-400">Loading...</p>}
          >
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <span class="text-gray-400">Status</span>
                <span
                  class={state()?.connected ? 'text-green-400' : 'text-red-400'}
                >
                  {state()?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <Show when={state()?.serverName}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">Server</span>
                  <span class="text-white">{state()?.serverName}</span>
                </div>
              </Show>

              <Show when={state()?.serverUrl}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">URL</span>
                  <span class="text-gray-300 text-sm truncate max-w-xs">
                    {state()?.serverUrl}
                  </span>
                </div>
              </Show>

              <Show when={state()?.userName}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">User</span>
                  <span class="text-white">{state()?.userName}</span>
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
          <div class="bg-surface-light rounded-xl p-6 border border-surface-lighter mb-6">
            <h2 class="text-lg font-semibold text-white mb-4">
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
                      class="block text-gray-400 text-sm mb-2"
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
                      class="w-full bg-surface-lighter border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-jellyfin transition-colors"
                      placeholder="JMSR"
                    />
                    <Show when={field().state.meta.errors.length > 0}>
                      <p class="text-red-400 text-xs mt-1">
                        {field().state.meta.errors[0]}
                      </p>
                    </Show>
                    <p class="text-gray-500 text-xs mt-1">
                      Name displayed in Jellyfin cast menu
                    </p>
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          {/* MPV Player Card */}
          <div class="bg-surface-light rounded-xl p-6 border border-surface-lighter mb-6">
            <h2 class="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg
                class="w-5 h-5 text-jellyfin"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
              MPV Player
            </h2>

            <Show
              when={!mpvConnected.loading}
              fallback={<p class="text-gray-400">Loading...</p>}
            >
              <div class="flex items-center justify-between mb-6">
                <span class="text-gray-400">Status</span>
                <span
                  class={mpvConnected() ? 'text-green-400' : 'text-yellow-400'}
                >
                  {mpvConnected() ? 'Running' : 'Not Started'}
                </span>
              </div>
            </Show>

            <div class="space-y-4 pt-6 border-t border-gray-700/50">
              <form.Field name="mpvPath">
                {(field) => (
                  <div>
                    <label
                      for={field().name}
                      class="block text-gray-400 text-sm mb-2"
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
                        class="flex-1 bg-surface-lighter border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-jellyfin transition-colors"
                      />
                      <button
                        type="button"
                        onClick={handleDetectMpv}
                        disabled={detectingMpv()}
                        class="px-4 py-2 bg-surface-lighter hover:bg-gray-700 text-gray-300 rounded-lg border border-gray-700 transition-colors disabled:opacity-50"
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
                      class="block text-gray-400 text-sm mb-2"
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
                      class="w-full bg-surface-lighter border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-jellyfin transition-colors font-mono text-sm"
                    />
                  </div>
                )}
              </form.Field>
            </div>
          </div>

          {/* Save Settings Button */}
          <div class="mb-6">
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <button
                  type="submit"
                  disabled={isSubmitting()}
                  class="w-full py-3 px-6 bg-jellyfin hover:bg-jellyfin-dark text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
                >
                  {isSubmitting() ? 'Saving...' : 'Save Settings'}
                </button>
              )}
            </form.Subscribe>

            <Show when={saveMessage()}>
              <div
                class={`mt-3 p-3 rounded-lg text-sm text-center ${
                  saveMessage()?.type === 'success'
                    ? 'bg-green-900/30 text-green-400 border border-green-900/50'
                    : 'bg-red-900/30 text-red-400 border border-red-900/50'
                }`}
              >
                {saveMessage()?.text}
              </div>
            </Show>
          </div>
        </form>

        {/* Actions Card */}
        <div class="bg-surface-light rounded-xl p-6 border border-surface-lighter mb-6">
          <h2 class="text-lg font-semibold text-white mb-4">Actions</h2>

          <div class="space-y-3">
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting() || !state()?.connected}
              class="w-full py-3 px-6 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-lg border border-red-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disconnecting() ? 'Disconnecting...' : 'Disconnect from Server'}
            </button>

            <button
              type="button"
              onClick={handleClearSession}
              disabled={clearingSession()}
              class="w-full py-3 px-6 bg-gray-600/20 hover:bg-gray-600/30 text-gray-300 font-medium rounded-lg border border-gray-600/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {clearingSession() ? 'Clearing...' : 'Clear Saved Session'}
            </button>

            <p class="text-gray-500 text-xs text-center">
              Clear saved session will remove stored credentials and return to
              login.
            </p>
          </div>
        </div>

        {/* Log Panel */}
        <LogPanel />

        {/* Version Footer */}
        <div class="mt-8 text-center">
          <p class="text-gray-500 text-sm">JMSR - Jellyfin MPV Shim Rust</p>
          <p class="text-gray-600 text-xs mt-1">Version 0.1.0</p>
        </div>
      </div>
    </div>
  );
}
