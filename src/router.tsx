import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useNavigate,
} from '@tanstack/solid-router';
import AuthenticatedShell, {
  type ShellArea,
} from './components/AuthenticatedShell';
import LoginPage from './components/LoginPage';
import { canAccessConsole, checkAuthWithRestore } from './sessionAccess';

const AUTHENTICATED_HOME_ROUTE = '/library';
const LEGACY_CONSOLE_TARGET_ROUTE = '/settings';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  beforeLoad: redirectLoggedInUsersToLibrary,
  component: LoginRouteComponent,
});

function LoginRouteComponent() {
  const navigate = useNavigate();

  const handleConnected = () => {
    navigate({ to: AUTHENTICATED_HOME_ROUTE });
  };

  return <LoginPage onConnected={handleConnected} />;
}

function ShellRouteComponent(props: { activeArea: ShellArea }) {
  const navigate = useNavigate();

  const handleSignedOut = () => {
    navigate({ to: '/login' });
  };

  return (
    <AuthenticatedShell
      activeArea={props.activeArea}
      onSignedOut={handleSignedOut}
    />
  );
}

const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/library',
  beforeLoad: requireAuthenticatedShell,
  component: () => <ShellRouteComponent activeArea="library" />,
});

const nowPlayingRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/now-playing',
  beforeLoad: requireAuthenticatedShell,
  component: () => <ShellRouteComponent activeArea="now-playing" />,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  beforeLoad: requireAuthenticatedShell,
  component: () => <ShellRouteComponent activeArea="settings" />,
});

const diagnosticsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/diagnostics',
  beforeLoad: requireAuthenticatedShell,
  component: () => <ShellRouteComponent activeArea="diagnostics" />,
});

const consoleRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/console',
  beforeLoad: redirectLegacyConsoleRoute,
  component: () => null,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: redirectRootRoute,
  component: () => null,
});

export async function redirectLoggedInUsersToLibrary() {
  if (await canAccessConsole()) {
    throw redirect({ to: AUTHENTICATED_HOME_ROUTE });
  }
}

export async function requireAuthenticatedShell() {
  if (!(await canAccessConsole())) {
    throw redirect({ to: '/login' });
  }
}

export async function redirectLegacyConsoleRoute() {
  if (!(await canAccessConsole())) {
    throw redirect({ to: '/login' });
  }
  throw redirect({ to: LEGACY_CONSOLE_TARGET_ROUTE });
}

export async function redirectRootRoute() {
  if (await checkAuthWithRestore()) {
    throw redirect({ to: AUTHENTICATED_HOME_ROUTE });
  }
  throw redirect({ to: '/login' });
}

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  libraryRoute,
  nowPlayingRoute,
  settingsRoute,
  diagnosticsRoute,
  consoleRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
});

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
