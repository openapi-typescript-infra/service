# @openapi-typescript-infra/service

[![Node CI](https://github.com/openapi-typescript-infra/service/actions/workflows/nodejs.yml/badge.svg)](https://github.com/openapi-typescript-infra/service/actions/workflows/nodejs.yml)

An opinionated framework for building high scale services - web, api, or job. Uses OpenAPI, pino, express, confit, Typescript and jest.

This module creates an environment that makes it simpler to host a REST service
(less repetition, more enterprise grade features). Wherever possible, we use off
the shelf infrastructure (OpenAPI, Express@5, Terminus are examples). The goal is to allow
you to enjoy a high level of type safety with a low tax in type construction in a
microservice environment.

The module takes care of configuration-driven:

* body logging
* json parsing
* error handling
* hosted OpenAPI documents/handlers
* traditional routing
* graceful shutdown
* health checks
* Telemetry and instrumentation

services built with this module use Typescript with Node 18, which involves transpilation.
This module takes that into account across the development and production experience. It does
not currently use ESM for the most part, because between OpenTelemetry, Jest, eslint and the
package ecosystem, that is currently a pipe dream, or at least something that requires incredibly
precise configuration, which is not the intent.

This module has the following core functionality:

1. Loads multilevel environment aware configuration, merging configuration information as appropriate to yield a single hierarchical configuration store. We use [confit](https://github.com/krakenjs/confit).
2. Engage OpenTelemetry for tracing and metrics monitoring (via Prometheus-format metrics) and wire this into JSON-based pino logging.
3. Setup an Express@5 application with common service hosting options such as body parsing, error handling and graceful shutdown.
4. Find and load route handlers and static content serving, if desired.
5. Validate and load OpenAPI 3 specifications and wire up methods to path-based route handlers including support for authentication.
6. Launch a second express app to serve health checks and metrics
7. Setup infrastructure for interservice calls with tracing.
8. Provide a central service runner that handles loading your service and getting to a running state in both development and production environments.

