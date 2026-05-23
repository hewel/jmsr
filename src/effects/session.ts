import { Effect } from 'effect';
import { StorageParseError } from './errors';

export const CREDENTIALS_STORAGE_KEY = 'jmsr_saved_credentials';

export interface SavedCredentials {
  readonly serverUrl: string;
  readonly username: string;
  readonly rememberMe: boolean;
}

function isSavedCredentials(value: unknown): value is SavedCredentials {
  if (value === null || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.serverUrl === 'string' &&
    typeof obj.username === 'string' &&
    typeof obj.rememberMe === 'boolean'
  );
}

export function loadSavedCredentials(): Effect.Effect<
  SavedCredentials | null,
  StorageParseError
> {
  return Effect.gen(function* () {
    const raw = yield* Effect.sync(() =>
      localStorage.getItem(CREDENTIALS_STORAGE_KEY),
    );
    if (!raw) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return yield* Effect.fail(
        new StorageParseError({
          message: 'Could not parse stored credentials',
          key: CREDENTIALS_STORAGE_KEY,
        }),
      );
    }

    if (!isSavedCredentials(parsed)) {
      return yield* Effect.fail(
        new StorageParseError({
          message: 'Stored credentials have an unexpected shape',
          key: CREDENTIALS_STORAGE_KEY,
        }),
      );
    }

    return parsed;
  });
}

export function saveCredentials(
  serverUrl: string,
  username: string,
): Effect.Effect<void> {
  return Effect.sync(() => {
    localStorage.setItem(
      CREDENTIALS_STORAGE_KEY,
      JSON.stringify({ serverUrl, username, rememberMe: true }),
    );
  });
}

export function clearSavedCredentials(): Effect.Effect<void> {
  return Effect.sync(() => {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  });
}
