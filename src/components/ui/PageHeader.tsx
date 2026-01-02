import type { JSX } from 'solid-js';

interface PageHeaderProps {
  title: string;
  description?: string;
  trailing?: JSX.Element;
}

/**
 * Consistent page header with title, description, and optional trailing action.
 */
export default function PageHeader(props: PageHeaderProps) {
  return (
    <div class="flex items-center justify-between pb-4">
      <div>
        <h1 class="text-headline-large text-on-surface tracking-tight">
          {props.title}
        </h1>
        {props.description && (
          <p class="text-body-large text-on-surface-variant mt-1">
            {props.description}
          </p>
        )}
      </div>
      {props.trailing}
    </div>
  );
}
