import type { JSX } from 'solid-js';

interface SectionCardProps {
  icon: JSX.Element;
  title: string;
  children: JSX.Element;
  trailing?: JSX.Element;
}

/**
 * Control Room section card with icon + title header.
 */
export default function SectionCard(props: SectionCardProps) {
  return (
    <div class="card-filled relative">
      <div class="bg-surface-tint/[0.03] pointer-events-none absolute inset-0 rounded-[inherit]" />
      <div class="relative z-10">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="text-title-medium text-primary flex items-center gap-3">
            {props.icon}
            {props.title}
          </h2>
          {props.trailing}
        </div>
        {props.children}
      </div>
    </div>
  );
}
