import type { JSX } from 'solid-js';
import { createContext, useContext } from 'solid-js';
import { createStore } from 'solid-js/store';
import type { SetStoreFunction } from 'solid-js/store';

import type { IntroSkipperMode } from '../../bindings';

// ---------------------------------------------------------------------------
// State types
// ---------------------------------------------------------------------------

export interface PlayerBridgeSaveStatus {
  type: 'saving' | 'saved' | 'error';
  text: string;
}

export interface OperationsConsoleState {
  disconnecting: boolean;
  reconnecting: boolean;
  signingOut: boolean;
  confirmSignOut: boolean;
  detectingMpv: boolean;
  advancedOpen: boolean;
  diagnosticsExpanded: boolean;
  playerBridgeSaveStatus: PlayerBridgeSaveStatus | null;
  introSkipperDraft: IntroSkipperMode | null;
  introSkipperSaving: boolean;
  introSkipperError: string | null;
  selectedSubtitleLanguages: string[];
  subtitleLanguageInput: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export interface OperationsConsoleActions {
  hydrateFromConfig(
    config: Partial<{
      preferredSubtitleLanguages: string[] | null | undefined;
      introSkipperMode: IntroSkipperMode | undefined;
      mpvArgs: string[] | null | undefined;
    }>,
  ): void;

  showPlayerBridgeStatus(status: PlayerBridgeSaveStatus): void;
  clearPlayerBridgeStatus(): void;
  setAdvancedOpen(open: boolean): void;
  toggleDiagnostics(): void;

  beginIntroSkipperSave(mode: IntroSkipperMode): void;
  finishIntroSkipperSave(): void;
  failIntroSkipperSave(previous: IntroSkipperMode, message: string): void;

  setPreferredSubtitleLanguages(languages: string[]): void;
  setSubtitleLanguageInput(value: string): void;

  beginReconnect(): void;
  finishReconnect(): void;

  beginDisconnect(): void;
  finishDisconnect(): void;

  beginSignOut(): void;
  finishSignOut(): void;
  setSignOutDialogOpen(open: boolean): void;

  beginMpvDetection(): void;
  finishMpvDetection(): void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type StoreValue = readonly [OperationsConsoleState, OperationsConsoleActions];

const OperationsConsoleContext = createContext<StoreValue>();

export function useOperationsConsoleStore(): StoreValue {
  const ctx = useContext(OperationsConsoleContext);
  if (!ctx) {
    throw new Error('useOperationsConsoleStore must be used within OperationsConsoleProvider');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Store factory — MUST return a fresh object each call because solid-js/store
// Mutates the initial state object in-place via its reactive proxy.
// ---------------------------------------------------------------------------

export function getInitialState(): OperationsConsoleState {
  return {
    advancedOpen: false,
    confirmSignOut: false,
    detectingMpv: false,
    diagnosticsExpanded: false,
    disconnecting: false,
    introSkipperDraft: null,
    introSkipperError: null,
    introSkipperSaving: false,
    playerBridgeSaveStatus: null,
    reconnecting: false,
    selectedSubtitleLanguages: [],
    signingOut: false,
    subtitleLanguageInput: '',
  };
}

function createActions(set: SetStoreFunction<OperationsConsoleState>): OperationsConsoleActions {
  return {
    beginDisconnect() {
      set('disconnecting', true);
    },

    beginIntroSkipperSave(mode) {
      set('introSkipperDraft', mode);
      set('introSkipperSaving', true);
      set('introSkipperError', null);
    },

    beginMpvDetection() {
      set('detectingMpv', true);
    },

    beginReconnect() {
      set('reconnecting', true);
    },

    beginSignOut() {
      set('signingOut', true);
    },

    clearPlayerBridgeStatus() {
      set('playerBridgeSaveStatus', null);
    },

    failIntroSkipperSave(previous, message) {
      set('introSkipperDraft', previous);
      set('introSkipperSaving', false);
      set('introSkipperError', message);
    },

    finishDisconnect() {
      set('disconnecting', false);
    },

    finishIntroSkipperSave() {
      set('introSkipperDraft', null);
      set('introSkipperSaving', false);
    },

    finishMpvDetection() {
      set('detectingMpv', false);
    },

    finishReconnect() {
      set('reconnecting', false);
    },

    finishSignOut() {
      set('signingOut', false);
      set('confirmSignOut', false);
    },

    hydrateFromConfig(config) {
      set('selectedSubtitleLanguages', config.preferredSubtitleLanguages ?? []);
      if (config.mpvArgs && config.mpvArgs.length > 0) {
        set('advancedOpen', true);
      }
    },

    setAdvancedOpen(open) {
      set('advancedOpen', open);
    },

    setPreferredSubtitleLanguages(languages) {
      set('selectedSubtitleLanguages', languages);
    },

    setSignOutDialogOpen(open) {
      set('confirmSignOut', open);
    },

    setSubtitleLanguageInput(value) {
      set('subtitleLanguageInput', value);
    },

    showPlayerBridgeStatus(status) {
      set('playerBridgeSaveStatus', status);
    },

    toggleDiagnostics() {
      set('diagnosticsExpanded', (prev) => !prev);
    },
  };
}

export function createOperationsConsoleStore(): {
  state: OperationsConsoleState;
  actions: OperationsConsoleActions;
  Provider: (props: { children: JSX.Element }) => JSX.Element;
} {
  const [state, setState] = createStore<OperationsConsoleState>(getInitialState());
  const actions = createActions(setState);

  const Provider = (props: { children: JSX.Element }) => {
    const value = [state, actions] as const;
    return (
      <OperationsConsoleContext.Provider value={value}>
        {props.children}
      </OperationsConsoleContext.Provider>
    );
  };

  return { Provider, actions, state };
}
