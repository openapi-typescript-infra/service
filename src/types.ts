import type { Server } from 'node:http';
import type { REPLServer } from 'node:repl';

import type { BaseLogger, Logger } from 'pino';
import type { Request, Response } from 'express';
import type { Application } from 'express-serve-static-core';
import type { middleware } from 'express-openapi-validator';
import type { Meter } from '@opentelemetry/api';
import type { NodeSDKConfiguration } from '@opentelemetry/sdk-node';
import type { ShortstopHandler } from '@sesamecare-oss/confit';

import type { ConfigurationSchema } from './config/schema.js';

export interface InternalLocals<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
> extends Record<string, unknown> {
  server?: Server;
  mainApp: ServiceExpress<SLocals>;
}

export type ServiceLogger = BaseLogger & Pick<Logger, 'isLevelEnabled'>;

// Vanilla express wants this to extend Record<string, any> but this is a mistake
// because you lose type checking on it, even though I get that underneath it truly
// is Record<string, any>
export interface ServiceLocals<Config extends ConfigurationSchema = ConfigurationSchema> {
  service: Service;
  name: string;
  version: string;
  logger: ServiceLogger;
  config: Config;
  meter: Meter;
  internalApp: Application<InternalLocals<this>>;
  /**
   * This is the parsed OpenAPI spec we are hosting (if openapi is enabled)
   */
  openApiSpecification?: ReturnType<typeof JSON.parse>;
}

export interface RequestLocals {
  // Set this to true during the request "attachment" and if there is a body,
  // it will be set to the buffer before API and route handlers run.
  rawBody?: Buffer | true;
  logger: ServiceLogger;
}

export type ServiceExpress<Locals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>> =
  Application<Locals>;

export type RequestWithApp<Locals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>> =
  Omit<Request, 'app'> & {
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
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> {
  name?: string;

  // Modify options used for application start
  configure?: (
    startOptions: ServiceStartOptions<SLocals, RLocals>,
    options: ServiceOptions,
  ) => ServiceOptions;

  // Run after configuration but before routes are loaded,
  // which is often a good place to add elements to the app locals
  // that are needed during route setup
  attach?: (app: ServiceExpress<SLocals>) => void | Promise<void>;

  // Called after a server is created but before the server starts listening
  attachServer?: (app: ServiceExpress<SLocals>, server: Server) => void | Promise<void>;
  // Called after the server is listening
  onListening?: (
    app: ServiceExpress<SLocals>,
    info: { port?: number; protocol: 'http' | 'https' },
  ) => void | Promise<void>;

  start(app: ServiceExpress<SLocals>): void | Promise<void>;

  stop?: (app: ServiceExpress<SLocals>) => void | Promise<void>;

  healthy?: (app: ServiceExpress<SLocals>) => boolean | Promise<boolean>;

  // This runs as middleware right BEFORE the body parsers.
  // If you want to run AFTER the body parsers, the current
  // way to do that would be via /routes/index.ts and router.use()
  // in that file.
  onRequest?(req: RequestWithApp<SLocals>, res: Response<unknown, RLocals>): void | Promise<void>;

  // This runs after body parsing but before routing
  authorize?(
    req: RequestWithApp<SLocals>,
    res: Response<unknown, RLocals>,
  ): boolean | Promise<boolean>;

  // Add or redact any fields for logging. Note this will be called twice per request,
  // once at the start and once at the end. Modify the values directly. Return a
  // string to control the "msg" field of the logs, or return undefined to leave it
  // as the default, which is the request URL.
  getLogFields?(
    req: RequestWithApp<SLocals>,
    values: Record<string, string | string[] | number | undefined>,
  ): string | undefined;

  // The repl is a useful tool for diagnosing issues in non-dev environments.
  // The attachRepl method provides a way to add custom functionality
  // (typically with top level variables) to the repl.
  attachRepl?(app: ServiceExpress<SLocals>, repl: REPLServer): void;
}

export type ServiceFactory<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> = () => Service<SLocals, RLocals>;

export interface ServiceStartOptions<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> {
  name: string;
  version: string;
  rootDirectory: string;

  // Defaults to "build", but can be set to "src" to run off non-built source
  codepath?: 'build' | 'src' | 'dist';

  // NOTE: if you use this, you need to cast it because of a Typescript error:
  // https://github.com/microsoft/TypeScript/issues/22229
  // locals: { stuff } as Partial<MyLocals>
  locals?: Partial<SLocals>;

  // And finally, the function that creates the service instance
  service: () => Service<SLocals, RLocals>;
}

export interface DelayLoadServiceStartOptions extends Omit<ServiceStartOptions, 'service'> {
  service: string;
  customizer?:
    | ((options: Partial<NodeSDKConfiguration>) => Partial<NodeSDKConfiguration>)
    | undefined;
}

// Handled by service.configure
export interface ServiceOptions {
  // Used to resolve code paths flexibly during dev/prod
  codepath?: string;
  // Will be either .ts or .js depending on the runtime environment
  codeExtension?: string;

  // If you need multiple configuration directories, pass them here
  // in the desired order (later trumps earlier)
  configurationDirectories: string[];

  // Add or control OpenAPI options such as security handlers
  openApiOptions?: Partial<Parameters<typeof middleware>[0]>;

  shortstopHandlers: Record<string, ShortstopHandler<string, unknown>>;
}

export interface ServiceLike<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
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
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> {
  app: ServiceLike<SLocals>;
  res: {
    locals: RLocals;
  };
}

// Define some utility types to make it easier to put them all
// in one export. This interface never actually is instantiated.
// Typically you should export an interface that extends this one
// and then access all your types through that.
export interface ServiceTypes<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
  ResBody = unknown,
> {
  App: ServiceExpress<SLocals>;
  Handler: (
    req: RequestWithApp<SLocals>,
    res: ResponseFromApp<ResBody, RLocals>,
  ) => void | Promise<void>;
  Request: RequestWithApp<SLocals>;
  RequestLike: RequestLike<SLocals, RLocals>;
  RequestLocals: RLocals;
  Response: ResponseFromApp<ResBody, RLocals>;
  Service: Service<SLocals, RLocals>;
  ServiceFactory: ServiceFactory<SLocals, RLocals>;
  ServiceLocals: SLocals;
}

export type UnwrapServiceConfig<SLocals extends ServiceLocals> =
  SLocals extends ServiceLocals<infer C> ? C : never;

// TODO this allows us to clean up the generics by having a loose parameter
// but using the UnwrapServiceConfig to get the specific type back
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyServiceLocals = ServiceLocals<any>;
