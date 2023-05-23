@gasbuddy/service
=================

[![Node CI](https://github.com/openapi-typescript-infra/openapi-typescript-service/actions/workflows/nodejs.yml/badge.svg)](https://github.com/openapi-typescript-infra/openapi-typescript-service/actions/workflows/nodejs.yml)

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
This module takes that into account across the development and production experience.

This needs lots more documentation... Just a start.
