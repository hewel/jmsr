import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/solid-router';
import { Effect, Exit } from 'effect';
import { commands, type SavedSession } from './bindings';
import LoginPage from './components/LoginPage';
import OperationsConsole from './components/OperationsConsole';
import {
  clearSavedSession as clearSessionEffect,
  loadSavedSession as loadSessionEffect,
  saveSession as saveSessionEffect,
} from './effects/auth';

export function loadSavedSession(): SavedSession | null {
  const exit = Effect.runSyncExit(loadSessionEffect());
  if (Exit.isSuccess(exit)) return exit.value;
  return null;
}

export function saveSession(session: SavedSession): void {
  Effect.runSync(saveSessionEffect(session));
}

export function clearSavedSession(): void {
  Effect.runSync(clearSessionEffect());
}

async function restoreSavedSession(): Promise<boolean> {
  const savedSession = loadSavedSession();
  if (!savedSession) return false;

  const result = await commands.jellyfinRestoreSession(savedSession);
  if (result.status === 'ok') return true;

  clearSavedSession();
  return false;
}

async function checkAuthWithRestore(): Promise<boolean> {
  try {
    if (await commands.jellyfinIsConnected()) return true;
    return await restoreSavedSession();
  } catch {
    return false;
  }
}

async function canAccessConsole(): Promise<boolean> {
  try {
    if (await commands.jellyfinIsConnected()) return true;
  } catch {
    // Fall back to Saved Session check.
  }
  return loadSavedSession() !== null;
}

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: async () => {
    if (await canAccessConsole()) {
      throw redirect({ to: '/console' });
    }
  },
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const navigate = useNavigate();

  const handleConnected = () => {
    navigate({ to: '/console' });
  };

  return <LoginPage onConnected={handleConnected} />;
}

const consoleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/console',
  beforeLoad: async () => {
    if (!(await canAccessConsole())) {
      throw redirect({ to: '/login' });
    }
  },
  component: ConsoleRouteComponent,
});

function ConsoleRouteComponent() {
  const navigate = useNavigate();

  const handleSignedOut = () => {
    navigate({ to: '/login' });
  };

  return <OperationsConsole onSignedOut={handleSignedOut} />;
}

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: async () => {
    if (await checkAuthWithRestore()) {
      throw redirect({ to: '/console' });
    }
    throw redirect({ to: '/login' });
  },
  component: () => null,
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute, consoleRoute]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
