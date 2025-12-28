import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { createSignal, Match, onMount, Show, Switch } from 'solid-js';
import { commands } from './bindings';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';

const queryClient = new QueryClient();

type Page = 'login' | 'settings';

function AppContent() {
  const [currentPage, setCurrentPage] = createSignal<Page>('login');
  const [initialLoading, setInitialLoading] = createSignal(true);

  // Check initial connection state on mount
  onMount(async () => {
    try {
      const isConnected = await commands.jellyfinIsConnected();
      if (isConnected) {
        setCurrentPage('settings');
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
