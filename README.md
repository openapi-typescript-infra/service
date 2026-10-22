# @openapi-typescript-infra/service

[![Node CI](https://github.com/openapi-typescript-infra/service/actions/workflows/nodejs.yml/badge.svg)](https://github.com/openapi-typescript-infra/service/actions/workflows/nodejs.yml)

An opinionated framework for building high scale services - web, api, or job. Uses OpenAPI, pino, express, confit, Typescript and vitest.

This module creates an environment that makes it simpler to host a REST service
(less repetition, more enterprise grade features). Wherever possible, we use off
the shelf infrastructure (OpenAPI, Express@5, Terminus are examples). The goal is to allow
you to enjoy a high level of type safety with a low tax in type construction in a
microservice environment.

The module takes care of configuration-driven:

- body logging
- json parsing
- error handling
- hosted OpenAPI documents/handlers
- traditional routing
- graceful shutdown
- health checks
- Telemetry and instrumentation

services built with this module use Typescript with Node 20, which involves transpilation.
This module takes that into account across the development and production experience. It uses ESM because that
is the way the winds have blown.

This module has the following core functionality:

1. Loads multilevel environment aware configuration, merging configuration information as appropriate to yield a single hierarchical configuration store. We use a modern port of [confit](https://github.com/sesamecare/confit).
2. Engage OpenTelemetry for tracing and metrics monitoring (via Prometheus-format metrics) and wire this into JSON-based pino logging.
3. Setup an Express@5 application with common service hosting options such as body parsing, error handling and graceful shutdown.
4. Find and load route handlers and static content serving, if desired.
5. Validate and load OpenAPI 3 specifications and wire up methods to path-based route handlers including support for authentication.
6. Launch a second express app to serve health checks and metrics
7. Setup infrastructure for interservice calls with tracing.
8. Provide a central service runner that handles loading your service and getting to a running state in both development and production environments.

## Environments

Set `APP_ENV` to `development`, `test`, `staging`, `sandbox`, or `production`.
The configuration loader merges the matching `<environment>.json` file at each
level of the configuration directory stack. Sandbox is a deployed environment:
it uses production-style logging, telemetry, startup, and shutdown behavior
while allowing services to provide isolated credentials and resources in
`sandbox.json`.

Please see the plop-based [project builder](../create) for an easy way to build an example project.

## Graceful shutdown

The framework owns `SIGTERM` and shuts down in this order:

1. Close the internal health listener to withdraw readiness, while continuing to
   serve application HTTP requests during `routingDelayMs`.
2. Call `service.beforeHttpDrain(app)`, if supplied. Use this hook to close
   upgraded connections such as GraphQL subscriptions with their protocol's
   normal close handshake. Keep HTTP handlers and their dependencies usable.
3. Stop accepting HTTP connections and drain active requests. After
   `httpDrainTimeoutMs`, remaining sockets are forcibly closed.
4. Call `service.stop(app)` to release workers, database clients, and other
   resources after HTTP has drained.
5. Call the optional `listen(app, shutdownHandler)` callback, normally used to
   flush telemetry. This runs even if an earlier lifecycle hook fails or times out.

Configure the budgets in milliseconds under `server.shutdown`:

```json
{
  "server": {
    "shutdown": {
      "routingDelayMs": 10000,
      "beforeHttpDrainTimeoutMs": 5000,
      "httpDrainTimeoutMs": 15000,
      "serviceStopTimeoutMs": 30000,
      "shutdownHandlerTimeoutMs": 10000
    }
  }
}
```

These are the deployed defaults. The routing delay defaults to zero in
`development` and `test`; explicit values, including zero, take precedence.
All other durations must be positive integers. Durations must fit a Node.js
32-bit timer. Invalid settings reject `listen()` before installing signal
handlers or opening a listener.

Each lifecycle phase logs its name and elapsed time. A hook or callback failure
is logged, remaining cleanup is attempted, and SIGTERM shutdown exits with code

1. Successful shutdown exits with code 0. A timeout bounds waiting; it does not
   cancel the hook's underlying work, so later cleanup can overlap timed-out work.
   Repeated SIGTERM signals are ignored until cleanup finishes. Calling
   `server.close()` directly still removes this server's signal handlers and invokes
   bounded `stop` cleanup; it does not invoke `beforeHttpDrain` or the SIGTERM-only
   shutdown callback.

Use rolling deployments that keep a ready replacement available. Kubernetes'
`terminationGracePeriodSeconds` must exceed the sum of the configured budgets
plus a safety margin: these defaults sum to 70 seconds, so 90 seconds is a
reasonable starting point. Any Kubernetes `preStop` time also consumes that
budget. Size it for the service's actual request and worker durations.

Disable independent signal handlers in integrations such as Apollo Server
(`stopOnTerminationSignals: false`). Put WebSocket disposal in `beforeHttpDrain`
and Apollo's `stop()` in the service's `stop` hook, before closing its dependencies.
This keeps GraphQL available during routing withdrawal and active HTTP draining.
Applications still need subscription reconnection when a pod is replaced.
