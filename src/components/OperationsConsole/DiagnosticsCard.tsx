import { ClipboardList } from 'lucide-solid';
import DiagnosticsPanel from '../DiagnosticsPanel';
import { Button, SectionCard } from '../ui';
import { useOperationsConsoleStore } from './store';

export default function DiagnosticsCard() {
  const [ui, actions] = useOperationsConsoleStore();

  return (
    <SectionCard
      icon={<ClipboardList class="h-6 w-6" />}
      title="Diagnostics"
      trailing={
        <Button
          type="button"
          variant="text"
          class="min-w-0 px-3"
          onClick={actions.toggleDiagnostics}
          aria-expanded={ui.diagnosticsExpanded}
          aria-label="Toggle diagnostics"
        >
          {ui.diagnosticsExpanded ? 'Collapse' : 'Expand'}
        </Button>
      }
    >
      <DiagnosticsPanel compact={!ui.diagnosticsExpanded} />
    </SectionCard>
  );
}
