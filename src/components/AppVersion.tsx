import { getVersion } from '@tauri-apps/api/app';
import { createResource } from 'solid-js';
import { css, cx } from '../../styled-system/css';

interface AppVersionProps {
  class?: string;
}

export default function AppVersion(props: AppVersionProps) {
  const [version] = createResource(() => getVersion());
  return (
    <p
      class={cx(
        css({
          color: 'onSurfaceVariant/50',
          textStyle: 'labelSmall',
          marginTop: '4px',
          fontFamily: 'mono',
          letterSpacing: 'wider',
        }),
        props.class,
      )}
    >
      v{version() ?? '...'}
    </p>
  );
}
