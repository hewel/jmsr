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
    <div class="bg-surface-container-high/30 p-4 rounded-2xl border border-outline-variant/60 backdrop-blur-sm shadow-inner relative overflow-hidden">
      <span class="text-label-small text-on-surface-variant/90 uppercase tracking-wider block mb-1">
        {props.label}
      </span>
      {props.children}
    </div>
  );
}
