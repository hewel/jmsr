import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/solid-router';
import { commands, type SavedSession } from './bindings';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';

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

// Check if user is authenticated (connected to Jellyfin)
async function checkAuth(): Promise<boolean> {
  try {
    const isConnected = await commands.jellyfinIsConnected();
    if (isConnected) {
      return true;
    }

    // Try to restore saved session
    const savedSession = loadSavedSession();
    if (savedSession) {
      const result = await commands.jellyfinRestoreSession(savedSession);
      if (result.status === 'ok') {
        return true;
      }
      // Session restoration failed - clear invalid session
      clearSavedSession();
    }
    return false;
  } catch {
    return false;
  }
}

// Root route - renders outlet for child routes
const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

// Login route
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    // If already authenticated, redirect to settings
    const isAuth = await checkAuth();
    if (isAuth) {
      throw redirect({ to: '/settings' });
    }
  },
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const navigate = useNavigate();

  const handleConnected = () => {
    navigate({ to: '/settings' });
  };

  return <LoginPage onConnected={handleConnected} />;
}

// Settings route (protected)
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: async () => {
    // If not authenticated, redirect to login
    const isAuth = await checkAuth();
    if (!isAuth) {
      throw redirect({ to: '/login' });
    }
  },
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  const navigate = useNavigate();

  const handleDisconnected = () => {
    navigate({ to: '/login' });
  };

  return <SettingsPage onDisconnected={handleDisconnected} />;
}

// Index route - redirects based on auth state
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    const isAuth = await checkAuth();
    if (isAuth) {
      throw redirect({ to: '/settings' });
    }
    throw redirect({ to: '/login' });
  },
  component: () => null,
});

// Build route tree
const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  settingsRoute,
]);

// Create router instance
export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

// Register router for type safety
declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
