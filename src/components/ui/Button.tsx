import { type JSX, Show, splitProps } from 'solid-js';
import * as styles from './Button.css';

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tonal' | 'outlined' | 'text' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  leadingIcon?: JSX.Element;
  trailingIcon?: JSX.Element;
  class?: string;
  href?: string;
}

/**
 * Control Room Button component styled with Vanilla Extract.
 * Supports design system variants (primary, secondary, tonal, outlined, text, icon), sizes,
 * and automatically renders as an `<a>` element if an `href` prop is supplied.
 */
export default function Button(props: ButtonProps) {
  const [local, rest] = splitProps(props, [
    'variant',
    'size',
    'leadingIcon',
    'trailingIcon',
    'class',
    'children',
    'href',
  ]);

  const variant = () => local.variant ?? 'primary';
  const size = () => local.size ?? 'md';

  const buttonClass = () => {
    const classes = [styles.baseButton];

    if (variant() === 'icon') {
      classes.push(styles.variantStyles.icon);
      classes.push(styles.iconSizeStyles[size()]);
    } else {
      classes.push(styles.variantStyles[variant()]);
      classes.push(styles.sizeStyles[size()]);
    }

    if (local.class) {
      classes.push(local.class);
    }

    return classes.join(' ');
  };

  return (
    <Show
      when={local.href}
      fallback={
        <button class={buttonClass()} {...rest}>
          <Show when={local.leadingIcon}>
            <span class={styles.buttonIconLeading}>{local.leadingIcon}</span>
          </Show>

          {local.children}

          <Show when={local.trailingIcon}>
            <span class={styles.buttonIconTrailing}>{local.trailingIcon}</span>
          </Show>
        </button>
      }
    >
      {/* biome-ignore lint/suspicious/noExplicitAny: rest forwards HTML button props, cast to any is safe here for anchor */}
      <a href={local.href} class={buttonClass()} {...(rest as any)}>
        <Show when={local.leadingIcon}>
          <span class={styles.buttonIconLeading}>{local.leadingIcon}</span>
        </Show>

        {local.children}

        <Show when={local.trailingIcon}>
          <span class={styles.buttonIconTrailing}>{local.trailingIcon}</span>
        </Show>
      </a>
    </Show>
  );
}
