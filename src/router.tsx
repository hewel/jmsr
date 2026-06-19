import { createRouter } from '@tanstack/solid-router';
import type { RouterHistory } from '@tanstack/solid-router';

import { routeTree } from './routeTree.gen';

export {
  redirectLegacyConsoleRoute,
  redirectLoggedInUsersToLibrary,
  redirectRootRoute,
  requireAuthenticatedShell,
} from './router-guards';

export function createJmsrRouter(history?: RouterHistory) {
  return createRouter({
    defaultPreload: 'intent',
    history,
    routeTree,
  });
}

export const router = createJmsrRouter();

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router;
  }
}
