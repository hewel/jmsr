interface StatusIndicatorProps {
  connected: boolean;
  connectedText?: string;
  disconnectedText?: string;
}

/**
 * Status indicator with glowing dot and text.
 */
export default function StatusIndicator(props: StatusIndicatorProps) {
  const connectedText = () => props.connectedText ?? 'Connected';
  const disconnectedText = () => props.disconnectedText ?? 'Disconnected';

  return (
    <div class="flex items-center gap-2">
      <span
        class={`w-2.5 h-2.5 rounded-full ${
          props.connected
            ? 'bg-tertiary shadow-[0_0_8px_rgba(var(--color-tertiary),0.5)]'
            : 'bg-error'
        }`}
      />
      <span
        class={`font-medium ${props.connected ? 'text-on-surface' : 'text-error'}`}
      >
        {props.connected ? connectedText() : disconnectedText()}
      </span>
    </div>
  );
}
