import { css, cx } from '../../../styled-system/css';
import AppVersion from '../AppVersion';

interface PageFooterProps {
  appName?: string;
  class?: string;
}

/**
 * Consistent page footer with app name and version.
 */
export default function PageFooter(props: PageFooterProps) {
  return (
    <div
      class={cx(css({ paddingY: '32px', textAlign: 'center' }), props.class)}
    >
      <p
        class={css({
          color: 'onSurfaceVariant/70',
          textStyle: 'bodySmall',
        })}
      >
        {props.appName ?? 'Jellyfin MPV Shim Rust'}
      </p>
      <AppVersion />
    </div>
  );
}
