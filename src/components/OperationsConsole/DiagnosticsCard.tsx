import { ClipboardList } from 'lucide-solid';
import DiagnosticsPanel from '../DiagnosticsPanel';
import { SectionCard } from '../ui';

interface DiagnosticsCardProps {
  expanded: boolean;
  onToggle: () => void;
}

export default function DiagnosticsCard(props: DiagnosticsCardProps) {
  return (
    <SectionCard
      icon={<ClipboardList class="h-6 w-6" />}
      title="Diagnostics"
      trailing={
        <button
          type="button"
          class="btn-text min-w-0 px-3"
          onClick={props.onToggle}
          aria-expanded={props.expanded}
          aria-label="Toggle diagnostics"
        >
          {props.expanded ? 'Collapse' : 'Expand'}
        </button>
      }
    >
      <DiagnosticsPanel compact={!props.expanded} />
    </SectionCard>
  );
}
