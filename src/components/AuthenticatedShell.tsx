import { Effect, Exit } from 'effect';
import {
  Activity,
  Clapperboard,
  Library,
  MonitorPlay,
  RefreshCw,
  Settings,
} from 'lucide-solid';
import {
  createResource,
  createSignal,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
import {
  type ConnectionState,
  commands,
  events,
  type NowPlayingState,
} from '../bindings';
import { commandFailureMessage, runTauriCommandRaw } from '../effects/commands';
import DiagnosticsPanel from './DiagnosticsPanel';
import NowPlayingCard from './NowPlayingCard';
import OperationsConsole from './OperationsConsole';
import { StatusBadge } from './ui';

export type ShellArea = 'library' | 'now-playing' | 'settings' | 'diagnostics';

interface AuthenticatedShellProps {
  activeArea: ShellArea;
  onSignedOut: () => void;
}

type LibraryConnectionState =
  | { kind: 'connected'; state: ConnectionState }
  | { kind: 'disconnected'; state: ConnectionState }
  | { kind: 'error'; message: string };

const navItems: Array<{
  area: ShellArea;
  href: string;
  label: string;
  Icon: typeof Library;
}> = [
  { area: 'library', href: '/library', label: 'Library', Icon: Library },
  {
    area: 'now-playing',
    href: '/now-playing',
    label: 'Now Playing',
    Icon: MonitorPlay,
  },
  { area: 'settings', href: '/settings', label: 'Settings', Icon: Settings },
  {
    area: 'diagnostics',
    href: '/diagnostics',
    label: 'Diagnostics',
    Icon: Activity,
  },
];

async function fetchLibraryConnection(): Promise<LibraryConnectionState> {
  const exit = await Effect.runPromiseExit(
    runTauriCommandRaw(() => commands.jellyfinGetState()),
  );

  if (Exit.isSuccess(exit)) {
    return exit.value.connected
      ? { kind: 'connected', state: exit.value }
      : { kind: 'disconnected', state: exit.value };
  }

  return {
    kind: 'error',
    message: commandFailureMessage(exit.cause, 'Could not load Library state'),
  };
}

function statusText(status?: NowPlayingState['status']) {
  switch (status) {
    case 'playing':
      return 'Playing';
    case 'paused':
      return 'Paused';
    case 'idle':
      return 'MPV idle';
    case 'offline':
      return 'Player offline';
    default:
      return 'Playback unknown';
  }
}

function ShellNav(props: { activeArea: ShellArea }) {
  return (
    <nav
      aria-label="JMSR areas"
      class="flex gap-2 overflow-x-auto rounded-2xl border border-outline-variant bg-surface-container-low/70 p-2 shadow-xl backdrop-blur-md lg:flex-col lg:overflow-visible"
    >
      {navItems.map(({ area, href, label, Icon }) => {
        const active = () => props.activeArea === area;
        return (
          <a
            href={href}
            aria-current={active() ? 'page' : undefined}
            class={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-[14px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 ${
              active()
                ? 'border border-primary/40 bg-primary-container/65 text-on-primary-container shadow-brand-glow-sm'
                : 'border border-transparent text-on-surface-variant hover:border-outline-variant hover:bg-surface-container-high/60 hover:text-on-surface'
            }`}
          >
            <Icon class="h-4.5 w-4.5" />
            <span>{label}</span>
          </a>
        );
      })}
    </nav>
  );
}

function CompactNowPlayingSummary() {
  const [state, setState] = createSignal<NowPlayingState | null>(null);

  onMount(() => {
    void commands.nowPlayingGetState().then((result) => {
      if (result.status === 'ok') setState(result.data);
    });

    let disposed = false;
    let cleanup: (() => void) | undefined;
    events.nowPlayingChanged
      .listen((event) => setState(event.payload.state))
      .then((unlisten) => {
        if (disposed) {
          unlisten();
        } else {
          cleanup = unlisten;
        }
      });

    onCleanup(() => {
      disposed = true;
      cleanup?.();
    });
  });

  const title = () => state()?.media?.name ?? 'No active playback';
  const subtitle = () => {
    const media = state()?.media;
    if (!media) return 'External MPV is ready for Jellyfin commands';
    if (media.seriesName) {
      const episode =
        media.seasonNumber && media.episodeNumber
          ? `S${media.seasonNumber.toString().padStart(2, '0')}E${media.episodeNumber.toString().padStart(2, '0')}`
          : media.itemType;
      return `${media.seriesName} · ${episode}`;
    }
    return media.itemType;
  };

  return (
    <aside
      class="card-filled flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      aria-label="Compact Now Playing"
    >
      <div class="flex min-w-0 items-center gap-3">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-secondary/30 bg-secondary-container/25 text-secondary">
          <MonitorPlay class="h-5 w-5" />
        </div>
        <div class="min-w-0">
          <p class="text-label-small">Now Playing</p>
          <p class="truncate text-title-medium">{title()}</p>
          <p class="truncate text-body-small">{subtitle()}</p>
        </div>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <StatusBadge
          variant={
            state()?.status === 'playing' || state()?.status === 'paused'
              ? 'success'
              : 'neutral'
          }
        >
          {statusText(state()?.status)}
        </StatusBadge>
        <a href="/now-playing" class="btn-secondary rounded-full">
          <MonitorPlay class="h-4 w-4" />
          <span>Open Now Playing</span>
        </a>
      </div>
    </aside>
  );
}

function LibraryLanding() {
  const [connection, { refetch }] = createResource(fetchLibraryConnection);

  return (
    <div class="space-y-6">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p class="text-label-small text-secondary">Library Browser</p>
          <h1 class="text-headline-large">Library</h1>
          <p class="mt-2 max-w-2xl text-body-large">
            Video Home will use live Jellyfin data for Continue Watching, Next
            Up, latest video rows, and library shortcuts.
          </p>
        </div>
        <button
          type="button"
          class="btn-outlined rounded-full"
          onClick={() => void refetch()}
          disabled={connection.loading}
        >
          <RefreshCw class="h-4 w-4" />
          <span>Retry Library</span>
        </button>
      </div>

      <CompactNowPlayingSummary />

      <section
        class="card-elevated space-y-5"
        aria-labelledby="video-home-title"
      >
        <div class="flex items-start gap-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-tertiary/30 bg-tertiary-container/25 text-tertiary">
            <Clapperboard class="h-6 w-6" />
          </div>
          <div class="space-y-2">
            <h2 id="video-home-title" class="text-headline-small">
              <Show
                when={!connection.loading}
                fallback="Checking Library connection"
              >
                <Show
                  when={connection()?.kind === 'connected'}
                  fallback={
                    connection()?.kind === 'error'
                      ? 'Could not load Library state'
                      : 'Library requires a live Jellyfin connection'
                  }
                >
                  Video Home is ready
                </Show>
              </Show>
            </h2>
            <p class="text-body-medium">
              <Show
                when={!connection.loading}
                fallback="JMSR is checking the current Jellyfin session before loading Library data."
              >
                <SwitchConnectionCopy connection={connection()} />
              </Show>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function SwitchConnectionCopy(props: {
  connection: LibraryConnectionState | undefined;
}) {
  if (props.connection?.kind === 'connected') {
    return (
      <>
        Connected to {props.connection.state.serverName ?? 'Jellyfin'} as{' '}
        {props.connection.state.userName ?? 'current user'}. Real Video Home
        rows arrive in the next Library Browser slice.
      </>
    );
  }

  if (props.connection?.kind === 'error') {
    return <>{props.connection.message}</>;
  }

  return (
    <>
      Reconnect Jellyfin to browse video libraries. Saved Sessions remain
      available, but Library data is not cached offline.
    </>
  );
}

function DiagnosticsArea() {
  return (
    <section
      class="card-elevated space-y-5"
      aria-labelledby="diagnostics-title"
    >
      <div>
        <p class="text-label-small text-secondary">Runtime</p>
        <h1 id="diagnostics-title" class="text-headline-large">
          Diagnostics
        </h1>
      </div>
      <DiagnosticsPanel />
    </section>
  );
}

export default function AuthenticatedShell(props: AuthenticatedShellProps) {
  const renderArea = () => {
    switch (props.activeArea) {
      case 'library':
        return <LibraryLanding />;
      case 'now-playing':
        return <NowPlayingCard jellyfinConnected={true} />;
      case 'diagnostics':
        return <DiagnosticsArea />;
      case 'settings':
        return <OperationsConsole onSignedOut={props.onSignedOut} />;
      default:
        return <LibraryLanding />;
    }
  };

  return (
    <div class="console-shell">
      <div class="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div class="lg:sticky lg:top-6 lg:self-start">
          <ShellNav activeArea={props.activeArea} />
        </div>
        <main class="min-w-0 animate-fade-in">{renderArea()}</main>
      </div>
    </div>
  );
}
