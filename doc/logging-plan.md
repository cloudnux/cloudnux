# Logging redesign plan

## Background

The local dev-server bundles `queue-plugin`, `schedule-plugin`, `websocket-plugin`, and
`dev-console-plugin` as separate tsup entries (see `local/package.json` `exports` and
`local/tsup.config.ts`) — each one a fully standalone build, independent from
`dist/index.js`. A relative import shared between two of these gets inlined separately
into each build, so a naive module-level singleton (the old `@cloudnux/utils` global
logger, and an earlier draft of this plan that gave the logger its own tsup entry) ends
up duplicated — one instance per bundle, not actually shared. dev-console subscribing to
one copy never sees logs published through another.

The fix is the mechanism already used for `fastify.queues` / `fastify.scheduler` /
`fastify.websockets`: all four plugins register onto the *same live `FastifyInstance`*,
so a value decorated onto that instance (`app.decorate(...)`) is reachable by every
plugin as one genuine shared object, regardless of how independently each was compiled.
No build-time trick needed — just the object graph Fastify already provides.

## Core (`@cloudnux/core-cloud-provider`) — already done

- `LoggerService`: `level`, `setBindings(bindings)`, `fatal/error/warn/info/debug/trace(mergeObject, msg)`.
  - `setBindings` is kept on the contract. For AWS it mutates a fresh-per-invocation
    instance (safe — no concurrency within one invocation). For local it will be a
    deliberate no-op (module/reqId come from ambient context + explicit per-call
    fields instead — see below for why).
- `CloudProvider.createLoggerService()` — zero-arg. Never takes bindings at construction
  time; both providers call it however suits their execution model (AWS: fresh per
  invocation; local: once, cached).

No further changes needed here.

## local/src/logger/index.ts (new file)

Plain source file — **not** a separate tsup entry, **not** a `package.json` export
subpath. It is only ever imported (relatively) by `router/index.ts` and
`services/logger.ts`, both already part of the single `index` build, so there is no
cross-bundle risk for *this* pair of files.

Contents:
- `AsyncLocalStorage` instance + `enterLogContext` / `runWithLogContext` / `getLogContext`.
  This is what lets `module`/`reqId` be resolved automatically by any code running
  underneath a request or a dispatched handler, without threading a context object
  through every function signature, and without the concurrency hazard of mutating a
  shared instance (Fastify handles concurrent requests in one process, so a mutated
  shared "current module" variable is unsafe the moment anything `await`s).
- The one real `LoggerService` implementation: pretty stdout writer (chalk-colored,
  same shape as the old deleted `local/src/logging/pretty-writer.ts`), reading
  `getLogContext()` merged with an explicit `module` field if the caller passed one
  (explicit always wins). `setBindings` is a no-op here — deliberately, since this
  object is a long-lived singleton touched by concurrent requests; nothing may ever be
  mutated onto it per-call.
- A `subscribeToLogs(fn)` / publish bus that dev-console taps into.

## local/src/router/index.ts

- Build the logger once; `app.decorate('logging', { logger, runWithLogContext, subscribeToLogs })`.
  This is the actual fix for the cross-bundle sharing problem.
- Drop `logger: true` (Fastify's own pino-based request logger) — it has no concept of
  `module` and would be a second, disconnected logging pipeline.
- `onRequest` hook: resolve `module` from `request.routeOptions.config.module` (same
  field `services/functions.ts` already reads), `reqId` from `request.id`, enter log
  context for the rest of that request's async chain.
- `onResponse` hook: emit the access-log line through the same logger.
- `onError` hook: log thrown errors — replaces what Fastify's default error handler used
  to give us for free via `request.log.error(...)`; without this hook that visibility
  would silently disappear once Fastify's own logger is off.
- Existing `onReady` hook (websocket/invoke managers) unchanged.

## local/src/services/logger.ts

- `createLocalLoggerService()` returns the singleton imported directly (relatively) from
  `../logger` — safe, same bundle as `router/index.ts`.

## The four separately-bundled plugins

Reach the logger **only** via `app.logging` — never by importing `../logger` (or
anything under `local/src/logger/`) directly from inside any of these.

- **queue-plugin**: `plugin.ts`'s `fsPlugin(async (app, options) => {...})` already has
  `app` in scope. Thread `app.logging` into `createQueueManager({...})`'s options
  (`decorator.ts`'s functions don't receive `app` themselves) and into whatever factory
  builds the dispatch chain in `processing.ts`, so the actual call to the registered
  queue handler is wrapped in `runWithLogContext({ module: queueService.module }, ...)`.
  Replace the dead `moduleLogger(module)` / `logger` imports in `decorator.ts`,
  `core.ts`, `persistence.ts` with the threaded-through reference.
- **schedule-plugin**: same shape — `plugin.ts` has `app`; thread `app.logging` into
  `createSchedulerManager({...})` and into `execution.ts`'s job-dispatch path (wrap
  `handler(job, execution)` in `runWithLogContext({ module: job.module }, ...)`). Fix the
  dead imports in `decorator.ts`, `core.ts`, `cron-utils.ts`, `cleanup.ts`, `jobs.ts`,
  `persistence.ts` the same way.
- **websocket-plugin**: `app` is already directly in scope at the 3 dispatch call sites
  inside `plugin.ts` (message/disconnect socket callbacks) — use `app.logging` there
  directly, no threading needed, wrapping each dispatch in
  `runWithLogContext({ module: h.module }, ...)`.
- **dev-console-plugin**: already reads `fastify.queues` / `fastify.scheduler` /
  `fastify.websockets` this exact way — add `fastify.logging.subscribeToLogs(...)`
  alongside them, replacing the dead `subscribeToLogs` import.

### Open question for implementation time

A few of the dead-import files (`queue-plugin/core.ts`, `persistence.ts`;
`schedule-plugin/cron-utils.ts`, `cleanup.ts`, `jobs.ts`) are pure helper functions
several layers below `plugin.ts`, with no `app` in scope at all. Threading `logging` all
the way down means adding it as a parameter to whichever *factory* function creates
them (those factories are already built once inside `plugin.ts`'s closure where `app`
is available), not to every individual call site. Worth deciding file-by-file during
implementation rather than prescribing it up front here.

## sdk

- No changes to the 5 `handler.ts` files (`http`, `event-broker`, `schedule`,
  `websocket`, `invoke`) — they keep calling `cloudLogger().setBindings(...)` unchanged.
  It's a no-op on local, still meaningful for AWS.
- Remove `logger` from `FunctionContext` (`core/src/services/functions.ts`) and the 5
  `create-*-context.ts` files — business code is expected to import `cloudLogger()` from
  `@cloudnux/sdk` directly instead of getting it off `context`, since logging needs to
  be usable from any layer (services, repos, helpers), not just the entry-point handler
  that receives `context`.

## AWS — deferred, mechanical only

- `aws/services/logger.ts` + `aws/router/index.ts`: just enough to compile against the
  zero-arg `createLoggerService()` — move bindings out of the constructor call into a
  `.setBindings()` call right after construction. Real design deferred; AWS has no
  concurrency-within-one-invocation concern, so it doesn't need the
  `AsyncLocalStorage`/decorator machinery local needs.
