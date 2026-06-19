import { afterEach, expect, test } from '@rstest/core';
import { fireEvent, screen } from '@testing-library/dom';
import { render } from 'solid-js/web';

import { Button } from '../src/components/ui';

afterEach(() => {
  document.body.innerHTML = '';
});

test('Button renders children and handles clicks', () => {
  let clicked = false;
  const root = document.createElement('div');
  document.body.append(root);

  const dispose = render(
    () => (
      <Button
        onClick={() => {
          clicked = true;
        }}
      >
        Click Me
      </Button>
    ),
    root,
  );

  const button = screen.getByRole('button', { name: 'Click Me' });
  expect(button).toBeInTheDocument();

  fireEvent.click(button);
  expect(clicked).toBe(true);

  dispose();
  root.remove();
});

test('Button respects disabled state', () => {
  let clicked = false;
  const root = document.createElement('div');
  document.body.append(root);

  const dispose = render(
    () => (
      <Button
        disabled={true}
        onClick={() => {
          clicked = true;
        }}
      >
        Disabled
      </Button>
    ),
    root,
  );

  const button = screen.getByRole('button', { name: 'Disabled' });
  expect(button).toBeDisabled();

  fireEvent.click(button);
  expect(clicked).toBe(false);

  dispose();
  root.remove();
});

test('Button renders leading and trailing icons', () => {
  const root = document.createElement('div');
  document.body.append(root);

  const dispose = render(
    () => (
      <Button
        leadingIcon={<span data-testid="leading">L</span>}
        trailingIcon={<span data-testid="trailing">T</span>}
      >
        With Icons
      </Button>
    ),
    root,
  );

  expect(screen.getByTestId('leading')).toBeInTheDocument();
  expect(screen.getByTestId('trailing')).toBeInTheDocument();
  expect(screen.getByRole('button')).toHaveTextContent('LWith IconsT');

  dispose();
  root.remove();
});

test('Button renders as an a tag if href is provided', () => {
  const root = document.createElement('div');
  document.body.append(root);

  const dispose = render(() => <Button href="/test-path">Link Button</Button>, root);

  const link = screen.getByRole('link', { name: 'Link Button' });
  expect(link).toBeInTheDocument();
  expect(link).toHaveAttribute('href', '/test-path');

  dispose();
  root.remove();
});
