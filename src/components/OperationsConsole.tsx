import { createListCollection } from '@ark-ui/solid/collection';
import { createForm } from '@tanstack/solid-form';
import { Effect, Exit } from 'effect';
import { createEffect, createResource, createSignal } from 'solid-js';
import {
  type AppConfig,
  type ConnectionState,
  commands,
  type IntroSkipperMode,
} from '../bindings';
import {
  commandFailureMessage,
  runTauriCommand,
  runTauriCommandRaw,
} from '../effects/commands';
import { detectMpv } from '../effects/config';
import {
  clearSavedSession,
  loadSavedSession,
  restoreSavedSession,
} from '../sessionAccess';
import NowPlayingCard from './NowPlayingCard';
import ConnectionCard from './OperationsConsole/ConnectionCard';
import DiagnosticsCard from './OperationsConsole/DiagnosticsCard';
import IntroSkipCard from './OperationsConsole/IntroSkipCard';
import PlayerBridgeSettingsCard from './OperationsConsole/PlayerBridgeSettingsCard';
import SessionCard from './OperationsConsole/SessionCard';
import ShortcutKeysCard from './OperationsConsole/ShortcutKeysCard';
import {
  normalizePreferredSubtitleLanguages,
  parseSubtitleLanguageInput,
} from './OperationsConsole/subtitleLanguages';
import { useToast } from './ToastProvider';
import { PageFooter } from './ui';

interface OperationsConsoleProps {
  onSignedOut: () => void;
}

async function fetchConnectionState(): Promise<ConnectionState> {
  return await commands.jellyfinGetState();
}

async function fetchMpvStatus(): Promise<boolean> {
  return await commands.mpvIsConnected();
}

