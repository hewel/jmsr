import { Dialog } from '@ark-ui/solid/dialog';
import { LogOut, ShieldAlert } from 'lucide-solid';
import { Portal } from 'solid-js/web';

import { Button } from '../ui';
import { useOperationsConsoleStore } from './store';

import * as buttonStyles from '../ui/Button.css';

interface SessionCardProps {
  onSignOut: () => void;
}

export default function SessionCard(props: SessionCardProps) {
  const [ui, actions] = useOperationsConsoleStore();

  return (
    <Dialog.Root
      open={ui.confirmSignOut}
      onOpenChange={(details) => {
        if (ui.signingOut && !details.open) {
          return;
        }
        actions.setSignOutDialogOpen(details.open);
      }}
      closeOnEscape={!ui.signingOut}
      closeOnInteractOutside={!ui.signingOut}
      onEscapeKeyDown={() => {
        if (!ui.signingOut) {
          actions.setSignOutDialogOpen(false);
        }
      }}
      onInteractOutside={() => {
        if (!ui.signingOut) {
          actions.setSignOutDialogOpen(false);
        }
      }}
      lazyMount
      unmountOnExit
      role="dialog"
    >
      <section class="card-filled border-error/20 bg-error-container/5 hover:border-error/45">
        <div class="flex items-start gap-3">
          <ShieldAlert class="text-error mt-1 h-5 w-5 drop-shadow-[0_0_8px_rgba(255,107,122,0.4)]" />
          <div>
            <h2 class="text-title-medium text-on-surface">Session</h2>
            <p class="text-body-small text-on-surface-variant/80 mt-1">
              Sign out removes the Saved Session and requires authentication before Reconnect is
              available.
            </p>
          </div>
        </div>
        <Dialog.Trigger
          class={`${buttonStyles.baseButton} ${buttonStyles.variantStyles.outlined} ${buttonStyles.sizeStyles.md} border-error/55 text-error hover:bg-error/10 hover:border-error mt-5 w-full`}
        >
          <LogOut class="h-4.5 w-4.5" />
          <span>Sign out</span>
        </Dialog.Trigger>
      </section>

      <Portal>
        <Dialog.Backdrop
          class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm transition-all duration-300"
          onClick={() => {
            if (!ui.signingOut) {
              actions.setSignOutDialogOpen(false);
            }
          }}
        />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            class="card-elevated border-error/30 animate-fade-in relative max-w-md overflow-hidden border"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !ui.signingOut) {
                actions.setSignOutDialogOpen(false);
              }
            }}
          >
            {/* Red top glow bar */}
            <div class="via-error/60 absolute top-0 left-0 h-[3px] w-full bg-gradient-to-r from-transparent to-transparent" />

            <Dialog.Title
              id="sign-out-title"
              class="text-title-large text-on-surface flex items-center gap-2"
            >
              <ShieldAlert class="text-error h-6 w-6" />
              Sign out?
            </Dialog.Title>
            <Dialog.Description class="text-body-medium text-on-surface-variant/90 mt-3">
              This removes the Saved Session and you'll need to authenticate again before
              reconnecting.
            </Dialog.Description>
            <div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="secondary"
                onClick={() => actions.setSignOutDialogOpen(false)}
                disabled={ui.signingOut}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="outlined"
                class="border-error/60 text-error hover:bg-error/10"
                onClick={props.onSignOut}
                disabled={ui.signingOut}
              >
                {ui.signingOut ? 'Signing out...' : 'Sign out'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
