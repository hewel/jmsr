import { QueryClient, QueryClientProvider } from '@tanstack/solid-query';
import { RouterProvider } from '@tanstack/solid-router';
import { router } from './router';

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

export default App;
