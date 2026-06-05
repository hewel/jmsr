import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  type RouterHistory,
  redirect,
  useNavigate,
  useParams,
} from '@tanstack/solid-router';
import type { VideoLibraryKind } from './bindings';
import AuthenticatedShell, {
  DiagnosticsArea,
  LibraryBrowseView,
  LibraryItemDetailView,
  LibraryLanding,
  LibraryShowDetailView,
} from './components/AuthenticatedShell';
import LoginPage from './components/LoginPage';
import NowPlayingCard from './components/NowPlayingCard';
import OperationsConsole from './components/OperationsConsole';
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

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'authenticated',
  beforeLoad: requireAuthenticatedShell,
  component: AuthenticatedShell,
});

const libraryRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/library',
  component: LibraryLanding,
});

const libraryBrowseRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/library/$collectionType/$libraryId',
  component: LibraryBrowseRouteComponent,
});

const libraryItemDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/library/items/$itemId',
  component: LibraryItemDetailRouteComponent,
});

const libraryShowDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/library/shows/$seriesId',
  component: LibraryShowDetailRouteComponent,
});

function libraryKindFromParam(value: string): VideoLibraryKind {
  return value === 'tvshows' ? 'tvshows' : 'movies';
}

function LibraryBrowseRouteComponent() {
  const params = useParams({
    from: '/authenticated/library/$collectionType/$libraryId',
  });

  return (
    <LibraryBrowseView
      collectionType={libraryKindFromParam(params().collectionType)}
      libraryId={params().libraryId}
    />
  );
}

function LibraryItemDetailRouteComponent() {
  const params = useParams({ from: '/authenticated/library/items/$itemId' });

  return <LibraryItemDetailView itemId={params().itemId} />;
}

function LibraryShowDetailRouteComponent() {
  const params = useParams({ from: '/authenticated/library/shows/$seriesId' });

  return <LibraryShowDetailView seriesId={params().seriesId} />;
}

const nowPlayingRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/now-playing',
  component: () => <NowPlayingCard jellyfinConnected={true} />,
});

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/settings',
  component: SettingsRouteComponent,
});

const diagnosticsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/diagnostics',
  component: DiagnosticsArea,
});

function SettingsRouteComponent() {
  const navigate = useNavigate();

  const handleSignedOut = () => {
    navigate({ to: '/login' });
  };

  return <OperationsConsole onSignedOut={handleSignedOut} />;
}

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
  authenticatedRoute.addChildren([
    libraryRoute,
    libraryBrowseRoute,
    libraryItemDetailRoute,
    libraryShowDetailRoute,
    nowPlayingRoute,
    settingsRoute,
    diagnosticsRoute,
  ]),
  consoleRoute,
]);

export function createJmsrRouter(history?: RouterHistory) {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    history,
  });
}

export const router = createJmsrRouter();

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
