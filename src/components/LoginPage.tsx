import { createSignal, Show } from 'solid-js';
import { type Credentials, commands } from '../bindings';

interface LoginPageProps {
  onConnected: () => void;
}

export default function LoginPage(props: LoginPageProps) {
  const [serverUrl, setServerUrl] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const credentials: Credentials = {
      serverUrl: serverUrl(),
      username: username(),
      password: password(),
    };

    try {
      const result = await commands.jellyfinConnect(credentials);
      if (result.status === 'ok') {
        props.onConnected();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading(false);
    }
  };

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

          <form onSubmit={handleSubmit} class="space-y-5">
            {/* Server URL */}
            <div>
              <label
                for="serverUrl"
                class="block text-sm font-medium text-gray-300 mb-2"
              >
                Server URL
              </label>
              <input
                id="serverUrl"
                type="url"
                value={serverUrl()}
                onInput={(e) => setServerUrl(e.currentTarget.value)}
                placeholder="https://jellyfin.example.com"
                required
                disabled={loading()}
                class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
              />
            </div>

            {/* Username */}
            <div>
              <label
                for="username"
                class="block text-sm font-medium text-gray-300 mb-2"
              >
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username()}
                onInput={(e) => setUsername(e.currentTarget.value)}
                placeholder="Enter your username"
                required
                disabled={loading()}
                class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
              />
            </div>

            {/* Password */}
            <div>
              <label
                for="password"
                class="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password()}
                onInput={(e) => setPassword(e.currentTarget.value)}
                placeholder="Enter your password"
                disabled={loading()}
                class="w-full px-4 py-3 bg-surface border border-surface-lighter rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-jellyfin focus:border-transparent transition-all duration-200 disabled:opacity-50"
              />
            </div>

            {/* Error Message */}
            <Show when={error()}>
              <div class="p-3 bg-red-900/30 border border-red-700/50 rounded-lg">
                <p class="text-red-400 text-sm">{error()}</p>
              </div>
            </Show>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading()}
              class="w-full py-3 px-6 bg-jellyfin hover:bg-jellyfin-dark text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Show when={loading()} fallback="Connect">
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
