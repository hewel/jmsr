import { createResource, createSignal, Show } from 'solid-js';
import { clearSavedSession } from '../App';
import { type ConnectionState, commands } from '../bindings';

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
  const [connectionState, { refetch: refetchConnection }] =
    createResource(fetchConnectionState);
  const [mpvConnected, { refetch: refetchMpv }] =
    createResource(fetchMpvStatus);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const result = await commands.jellyfinDisconnect();
      if (result.status === 'ok') {
        // Clear saved session so user won't auto-reconnect
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
      // Call backend to clear session state
      await commands.jellyfinClearSession();
      // Clear localStorage
      clearSavedSession();
      // Return to login
      props.onDisconnected();
    } finally {
      setClearingSession(false);
    }
  };

  const handleRefresh = () => {
    refetchConnection();
    refetchMpv();
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

        {/* Connection Status Card */}
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
              {/* Status */}
              <div class="flex items-center justify-between">
                <span class="text-gray-400">Status</span>
                <span
                  class={state()?.connected ? 'text-green-400' : 'text-red-400'}
                >
                  {state()?.connected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              {/* Server */}
              <Show when={state()?.serverName}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">Server</span>
                  <span class="text-white">{state()?.serverName}</span>
                </div>
              </Show>

              {/* Server URL */}
              <Show when={state()?.serverUrl}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">URL</span>
                  <span class="text-gray-300 text-sm truncate max-w-xs">
                    {state()?.serverUrl}
                  </span>
                </div>
              </Show>

              {/* Username */}
              <Show when={state()?.userName}>
                <div class="flex items-center justify-between">
                  <span class="text-gray-400">User</span>
                  <span class="text-white">{state()?.userName}</span>
                </div>
              </Show>
            </div>
          </Show>
        </div>

        {/* MPV Status Card */}
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
            <div class="flex items-center justify-between">
              <span class="text-gray-400">Status</span>
              <span
                class={mpvConnected() ? 'text-green-400' : 'text-yellow-400'}
              >
                {mpvConnected() ? 'Running' : 'Not Started'}
              </span>
            </div>
          </Show>
        </div>

        {/* Actions */}
        <div class="bg-surface-light rounded-xl p-6 border border-surface-lighter">
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

        {/* Version Footer */}
        <div class="mt-8 text-center">
          <p class="text-gray-500 text-sm">JMSR - Jellyfin MPV Shim Rust</p>
          <p class="text-gray-600 text-xs mt-1">Version 0.1.0</p>
        </div>
      </div>
    </div>
  );
}
