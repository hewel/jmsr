import LibraryNavbar from '@components/library/LibraryNavbar';
import { LibraryNavbarControlsProvider } from '@components/library/LibraryNavbarContext';
import { Outlet, createFileRoute, useLocation } from '@tanstack/solid-router';
import { Show, createMemo } from 'solid-js';
import { defaultTo } from '~effects/helper';
import { fetchLibraryShortcuts } from '~effects/library';

export const Route = createFileRoute('/_authenticated/library')({
  loader: async () => ({
    shortcuts: await fetchLibraryShortcuts().then(defaultTo([])),
  }),
  component: LibraryLayoutRoute,
});

function LibraryLayoutRoute() {
  const loaderData = Route.useLoaderData();
  const pathname = useLocation({ select: (location) => location.pathname });
  const normalizedPathname = createMemo(() => pathname().replace(/\/$/, '') || '/');
  const browsePathMatch = createMemo(() =>
    /^\/library\/(movies|tvshows)\/([^/]+)$/.exec(normalizedPathname()),
  );
  const showNavbar = createMemo(
    () => normalizedPathname() === '/library' || browsePathMatch() !== null,
  );
  const activeValue = createMemo(() => {
    const match = browsePathMatch();
    return match ? `${match[1]}:${match[2]}` : 'home';
  });

  return (
    <LibraryNavbarControlsProvider>
      <div class="space-y-6">
        <Show when={showNavbar()}>
          <LibraryNavbar shortcuts={loaderData().shortcuts} activeValue={activeValue()} />
        </Show>
        <Outlet />
      </div>
    </LibraryNavbarControlsProvider>
  );
}
