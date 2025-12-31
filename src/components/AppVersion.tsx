import { getVersion } from '@tauri-apps/api/app';
import { createResource } from 'solid-js';

interface AppVersionProps {
  class?: string;
}

export default function AppVersion(props: AppVersionProps) {
  const [version] = createResource(() => getVersion());
  return (
    <p class={props.class ?? 'text-gray-600 text-xs mt-1'}>
      Version {version() ?? '...'}
    </p>
  );
}
