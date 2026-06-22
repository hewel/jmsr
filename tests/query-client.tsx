import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import type { JSX } from 'solid-js';

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function TestQueryProvider(props: { children: JSX.Element; client?: QueryClient }) {
  const client = props.client ?? createTestQueryClient();
  return <QueryClientProvider client={client}>{props.children}</QueryClientProvider>;
}
