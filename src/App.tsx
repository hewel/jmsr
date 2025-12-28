import {
  QueryClient,
  QueryClientProvider,
  useQuery,
} from '@tanstack/solid-query';
import { commands } from './bindings';
import './App.css';
import { Match, Switch } from 'solid-js';

const queryClient = new QueryClient();

function Example() {
  const helloWorldQuery = useQuery(() => ({
    queryKey: ['helloWorld', 'Rsbuild User'],
    queryFn: ({ queryKey }) => commands.helloWorld(queryKey.join(' ')),
  }));

  return (
    <div class="content">
      <Switch>
        <Match when={helloWorldQuery.isPending}>
          <p>Loading...</p>
        </Match>
        <Match when={helloWorldQuery.isError}>
          <p>Error: {(helloWorldQuery.error as Error).message}</p>
        </Match>
        <Match when={helloWorldQuery.data}>
          <p>{helloWorldQuery.data}</p>
        </Match>
      </Switch>
    </div>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Example />
    </QueryClientProvider>
  );
};

export default App;
