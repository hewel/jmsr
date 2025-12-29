import { createForm } from '@tanstack/solid-form';
import { createSignal, onMount, Show } from 'solid-js';
import { saveSession } from '../App';
import { type Credentials, commands } from '../bindings';

interface LoginPageProps {
  onConnected: () => void;
}

const STORAGE_KEY = 'jmsr_saved_credentials';

interface SavedCredentials {
  serverUrl: string;
  username: string;
  rememberMe: boolean;
}

function loadSavedCredentials(): SavedCredentials | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedCredentials;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

function saveCredentials(serverUrl: string, username: string): void {
  const data: SavedCredentials = { serverUrl, username, rememberMe: true };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function clearSavedCredentials(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export default function LoginPage(props: LoginPageProps) {
  const [error, setError] = createSignal<string | null>(null);
  const [initialValues, setInitialValues] = createSignal({
    serverUrl: '',
    username: '',
    password: '',
    rememberMe: false,
  });

  // Load saved credentials on mount
  onMount(() => {
    const saved = loadSavedCredentials();
    if (saved) {
      setInitialValues({
        serverUrl: saved.serverUrl,
        username: saved.username,
        password: '',
        rememberMe: saved.rememberMe,
      });
    }
  });

  const form = createForm(() => ({
    defaultValues: initialValues(),
    onSubmit: async ({ value }) => {
      setError(null);

      const credentials: Credentials = {
        serverUrl: value.serverUrl,
        username: value.username,
        password: value.password,
      };

      try {
        const result = await commands.jellyfinConnect(credentials);
        if (result.status === 'ok') {
          // Save or clear credentials based on rememberMe
          if (value.rememberMe) {
            saveCredentials(value.serverUrl, value.username);
          } else {
            clearSavedCredentials();
          }

          // Save the full session (with auth token) for auto-reconnect
          const session = await commands.jellyfinGetSession();
          if (session) {
            saveSession(session);
          }

          props.onConnected();
        } else {
          setError(result.error);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    },
  }));

  const isSubmitting = form.useStore((state) => state.isSubmitting);

  return (
    <div class="min-h-screen bg-surface flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-jellyfin tracking-tight">JMSR</h1>
          <p class="text-gray-400 mt-2">Jellyfin MPV Shim</p>
        </div>

        {/* Login Card */}
        <div class="bg-surface-light rounded-2xl p-8 shadow-xl border border-surface-lighter">
          <h2 class="text-xl font-semibold text-white mb-6">
            Connect to Server
          </h2>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            class="space-y-5"
          >
            {/* Server URL */}
            <form.Field
              name="serverUrl"
              validators={{
                onBlur: ({ value }) => {
                  if (!value) return 'Server URL is required';
                  try {
                    new URL(value);
                    return undefined;
                  } catch {
                    return 'Please enter a valid URL';
                  }
                },
              }}
              children={(field) => {
                const errors = () => field().state.meta.errors;
                const touched = () => field().state.meta.isTouched;
                return (
                  <div>
                    <label
                      for={field().name}
                      class="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Server URL
                    </label>
                    <input
                      id={field().name}
                      name={field().name}
                      type="url"
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={field().handleBlur}
                      placeholder="https://jellyfin.example.com"
                      disabled={isSubmitting()}
                      class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                    <Show when={touched() && errors().length > 0}>
                      <p class="text-red-400 text-sm mt-1">{errors()[0]}</p>
                    </Show>
                  </div>
                );
              }}
            />

            {/* Username */}
            <form.Field
              name="username"
              validators={{
                onBlur: ({ value }) => {
                  if (!value) return 'Username is required';
                  return undefined;
                },
              }}
              children={(field) => {
                const errors = () => field().state.meta.errors;
                const touched = () => field().state.meta.isTouched;
                return (
                  <div>
                    <label
                      for={field().name}
                      class="block text-sm font-medium text-gray-300 mb-2"
                    >
                      Username
                    </label>
                    <input
                      id={field().name}
                      name={field().name}
                      type="text"
                      value={field().state.value}
                      onInput={(e) =>
                        field().handleChange(e.currentTarget.value)
                      }
                      onBlur={field().handleBlur}
                      placeholder="Enter your username"
                      disabled={isSubmitting()}
                      class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                    <Show when={touched() && errors().length > 0}>
                      <p class="text-red-400 text-sm mt-1">{errors()[0]}</p>
                    </Show>
                  </div>
                );
              }}
            />

            {/* Password */}
            <form.Field
              name="password"
              children={(field) => (
                <div>
                  <label
                    for={field().name}
                    class="block text-sm font-medium text-gray-300 mb-2"
                  >
                    Password
                  </label>
                  <input
                    id={field().name}
                    name={field().name}
                    type="password"
                    value={field().state.value}
                    onInput={(e) => field().handleChange(e.currentTarget.value)}
                    onBlur={field().handleBlur}
                    placeholder="Enter your password"
                    disabled={isSubmitting()}
                    class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
                  />
                </div>
              )}
            />

            {/* Remember Me */}
            <form.Field
              name="rememberMe"
              children={(field) => (
                <div class="flex items-center gap-3">
                  <input
                    id={field().name}
                    name={field().name}
                    type="checkbox"
                    checked={field().state.value}
                    onChange={(e) =>
                      field().handleChange(e.currentTarget.checked)
                    }
                    disabled={isSubmitting()}
                    class="w-4 h-4 rounded border-surface-lighter bg-surface text-jellyfin focus:ring-jellyfin focus:ring-2 focus:ring-offset-0"
                  />
                  <label for={field().name} class="text-sm text-gray-300">
                    Remember server and username
                  </label>
                </div>
              )}
            />

            {/* Error Message */}
            <Show when={error()}>
              <div class="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p class="text-red-400 text-sm">{error()}</p>
              </div>
            </Show>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting()}
              class="w-full py-3 px-6 bg-jellyfin hover:bg-jellyfin-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Show when={isSubmitting()} fallback="Connect">
                <svg
                  class="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  role="img"
                  aria-label="Loading"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  />
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Connecting...</span>
              </Show>
            </button>
          </form>
        </div>

        {/* Footer */}
        <p class="text-center text-gray-500 text-sm mt-6">
          Jellyfin MPV Shim Rust v0.1.0
        </p>
      </div>
    </div>
  );
}
