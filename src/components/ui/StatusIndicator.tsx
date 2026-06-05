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
            ? 'bg-tertiary shadow-[0_0_8px_rgba(79,227,177,0.5)] animate-pulse'
            : 'bg-error shadow-[0_0_8px_rgba(255,107,122,0.5)] animate-pulse'
        }`}
      />
      <span
        class={`font-bold ${props.connected ? 'text-on-surface' : 'text-error'}`}
      >
        {props.connected ? connectedText() : disconnectedText()}
      </span>
    </div>
  );
}
