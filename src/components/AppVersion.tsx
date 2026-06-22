import { createQuery } from '@tanstack/solid-query';
import { getVersion } from '@tauri-apps/api/app';

import { queryKeys } from '../effects/query';

interface AppVersionProps {
  class?: string;
}

export default function AppVersion(props: AppVersionProps) {
  const versionQuery = createQuery(() => ({
    queryKey: queryKeys.appVersion,
    queryFn: getVersion,
    staleTime: Infinity,
  }));
  return (
    <p
      class={
        props.class ??
        'text-on-surface-variant/50 mt-1 font-mono text-[11px] leading-[16px] font-bold tracking-[0.08em] tracking-wider uppercase'
      }
    >
      v{versionQuery.data ?? '...'}
    </p>
  );
}
