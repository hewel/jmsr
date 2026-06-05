import { afterEach, expect, rstest, test } from '@rstest/core';
import { commands, type SavedSession } from '../src/bindings';
import {
  redirectLegacyConsoleRoute,
  redirectLoggedInUsersToLibrary,
  redirectRootRoute,
  requireAuthenticatedShell,
} from '../src/router';
import { saveSession } from '../src/sessionAccess';

const sampleSession: SavedSession = {
  serverUrl: 'https://jellyfin.example.com',
  accessToken: 'token-1',
  userId: 'user-1',
  userName: 'Ada',
  serverName: 'Jellyfin Home',
  deviceId: 'device-1',
};

async function expectRedirect(
  action: () => Promise<void>,
  expectedRoute: string,
) {
  try {
    await action();
    throw new Error('Expected redirect');
  } catch (error) {
    expect(JSON.stringify(error)).toContain(`"to":"${expectedRoute}"`);
  }
}

afterEach(() => {
  rstest.restoreAllMocks();
  localStorage.clear();
});

test('login guard redirects authenticated users to Library', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(true);

  await expectRedirect(redirectLoggedInUsersToLibrary, '/library');
});

test('root guard restores a Saved Session into Library', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(false);
  rstest.spyOn(commands, 'jellyfinRestoreSession').mockResolvedValue({
    status: 'ok',
    data: null,
  });
  saveSession(sampleSession);

  await expectRedirect(redirectRootRoute, '/library');
});

test('legacy console redirects authenticated users to Settings', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(true);

  await expectRedirect(redirectLegacyConsoleRoute, '/settings');
});

test('shell guard redirects unauthenticated users to Login', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(false);

  await expectRedirect(requireAuthenticatedShell, '/login');
});
