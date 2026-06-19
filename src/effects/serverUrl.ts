import { Effect } from 'effect';

import { hasExplicitPort, isLocalServerHost, stripServerScheme } from '../serverUrl';
import type { ServerUrlFields, ServerUrlResult } from '../serverUrl';
import { InvalidServerUrl } from './errors';

export function buildServerUrlEffect(
  fields: ServerUrlFields,
): Effect.Effect<ServerUrlResult, InvalidServerUrl> {
  return Effect.gen(function* () {
    const rawHost = stripServerScheme(fields.host);
    if (!rawHost) {
      return yield* Effect.fail(new InvalidServerUrl({ message: 'Server host is required' }));
    }

    const candidate = `${fields.scheme}://${rawHost}`;
    const parsed = yield* Effect.try({
      catch: () =>
        new InvalidServerUrl({
          message: 'Enter a valid Jellyfin server host',
        }),
      try: () => new URL(candidate),
    });

    const isLocal = isLocalServerHost(parsed.host);
    const explicitPort = hasExplicitPort(rawHost);
    if (isLocal && !explicitPort) {
      parsed.port = '8096';
    }

    parsed.hash = '';
    parsed.search = '';

    const normalized = explicitPort
      ? `${fields.scheme}://${rawHost}`.replace(/[?#].*$/, '')
      : parsed.toString();

    const url = normalized.replace(/\/$/, parsed.pathname === '/' ? '' : '/');

    return { isLocal, url };
  });
}
