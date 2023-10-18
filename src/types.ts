import type { Server } from 'http';
import type { REPLServer } from 'repl';

import type pino from 'pino';
import type { Request, Response } from 'express';
import type { Application } from 'express-serve-static-core';
import type { middleware } from 'express-openapi-validator';
import type { Meter } from '@opentelemetry/api';
import { Confit } from '@sesamecare-oss/confit';

import { ConfigurationSchema } from './config/schema';

export interface InternalLocals<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
> extends Record<string, unknown> {
  server?: Server;
  mainApp: ServiceExpress<Config, SLocals>;
}

export type ServiceLogger = pino.BaseLogger & Pick<pino.Logger, 'isLevelEnabled'>;

// Vanilla express wants this to extend Record<string, any> but this is a mistake
// because you lose type checking on it, even though I get that underneath it truly
// is Record<string, any>
export interface ServiceLocals<Config extends ConfigurationSchema = ConfigurationSchema> {
  service: Service<Config>;
  name: string;
  logger: ServiceLogger;
  config: Confit<Config>;
  meter: Meter;
  internalApp: Application<InternalLocals<Config>>;
}

export interface RequestLocals {
  // Set this to true during the request "attachment" and if there is a body,
  // it will be set to the buffer before API and route handlers run.
  rawBody?: Buffer | true;
  logger: ServiceLogger;
}

export type ServiceExpress<
  Config extends ConfigurationSchema = ConfigurationSchema,
  Locals extends ServiceLocals<Config> = ServiceLocals<Config>,
> = Application<Locals>;

export type RequestWithApp<
  Config extends ConfigurationSchema = ConfigurationSchema,
  Locals extends ServiceLocals<Config> = ServiceLocals<Config>,
> = Omit<Request, 'app'> & {
  app: Application<Locals>;
};

export type ResponseFromApp<
  ResBody = unknown,
  RLocals extends RequestLocals = RequestLocals,
> = Response<ResBody, RLocals>;

/**
 * This is the core type you need to implement to provide a service
 */
export interface Service<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
> {
  name?: string;

  // Modify options used for application start
  configure?: (
    startOptions: ServiceStartOptions<Config, SLocals, RLocals>,
    options: ServiceOptions,
  ) => ServiceOptions;

  // Run after configuration but before routes are loaded,
  // which is often a good place to add elements to the app locals
  // that are needed during route setup
  attach?: (app: ServiceExpress<Config, SLocals>) => void | Promise<void>;

  start(app: ServiceExpress<Config, SLocals>): void | Promise<void>;

  stop?: (app: ServiceExpress<Config, SLocals>) => void | Promise<void>;

  healthy?: (app: ServiceExpress<Config, SLocals>) => boolean | Promise<boolean>;

  // This runs as middleware right BEFORE the body parsers.
  // If you want to run AFTER the body parsers, the current
  // way to do that would be via /routes/index.ts and router.use()
  // in that file.
  onRequest?(
    req: RequestWithApp<Config, SLocals>,
    res: Response<unknown, RLocals>,
  ): void | Promise<void>;

  // This runs after body parsing but before routing
  authorize?(
    req: RequestWithApp<Config, SLocals>,
    res: Response<unknown, RLocals>,
  ): boolean | Promise<boolean>;

  // Add or redact any fields for logging. Note this will be called twice per request,
  // once at the start and once at the end. Modify the values directly.
  getLogFields?(
    req: RequestWithApp<Config, SLocals>,
    values: Record<string, string | string[] | number | undefined>,
  ): void;

  // The repl is a useful tool for diagnosing issues in non-dev environments.
  // The attachRepl method provides a way to add custom functionality
  // (typically with top level variables) to the repl.
  attachRepl?(app: ServiceExpress<Config, SLocals>, repl: REPLServer): void;
}

export type ServiceFactory<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
> = () => Service<Config, SLocals, RLocals>;

export interface ServiceStartOptions<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
> {
  name: string;
  rootDirectory: string;

  // Defaults to "build", but can be set to "src" to run off non-built source
  codepath?: 'build' | 'src' | 'dist';

  // NOTE: if you use this, you need to cast it because of a Typescript error:
  // https://github.com/microsoft/TypeScript/issues/22229
  // locals: { stuff } as Partial<MyLocals>
  locals?: Partial<SLocals>;

  // And finally, the function that creates the service instance
  service: () => Service<Config, SLocals, RLocals>;
}

export interface DelayLoadServiceStartOptions extends Omit<ServiceStartOptions, 'service'> {
  service: string;
}

// Handled by service.configure
export interface ServiceOptions {
  // If you need multiple configuration directories, pass them here
  // in the desired order (later trumps earlier)
  configurationDirectories: string[];

  // Add or control OpenAPI options such as security handlers
  openApiOptions?: Parameters<typeof middleware>[0];
}

export interface ServiceLike<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
> {
  locals: SLocals;
}

/**
 * This type should be used (or extended) to pass "context"
 * into functions not directly wired into the Express request
 * handling flow. It will allow "synthetic" requests to be
 * easily constructed without depending on things they should not,
 * like query strings or body or similar. Most often, you want the
 * logger.
 */
export interface RequestLike<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
> {
  app: ServiceLike<Config, SLocals>;
  res: {
    locals: RLocals;
  };
}

// Define some utility types to make it easier to put them all
// in one export. This interface never actually is instantiated.
// Typically you should export an interface that extends this one
// and then access all your types through that.
export interface ServiceTypes<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
  ResBody = unknown,
> {
  App: ServiceExpress<Config, SLocals>;
  Handler: (
    req: RequestWithApp<Config, SLocals>,
    res: ResponseFromApp<ResBody, RLocals>,
  ) => void | Promise<void>;
  Request: RequestWithApp<Config, SLocals>;
  RequestLike: RequestLike<Config, SLocals, RLocals>;
  RequestLocals: RLocals;
  Response: ResponseFromApp<ResBody, RLocals>;
  Service: Service<Config, SLocals, RLocals>;
  ServiceFactory: ServiceFactory<Config, SLocals, RLocals>;
  ServiceLocals: SLocals;
}