export default function OperationsConsole(props: OperationsConsoleProps) {
  const { showToast } = useToast();
  let configHydrated = false;
  type PendingSave = {
    config: AppConfig;
    onSuccess?: () => void;
    onError?: (message: string) => void;
  };
  let lastSavedConfig: AppConfig | null = null;
  let saveInFlight = false;
  let pendingSave: PendingSave | null = null;
  let latestConfigSnapshot: AppConfig | null = null;
  let clearPlayerBridgeStatusTimer: ReturnType<typeof setTimeout> | null = null;

  const [disconnecting, setDisconnecting] = createSignal(false);
  const [reconnecting, setReconnecting] = createSignal(false);
  const [signingOut, setSigningOut] = createSignal(false);
  const [confirmSignOut, setConfirmSignOut] = createSignal(false);
  const [detectingMpv, setDetectingMpv] = createSignal(false);
  const [advancedOpen, setAdvancedOpen] = createSignal(false);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = createSignal(false);
  const [playerBridgeSaveStatus, setPlayerBridgeSaveStatus] = createSignal<{
    type: 'saving' | 'saved' | 'error';
    text: string;
  } | null>(null);
  const [introSkipperDraft, setIntroSkipperDraft] =
    createSignal<IntroSkipperMode | null>(null);
  const [introSkipperSaving, setIntroSkipperSaving] = createSignal(false);
  const [introSkipperError, setIntroSkipperError] = createSignal<string | null>(
    null,
  );
  const [selectedSubtitleLanguages, setSelectedSubtitleLanguages] =
    createSignal<string[]>([]);
  const [subtitleLanguageInput, setSubtitleLanguageInput] = createSignal('');
  const subtitleLanguageSelectCollection = createListCollection({
    items: [
      { code: 'eng', label: 'English' },
      { code: 'jpn', label: 'Japanese' },
      { code: 'spa', label: 'Spanish' },
      { code: 'fre', label: 'French' },
      { code: 'ger', label: 'German' },
      { code: 'ita', label: 'Italian' },
      { code: 'por', label: 'Portuguese' },
      { code: 'chi', label: 'Chinese' },
      { code: 'kor', label: 'Korean' },
    ].map((option) => ({
      value: option.code,
      label: `${option.code} — ${option.label}`,
    })),
  });

  const [connectionState, { refetch: refetchConnection }] =
    createResource(fetchConnectionState);
  const [_mpvConnected, { refetch: refetchMpv }] =
    createResource(fetchMpvStatus);
  const [initialConfig, { mutate: mutateConfig }] = createResource(async () => {
    const exit = await Effect.runPromiseExit(
      runTauriCommandRaw(() => commands.configGet()),
    );
    if (Exit.isSuccess(exit)) return exit.value;

    console.error(
      'Failed to load config:',
      commandFailureMessage(exit.cause, 'Could not load configuration'),
    );
    return null;
  });

  const form = createForm(() => ({
    defaultValues: {
      deviceName: 'JMSR',
      mpvPath: '',
      mpvArgs: '',
      keybindNext: 'Shift+>',
      keybindPrev: 'Shift+<',
      keybindIntroSkip: 'g',
      introSkipperMode: 'automatic' as IntroSkipperMode,
    },
  }));

  createEffect(() => {
    const cfg = initialConfig();
    if (cfg && !configHydrated) {
      lastSavedConfig = cfg;
      form.setFieldValue('deviceName', cfg.deviceName ?? 'JMSR');
      form.setFieldValue('mpvPath', cfg.mpvPath ?? '');
      form.setFieldValue('mpvArgs', (cfg.mpvArgs ?? []).join('\n'));
      form.setFieldValue('keybindNext', cfg.keybindNext ?? 'Shift+>');
      form.setFieldValue('keybindPrev', cfg.keybindPrev ?? 'Shift+<');
      form.setFieldValue('keybindIntroSkip', cfg.keybindIntroSkip ?? 'g');
      setSelectedSubtitleLanguages(
        normalizePreferredSubtitleLanguages(cfg.preferredSubtitleLanguages),
      );
      form.setFieldValue(
        'introSkipperMode',
        cfg.introSkipperMode ?? 'automatic',
      );
      if ((cfg.mpvArgs?.length ?? 0) > 0) setAdvancedOpen(true);
      configHydrated = true;
    }
  });

  const state = () => connectionState();
  const config = () => initialConfig();
  const introSkipperMode = () =>
    introSkipperDraft() ?? config()?.introSkipperMode ?? 'automatic';
  const showPlayerBridgeStatus = (
    type: 'saving' | 'saved' | 'error',
    text: string,
  ) => {
    if (clearPlayerBridgeStatusTimer) {
      clearTimeout(clearPlayerBridgeStatusTimer);
      clearPlayerBridgeStatusTimer = null;
    }
    setPlayerBridgeSaveStatus({ type, text });
    if (type === 'saved') {
      clearPlayerBridgeStatusTimer = setTimeout(
        () => setPlayerBridgeSaveStatus(null),
        3000,
      );
    }
  };

  const parseMpvArgs = (value: string) =>
    value
      .split('\n')
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0);

  const buildConfigSnapshot = (overrides: Partial<AppConfig>) => {
    const saved =
      pendingSave?.config ??
      latestConfigSnapshot ??
      lastSavedConfig ??
      config();
    if (!saved) return null;

    return {
      ...saved,
      ...overrides,
    };
  };

  const processConfigSaveQueue = async () => {
    if (saveInFlight) return;
    saveInFlight = true;

    try {
      while (pendingSave) {
        const nextSave = pendingSave;
        pendingSave = null;
        showPlayerBridgeStatus('saving', 'Saving…');

        const exit = await Effect.runPromiseExit(
          runTauriCommand(() => commands.configSet(nextSave.config)),
        );
        if (Exit.isSuccess(exit)) {
          lastSavedConfig = nextSave.config;
          mutateConfig(nextSave.config);
          refetchMpv();
          nextSave.onSuccess?.();
          showPlayerBridgeStatus('saved', 'Saved');
        } else {
          const message = commandFailureMessage(
            exit.cause,
            'Could not save configuration',
          );
          nextSave.onError?.(message);
          showPlayerBridgeStatus('error', message);
          showToast('error', message);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showPlayerBridgeStatus('error', message);
      showToast('error', message);
    } finally {
      saveInFlight = false;
      if (pendingSave) void processConfigSaveQueue();
    }
  };

  const queueConfigSave = (
    snapshot: AppConfig | null,
    callbacks: Omit<PendingSave, 'config'> = {},
  ) => {
    if (!snapshot) return;
    latestConfigSnapshot = snapshot;
    pendingSave = { config: snapshot, ...callbacks };
    void processConfigSaveQueue();
  };

  const saveTextSetting = (
    field:
      | 'deviceName'
      | 'mpvPath'
      | 'mpvArgs'
      | 'keybindNext'
      | 'keybindPrev'
      | 'keybindIntroSkip',
    value: string,
  ) => {
    const saved = lastSavedConfig ?? config();
    const desired = latestConfigSnapshot ?? saved;
    if (!saved || !desired) return;

    if (field === 'deviceName' && value.trim().length === 0) return;
    if (field === 'keybindNext' && value.trim().length === 0) return;
    if (field === 'keybindPrev' && value.trim().length === 0) return;
    if (field === 'keybindIntroSkip' && value.trim().length === 0) return;

    const override =
      field === 'mpvArgs'
        ? { mpvArgs: parseMpvArgs(value) }
        : field === 'mpvPath'
          ? { mpvPath: value.trim().length > 0 ? value : null }
          : { [field]: value };

    if (field === 'mpvArgs') {
      const nextArgs = override.mpvArgs ?? [];
      if (
        nextArgs.length === (desired.mpvArgs?.length ?? 0) &&
        nextArgs.every((arg, index) => arg === desired.mpvArgs?.[index])
      )
        return;
    } else if (field === 'mpvPath') {
      if (override.mpvPath === desired.mpvPath) return;
    } else if (value === desired[field]) {
      return;
    }

    queueConfigSave(buildConfigSnapshot(override));
  };

  const savePreferredSubtitleLanguages = (languages: string[]) => {
    const desired = latestConfigSnapshot ?? lastSavedConfig ?? config();
    if (
      desired &&
      languages.length === (desired.preferredSubtitleLanguages?.length ?? 0) &&
      languages.every(
        (language, index) =>
          language === desired.preferredSubtitleLanguages?.[index],
      )
    )
      return;

    queueConfigSave(
      buildConfigSnapshot({ preferredSubtitleLanguages: languages }),
    );
  };

  const saveIntroSkipperSetting = (mode: IntroSkipperMode) => {
    const previous = introSkipperMode();
    const desired = latestConfigSnapshot ?? lastSavedConfig ?? config();
    if (desired?.introSkipperMode === mode) return;

    setIntroSkipperDraft(mode);
    setIntroSkipperSaving(true);
    setIntroSkipperError(null);
    queueConfigSave(buildConfigSnapshot({ introSkipperMode: mode }), {
      onSuccess: () => {
        setIntroSkipperDraft(null);
        setIntroSkipperSaving(false);
      },
      onError: (message) => {
        setIntroSkipperDraft(previous);
        setIntroSkipperSaving(false);
        setIntroSkipperError(message);
        form.setFieldValue('introSkipperMode', previous);
      },
    });
  };

  const addPreferredSubtitleLanguageCodes = (languages: string[]) => {
    if (languages.length === 0) return;

    let nextLanguages: string[] = [];
    setSelectedSubtitleLanguages((current) => {
      const seen = new Set(current);
      const next = [...current];

      for (const language of languages) {
        const [code] = parseSubtitleLanguageInput(language);
        if (!code || seen.has(code)) continue;
        seen.add(code);
        next.push(code);
      }

      nextLanguages = next;
      return next;
    });
    savePreferredSubtitleLanguages(nextLanguages);
    setSubtitleLanguageInput('');
  };

  const addPreferredSubtitleLanguages = () => {
    addPreferredSubtitleLanguageCodes(
      parseSubtitleLanguageInput(subtitleLanguageInput()),
    );
  };

  const removePreferredSubtitleLanguage = (language: string) => {
    let nextLanguages: string[] = [];
    setSelectedSubtitleLanguages((current) => {
      nextLanguages = current.filter((selected) => selected !== language);
      return nextLanguages;
    });
    savePreferredSubtitleLanguages(nextLanguages);
  };

  const clearPreferredSubtitleLanguages = () => {
    setSelectedSubtitleLanguages([]);
    savePreferredSubtitleLanguages([]);
  };

  const movePreferredSubtitleLanguage = (index: number, direction: -1 | 1) => {
    let nextLanguages: string[] | null = null;
    setSelectedSubtitleLanguages((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;

      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      nextLanguages = next;
      return next;
    });
    if (nextLanguages) savePreferredSubtitleLanguages(nextLanguages);
  };

  const handleRefresh = () => {
    refetchConnection();
    refetchMpv();
  };

  const handleReconnect = async () => {
    const session = loadSavedSession();
    if (!session) {
      showToast('error', 'No Saved Session is available. Sign in again.');
      props.onSignedOut();
      return;
    }

    setReconnecting(true);
    try {
      if (await restoreSavedSession()) {
        showToast('success', 'Reconnected to Jellyfin');
        refetchConnection();
      } else {
        showToast('error', 'Could not reconnect to Jellyfin. Sign in again.');
        props.onSignedOut();
      }
    } finally {
      setReconnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    const exit = await Effect.runPromiseExit(
      runTauriCommand(() => commands.jellyfinDisconnect()),
    );
    if (Exit.isSuccess(exit)) {
      showToast('success', 'Disconnected from Jellyfin');
      refetchConnection();
    } else {
      showToast(
        'error',
        commandFailureMessage(exit.cause, 'Disconnect failed'),
      );
    }
    setDisconnecting(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    const exit = await Effect.runPromiseExit(
      runTauriCommand(() => commands.jellyfinClearSession()),
    );
    if (Exit.isSuccess(exit)) {
      clearSavedSession();
      props.onSignedOut();
    } else {
      showToast('error', commandFailureMessage(exit.cause, 'Sign out failed'));
    }
    setSigningOut(false);
    setConfirmSignOut(false);
  };

  const handleDetectMpv = async () => {
    setDetectingMpv(true);
    const exit = await Effect.runPromiseExit(detectMpv());
    if (Exit.isSuccess(exit)) {
      const path = exit.value;
      if (path) {
        form.setFieldValue('mpvPath', path);
        queueConfigSave(buildConfigSnapshot({ mpvPath: path }));
        showToast('success', 'MPV detected successfully');
      } else {
        showToast(
          'warning',
          'MPV not found in PATH. Configure the path manually.',
        );
      }
    } else {
      console.error(
        'Failed to detect MPV:',
        commandFailureMessage(exit.cause, 'Failed to detect MPV'),
      );
      showToast('error', 'Failed to detect MPV');
    }
    setDetectingMpv(false);
  };

  const handleIntroSkipperModeChange = (mode: IntroSkipperMode) => {
    form.setFieldValue('introSkipperMode', mode);
    saveIntroSkipperSetting(mode);
  };

  return (
    <div class="console-shell">
      <div class="console-container">
        <div class="console-grid">
          <div class="space-y-6">
            <ConnectionCard
              state={state()}
              disconnecting={disconnecting()}
              reconnecting={reconnecting()}
              canReconnect={!!loadSavedSession()}
              onDisconnect={handleDisconnect}
              onReconnect={handleReconnect}
              onRefresh={handleRefresh}
            />

            <NowPlayingCard
              jellyfinConnected={state()?.connected ?? false}
              onPlayerStarted={() => refetchMpv()}
            />
            <form class="space-y-6">
              <PlayerBridgeSettingsCard
                form={form}
                saveStatus={playerBridgeSaveStatus()}
                detectingMpv={detectingMpv()}
                advancedOpen={advancedOpen()}
                selectedSubtitleLanguages={selectedSubtitleLanguages()}
                subtitleLanguageInput={subtitleLanguageInput()}
                subtitleLanguageSelectCollection={
                  subtitleLanguageSelectCollection
                }
                onSaveTextSetting={(field, value) => {
                  if (
                    field === 'deviceName' ||
                    field === 'mpvPath' ||
                    field === 'mpvArgs'
                  ) {
                    saveTextSetting(field, value);
                  }
                }}
                onDetectMpv={handleDetectMpv}
                onAdvancedOpenChange={setAdvancedOpen}
                onAddSubtitleLanguageCodes={addPreferredSubtitleLanguageCodes}
                onAddSubtitleLanguages={addPreferredSubtitleLanguages}
                onRemoveSubtitleLanguage={removePreferredSubtitleLanguage}
                onClearSubtitleLanguages={clearPreferredSubtitleLanguages}
                onMoveSubtitleLanguage={movePreferredSubtitleLanguage}
                onSubtitleLanguageInputChange={setSubtitleLanguageInput}
              />
            </form>
          </div>

          <aside class="space-y-6">
            <DiagnosticsCard
              expanded={diagnosticsExpanded()}
              onToggle={() => setDiagnosticsExpanded((expanded) => !expanded)}
            />

            <IntroSkipCard
              currentMode={introSkipperMode()}
              saving={introSkipperSaving()}
              error={introSkipperError()}
              onModeChange={handleIntroSkipperModeChange}
            />
            <ShortcutKeysCard form={form} onSaveTextSetting={saveTextSetting} />

            <SessionCard
              open={confirmSignOut()}
              signingOut={signingOut()}
              onOpenChange={setConfirmSignOut}
              onSignOut={handleSignOut}
            />

            <PageFooter />
          </aside>
        </div>
      </div>
    </div>
  );
}
