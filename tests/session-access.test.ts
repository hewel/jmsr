import { afterEach, expect, rstest, test } from '@rstest/core';

import { commands } from '../src/bindings';
import type { SavedSession } from '../src/bindings';
import {
  canAccessConsole,
  checkAuthWithRestore,
  clearSavedSession,
  loadSavedSession,
  restoreSavedSession,
  saveSession,
} from '../src/sessionAccess';

const sampleSession: SavedSession = {
  accessToken: 'token-1',
  deviceId: 'device-1',
  serverName: 'Jellyfin Home',
  serverUrl: 'https://jellyfin.example.com',
  userId: 'user-1',
  userName: 'Ada',
};

afterEach(() => {
  rstest.restoreAllMocks();
  localStorage.clear();
});

test('canAccessConsole allows connected users without a Saved Session', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(true);

  await expect(canAccessConsole()).resolves.toBe(true);
});

test('canAccessConsole allows disconnected users with a Saved Session', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(false);
  saveSession(sampleSession);

  await expect(canAccessConsole()).resolves.toBe(true);
});

test('canAccessConsole denies disconnected users without a Saved Session', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(false);

  await expect(canAccessConsole()).resolves.toBe(false);
});

test('canAccessConsole falls back to Saved Session lookup when connected check throws', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockRejectedValue(new Error('ipc unavailable'));
  saveSession(sampleSession);

  await expect(canAccessConsole()).resolves.toBe(true);
});

test('restoreSavedSession restores the live connection from a Saved Session', async () => {
  const restore = rstest
    .spyOn(commands, 'jellyfinRestoreSession')
    .mockResolvedValue({ data: null, status: 'ok' });
  saveSession(sampleSession);

  await expect(restoreSavedSession()).resolves.toBe(true);
  expect(restore).toHaveBeenCalledWith(sampleSession);
  expect(loadSavedSession()).toEqual(sampleSession);
});

test('restoreSavedSession clears a Saved Session after restore failure', async () => {
  rstest.spyOn(commands, 'jellyfinRestoreSession').mockResolvedValue({
    error: { code: 'authFailed', message: 'expired' },
    status: 'error',
  });
  saveSession(sampleSession);

  await expect(restoreSavedSession()).resolves.toBe(false);
  expect(loadSavedSession()).toBeNull();
});

test('restoreSavedSession clears a Saved Session after restore command throws', async () => {
  rstest.spyOn(commands, 'jellyfinRestoreSession').mockRejectedValue(new Error('ipc unavailable'));
  saveSession(sampleSession);

  await expect(restoreSavedSession()).resolves.toBe(false);
  expect(loadSavedSession()).toBeNull();
});

test('checkAuthWithRestore attempts restore before denying root route access', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockResolvedValue(false);
  const restore = rstest
    .spyOn(commands, 'jellyfinRestoreSession')
    .mockResolvedValue({ data: null, status: 'ok' });
  saveSession(sampleSession);

  await expect(checkAuthWithRestore()).resolves.toBe(true);
  expect(restore).toHaveBeenCalledWith(sampleSession);
});

test('checkAuthWithRestore denies access when command checks throw', async () => {
  rstest.spyOn(commands, 'jellyfinIsConnected').mockRejectedValue(new Error('ipc unavailable'));
  saveSession(sampleSession);

  await expect(checkAuthWithRestore()).resolves.toBe(false);
});

test('clearSavedSession removes Saved Session state synchronously', () => {
  saveSession(sampleSession);

  clearSavedSession();

  expect(loadSavedSession()).toBeNull();
});
