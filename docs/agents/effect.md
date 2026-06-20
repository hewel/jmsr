## Goal

This project uses Effect for TypeScript error handling and Tauri data workflows.

Core rule:

> Never throw `Error` values from business or data workflows. Model recoverable failures with typed Effect errors, wrap throwing or rejecting APIs with `Effect.try` / `Effect.tryPromise`, and unwrap at Solid or TanStack boundaries with `Exit` handling.

Thrown values are allowed only when an external API requires them, such as TanStack Router redirects or test assertion helpers. Keep those throws local to that boundary.

## Default Pattern

Use Effect for application workflows:

- `Effect.fn` for reusable business/data functions.
- `Effect.gen` and `yield*` for sequential composition.
- `Effect.fail` for recoverable application failures.
- `Effect.try` for synchronous APIs that may throw.
- `Effect.tryPromise` for Promise APIs that may reject.
- `Effect.catchTag` / `Effect.catchTags` only where recovery or translation is meaningful.
- `Effect.acquireRelease`, `Scope`, or Layer for resources that need cleanup.

Prefer named typed errors. Use `Schema.TaggedErrorClass` when the error shape can be schema-defined.

```ts
import { Effect, Schema } from 'effect';

export class InvalidServerUrl extends Schema.TaggedErrorClass<InvalidServerUrl>()(
  'InvalidServerUrl',
  { message: Schema.String },
) {}

export const buildServerUrlEffect = Effect.fn('buildServerUrlEffect')(function* (host: string) {
  if (host.trim().length === 0) {
    return yield* Effect.fail(new InvalidServerUrl({ message: 'Server host is required' }));
  }

  return `https://${host}`;
});
```

## Decision Table

| Scenario | Preferred approach |
| --- | --- |
| Recoverable business/data failure | `Effect.fail` with a typed error |
| Synchronous API may throw | `Effect.try` |
| Promise API may reject | `Effect.tryPromise` |
| Optional or missing value | `Option`, not fake fallback data |
| Resource cleanup | `Effect.acquireRelease`, `Scope`, or Layer |
| Logging a failure | Effect logging at a recovery or boundary point |
| UI, route, CLI, or framework boundary | Run the Effect and translate `Exit` / typed errors |
| TanStack Router redirect | Framework-required `throw redirect(...)` is acceptable |
| Test assertion helper | Throwing is acceptable when the test helper needs it |
| Broken invariant / programmer error | Expose as defect or fail fast; do not swallow |

## JMSR Boundaries

- Keep reusable frontend Tauri data workflows in `src/effects/**`.
- Wrap generated `commands.*` calls with `runTauriCommand` or `runTauriCommandRaw` from `src/effects/commands.ts`.
- Do not call raw `commands.*` from route components for reusable business/data workflows.
- Do not fabricate success-shaped fallback objects inside `src/effects/**`.
- Keep route `.tsx` files focused on Solid UI state and rendering.
- At Solid or TanStack boundaries, unwrap Effect results with `Exit.match`, `Exit.isSuccess`, or a small pipeline helper such as `fetchThing().then(defaultTo(fallback))`.
- Keep fallback defaults at the boundary, not hidden inside `src/effects/**`.

## Forbidden Patterns

Do not add recoverable failures like this:

```ts
throw new Error('Failed to load library');
```

Do not catch only to log and rethrow:

```ts
try {
  return await loadLibrary();
} catch (error) {
  console.error(error);
  throw error;
}
```

Do not swallow errors or return fake data:

```ts
try {
  return await getItem(id);
} catch {
  return { id, name: 'Unknown' };
}
```

Prefer typed Effect errors and explicit boundary handling:

```ts
import { Effect, Exit } from 'effect';

const exit = await Effect.runPromiseExit(loadLibrary());

return Exit.match(exit, {
  onSuccess: (library) => library,
  onFailure: () => fallbackLibrary,
});
```

## Refactoring Procedure

When modifying TypeScript code that throws, catches, or awaits a fallible API:

1. Identify whether the code is business/data workflow, adapter, UI boundary, route boundary, or test helper.
2. Replace recoverable `throw new Error(...)` paths with typed errors returned through `Effect.fail`.
3. Wrap synchronous throwers with `Effect.try`.
4. Wrap Promise rejecters with `Effect.tryPromise`.
5. Compose workflows with `Effect.fn`, `Effect.gen`, and `yield*`.
6. Handle errors only where the code can recover, translate to UI state, redirect, or produce an external response.
7. Use `Option` for nullable/missing values instead of nullish fallback branches in `src/effects/**`.
8. Preserve framework-required throws only at their framework boundary.
9. Update or add tests for success and failure paths when behavior changes.

## Code Review Checklist

- [ ] New business/data functions return Effect.
- [ ] Recoverable failures use specific typed errors.
- [ ] No new recoverable `throw new Error(...)` paths were added.
- [ ] Raw `try/catch` is avoided inside business/data workflows.
- [ ] Throwing synchronous APIs are wrapped with `Effect.try`.
- [ ] Rejecting Promise APIs are wrapped with `Effect.tryPromise`.
- [ ] Errors are handled only where recovery or translation is meaningful.
- [ ] No fake fallback data is created inside `src/effects/**`.
- [ ] Optional values are modeled with `Option`.
- [ ] Resources define cleanup with Effect primitives.
- [ ] Tests cover both success and failure paths when behavior changed.

## Default Rule

When unsure, keep failures in the Effect error channel until the outer boundary:

> Business/data workflow returns Effect. Boundary code runs the Effect, inspects `Exit`, and translates typed errors into UI state, redirects, logs, or external responses.
