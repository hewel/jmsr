import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import { commands, type SavedSession } from './bindings';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';

const queryClient = new QueryClient();

type Page = 'login' | 'settings';

const SESSION_STORAGE_KEY = 'jmsr_auth_session';

export function loadSavedSession(): SavedSession | null {
  try {
    const saved = localStorage.getItem(SESSION_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedSession;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

export function saveSession(session: SavedSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSavedSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

function AppContent() {
  const [currentPage, setCurrentPage] = createSignal<Page>('login');
  const [initialLoading, setInitialLoading] = createSignal(true);

  // Check initial connection state and try to restore session on mount
  onMount(async () => {
    try {
      // First check if already connected (shouldn't happen on fresh start)
      const isConnected = await commands.jellyfinIsConnected();
      if (isConnected) {
        setCurrentPage('settings');
        return;
      }

      // Try to restore saved session from localStorage
      const savedSession = loadSavedSession();
      console.log(savedSession);
      if (savedSession) {
        const result = await commands.jellyfinRestoreSession(savedSession);
        if (result.status === 'ok') {
          setCurrentPage('settings');
        } else {
          // Session restoration failed (token expired, server unreachable, etc.)
          // Clear the invalid saved session
          clearSavedSession();
        }
      }
    } finally {
      setInitialLoading(false);
    }
  });

  const handleConnected = () => {
    setCurrentPage('settings');
  };

  const handleDisconnected = () => {
    setCurrentPage('login');
  };

  return (
    <Show
      when={!initialLoading()}
      fallback={
        <div class="min-h-screen bg-surface flex items-center justify-center">
          <div class="text-center">
            <div class="animate-spin h-8 w-8 border-4 border-jellyfin border-t-transparent rounded-full mx-auto mb-4" />
            <p class="text-gray-400">Loading...</p>
          </div>
        </div>
      }
    >
      <Switch>
        <Match when={currentPage() === 'login'}>
          <LoginPage onConnected={handleConnected} />
        </Match>
        <Match when={currentPage() === 'settings'}>
          <SettingsPage onDisconnected={handleDisconnected} />
        </Match>
      </Switch>
    </Show>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
};

export default App;
