import type { Effect } from 'effect';

import { commands } from '../bindings';
import { runTauriCommandRaw } from './commands';
import type { CommandError } from './errors';

/** Detect MPV executable path. Returns the detected path or null. */
export function detectMpv(): Effect.Effect<string | null, CommandError> {
  return runTauriCommandRaw(() => commands.configDetectMpv());
}
