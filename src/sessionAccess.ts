import { Effect, Exit } from 'effect';
import { commands, type SavedSession } from './bindings';
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

export async function saveCurrentSession(): Promise<void> {
  const session = await commands.jellyfinGetSession();
  if (session) saveSession(session);
}

export async function restoreSavedSession(): Promise<boolean> {
  const savedSession = loadSavedSession();
  if (!savedSession) return false;

  try {
    const result = await commands.jellyfinRestoreSession(savedSession);
    if (result.status === 'ok') return true;
  } catch {
    // Treat IPC errors as failed restores so stale Saved Sessions are not reused.
  }

  clearSavedSession();
  return false;
}

export async function checkAuthWithRestore(): Promise<boolean> {
  try {
    if (await commands.jellyfinIsConnected()) return true;
    return await restoreSavedSession();
  } catch {
    return false;
  }
}

export async function canAccessConsole(): Promise<boolean> {
  try {
    if (await commands.jellyfinIsConnected()) return true;
  } catch {
    // Fall back to Saved Session check.
  }
  return loadSavedSession() !== null;
}
