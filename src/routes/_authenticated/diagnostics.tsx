import { createFileRoute } from '@tanstack/solid-router';

import DiagnosticsPanel from '../../components/DiagnosticsPanel';

function DiagnosticsRoute() {
  return (
    <section class="card-elevated space-y-5" aria-labelledby="diagnostics-title">
      <div>
        <p class="text-label-small text-secondary">Runtime</p>
        <h1 id="diagnostics-title" class="text-headline-large">
          Diagnostics
        </h1>
      </div>
      <DiagnosticsPanel />
    </section>
  );
}

export const Route = createFileRoute('/_authenticated/diagnostics')({
  component: DiagnosticsRoute,
});
