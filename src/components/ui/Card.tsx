import type { JSX } from 'solid-js';

type CardVariant = 'filled' | 'elevated' | 'outlined';

interface CardProps {
  variant?: CardVariant;
  class?: string;
  children: JSX.Element;
}

/**
 * M3 Card component with surface tint overlay.
 * @param variant - 'filled' (default), 'elevated', or 'outlined'
 */
export default function Card(props: CardProps) {
  const variant = () => props.variant ?? 'filled';

  const variantClasses = () => {
    switch (variant()) {
      case 'elevated':
        return 'card-elevated';
      case 'outlined':
        return 'card-outlined';
      default:
        return 'card-filled';
    }
  };

  return (
    <div
      class={`${variantClasses()} relative overflow-hidden ${props.class ?? ''}`}
    >
      {/* Surface Tint Overlay for M3 elevation effect */}
      <div class="absolute inset-0 bg-surface-tint/[0.03] pointer-events-none" />
      <div class="relative z-10">{props.children}</div>
    </div>
  );
}
