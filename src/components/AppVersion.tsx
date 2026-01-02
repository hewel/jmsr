import { getVersion } from '@tauri-apps/api/app';
import { createResource } from 'solid-js';

interface AppVersionProps {
  class?: string;
}

export default function AppVersion(props: AppVersionProps) {
  const [version] = createResource(() => getVersion());
  return (
    <p
      class={
        props.class ??
        'text-on-surface-variant/50 text-xs mt-1 font-mono tracking-wider'
      }
    >
      v{version() ?? '...'}
    </p>
  );
}
