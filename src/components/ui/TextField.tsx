import { Show, splitProps } from 'solid-js';
import { css, cx } from '../../../styled-system/css';
import { input } from '../../../styled-system/recipes';

type TextFieldVariant = 'filled' | 'outlined';

interface TextFieldProps {
  name: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  onBlur?: () => void;
  type?: 'text' | 'password' | 'url';
  placeholder?: string;
  disabled?: boolean;
  error?: string;
  hint?: string;
  variant?: TextFieldVariant;
  class?: string;
  inputClass?: string;
}

/**
 * M3 TextField with label, input, error, and hint.
 */
export default function TextField(props: TextFieldProps) {
  const [local, rest] = splitProps(props, [
    'name',
    'label',
    'value',
    'onInput',
    'onBlur',
    'type',
    'placeholder',
    'disabled',
    'error',
    'hint',
    'variant',
    'class',
    'inputClass',
  ]);

  const variant = () => local.variant ?? 'filled';

  return (
    <div
      class={cx(
        css({ _focusWithin: { '& label': { color: 'primary' } } }),
        local.class,
      )}
    >
      <label
        for={local.name}
        class={css({
          textStyle: 'labelMedium',
          display: 'block',
          color: 'onSurfaceVariant',
          marginBottom: '4px',
          marginLeft: '4px',
          textTransform: 'uppercase',
          letterSpacing: 'wider',
          transition: 'colors',
        })}
      >
        {local.label}
      </label>
      <input
        id={local.name}
        name={local.name}
        type={local.type ?? 'text'}
        value={local.value}
        onInput={(e) => local.onInput(e.currentTarget.value)}
        onBlur={() => local.onBlur?.()}
        placeholder={local.placeholder}
        disabled={local.disabled}
        class={cx(
          input({ variant: variant() }),
          css({ width: '100%' }),
          local.inputClass,
        )}
        {...rest}
      />
      <Show when={local.error}>
        <p
          class={css({
            color: 'error',
            textStyle: 'bodySmall',
            marginTop: '6px',
            marginLeft: '4px',
            animation: 'slideInFromTop 0.2s ease-out, fadeIn 0.2s ease-out',
          })}
        >
          {local.error}
        </p>
      </Show>
      <Show when={local.hint && !local.error}>
        <p
          class={css({
            color: 'onSurfaceVariant/70',
            textStyle: 'bodySmall',
            marginTop: '6px',
            marginLeft: '4px',
          })}
        >
          {local.hint}
        </p>
      </Show>
    </div>
  );
}
