import { expect, test } from '@rstest/core';

import { librarySessionKey, queryKeys } from '../src/effects/query';

const connectionState = (serverUrl: string, userId: string) =>
  ({
    capabilities: {
      introSkipper: true,
      quickConnect: true,
      remoteControl: true,
      remoteControlAvailable: true,
      remoteControlWarning: null,
    },
    connected: true,
    provider: 'jellyfin' as const,
    serverName: 'Jellyfin Home',
    serverUrl,
    userId,
    userName: 'Ada',
  }) as const;

test('library query keys include active server and user identity', () => {
  const firstSession = librarySessionKey(connectionState('https://first.example.com', 'user-1'));
  const secondSession = librarySessionKey(connectionState('https://second.example.com', 'user-1'));
  const thirdSession = librarySessionKey(connectionState('https://first.example.com', 'user-2'));

  expect(queryKeys.libraryHome(firstSession)).not.toEqual(queryKeys.libraryHome(secondSession));
  expect(queryKeys.libraryHome(firstSession)).not.toEqual(queryKeys.libraryHome(thirdSession));
  expect(queryKeys.libraryMediaDetail(firstSession, 'Movie', 'movie-1')).not.toEqual(
    queryKeys.libraryMediaDetail(secondSession, 'Movie', 'movie-1'),
  );
});
