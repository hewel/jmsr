import { createForm } from '@tanstack/solid-form';
import { LoaderCircle } from 'lucide-solid';
import { createSignal, onMount, Show } from 'solid-js';
import { type Credentials, commands } from '../bindings';
import { saveSession } from '../router';
import AppVersion from './AppVersion';

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

  const form = createForm(() => ({
    defaultValues: {
      serverUrl: '',
      username: '',
      password: '',
      rememberMe: false,
    },
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
          setError(result.error.message);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    },
  }));

  const isSubmitting = form.useStore((state) => state.isSubmitting);

  // Load saved credentials on mount
  onMount(() => {
    const saved = loadSavedCredentials();
    if (saved) {
      form.reset({
        serverUrl: saved.serverUrl,
        username: saved.username,
        password: '',
        rememberMe: saved.rememberMe,
      });
    }
  });

  return (
    <div class="min-h-screen bg-background flex items-center justify-center p-6">
      <div class="w-full max-w-md">
        {/* Logo */}
        <div class="text-center mb-8">
          <h1 class="text-4xl font-bold text-primary tracking-tight">JMSR</h1>
          <p class="text-on-surface-variant mt-2">Jellyfin MPV Shim</p>
        </div>

        {/* Login Card */}
        <div class="bg-surface-container rounded-2xl p-8 shadow-xl border border-outline-variant">
          <h2 class="text-xl font-semibold text-on-surface mb-6">
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
                      class="block text-sm font-medium text-on-surface-variant mb-2"
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
                      class="w-full px-4 py-3 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                    <Show when={touched() && errors().length > 0}>
                      <p class="text-error text-sm mt-1">{errors()[0]}</p>
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
                      class="block text-sm font-medium text-on-surface-variant mb-2"
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
                      class="w-full px-4 py-3 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
                    />
                    <Show when={touched() && errors().length > 0}>
                      <p class="text-error text-sm mt-1">{errors()[0]}</p>
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
                    class="block text-sm font-medium text-on-surface-variant mb-2"
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
                    class="w-full px-4 py-3 bg-surface-container-high border border-outline-variant rounded-lg text-on-surface placeholder-outline focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200 disabled:opacity-50"
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
                    class="w-4 h-4 rounded border-outline-variant bg-surface-container text-primary focus:ring-primary focus:ring-2 focus:ring-offset-0"
                  />
                  <label
                    for={field().name}
                    class="text-sm text-on-surface-variant"
                  >
                    Remember server and username
                  </label>
                </div>
              )}
            />

            {/* Error Message */}
            <Show when={error()}>
              <div class="p-3 bg-error-container/30 border border-error/50 rounded-lg">
                <p class="text-error text-sm">{error()}</p>
              </div>
            </Show>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting()}
              class="w-full py-3 px-6 bg-primary hover:bg-primary-container text-on-primary hover:text-on-primary-container font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Show when={isSubmitting()} fallback="Connect">
                <LoaderCircle class="animate-spin h-5 w-5" />
                <span>Connecting...</span>
              </Show>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div class="text-center mt-6">
          <p class="text-on-surface-variant text-sm">Jellyfin MPV Shim Rust</p>
          <AppVersion class="text-on-surface-variant text-sm" />
        </div>
      </div>
    </div>
  );
}
