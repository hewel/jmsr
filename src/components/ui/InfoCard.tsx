import type { JSX } from 'solid-js';

interface InfoCardProps {
  label: string;
  children: JSX.Element;
}

/**
 * Small info card for displaying labeled values (e.g., status, server name).
 */
export default function InfoCard(props: InfoCardProps) {
  return (
    <div class="bg-surface-container-high/50 p-4 rounded-xl border border-outline-variant/30">
      <span class="text-label-small text-on-surface-variant uppercase tracking-wider block mb-1">
        {props.label}
      </span>
      {props.children}
    </div>
  );
}
