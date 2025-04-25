import assert from 'assert';
import http from 'http';
import https from 'https';
import path from 'path';

import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { context, metrics, trace } from '@opentelemetry/api';
import { setupNodeMetrics } from '@sesamecare-oss/opentelemetry-node-metrics';
import { createTerminus } from '@godaddy/terminus';
import type { RequestHandler, Response } from 'express';

import { loadConfiguration } from '../config/index.js';
import { openApi } from '../openapi.js';
import {
  errorHandlerMiddleware,
  loggerMiddleware,
  notFoundMiddleware,
} from '../telemetry/requestLogger.js';
import type {
  AnyServiceLocals,
  RequestLocals,
  RequestWithApp,
  ServiceExpress,
  ServiceLocals,
  ServiceOptions,
  ServiceStartOptions,
} from '../types.js';
import { ConfigurationSchema } from '../config/schema.js';
import { shortstops } from '../config/shortstops.js';
import { getNodeEnv, isDev } from '../env.js';
import { getGlobalPrometheusExporter } from '../telemetry/index.js';

import { loadRoutes } from './route-loader.js';
import { startInternalApp } from './internal-server.js';

function isSyncLogging() {
  if (process.env.LOG_SYNC) {
    return true;
  }
  return isDev() || getNodeEnv() === 'test';
}

export async function startApp<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
>(startOptions: ServiceStartOptions<SLocals, RLocals>): Promise<ServiceExpress<SLocals>> {
  const { service, rootDirectory, codepath = 'build', name, version } = startOptions;
  const shouldPrettyPrint = isDev() && !process.env.NO_PRETTY_LOGS;
  const destination = pino.destination({
    sync: isSyncLogging(),
    dest: process.env.LOG_TO_FILE || process.stdout.fd,
    minLength: process.env.LOG_BUFFER ? Number(process.env.LOG_BUFFER) : undefined,
  });

  function poorMansOtlp(mergeObject: object) {
    if (!('trace_id' in mergeObject)) {
      const activeSpan = trace.getSpan(context.active());
      if (activeSpan) {
        const ctx = activeSpan.spanContext();
        Object.assign(mergeObject, {
          trace_id: ctx.traceId,
          span_id: ctx.spanId,
          trace_flags: ctx.traceFlags
        });
      }
    }
    return mergeObject;
  }

  const logger = shouldPrettyPrint
    ? pino(
      {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
        mixin: poorMansOtlp,
      },
      destination,
    )
    : pino(
      {
        formatters: {
          level(label) {
            return { level: label };
          },
        },
        mixin: poorMansOtlp,
      },
      destination,
    );

  const serviceImpl = service();
  assert(serviceImpl?.start, 'Service function did not return a conforming object');

  const sourceDirectory = path.join(rootDirectory, codepath);
  const baseOptions: ServiceOptions = {
    configurationDirectories: [path.resolve(rootDirectory, './config')],
    shortstopHandlers: shortstops({ name }, sourceDirectory),
  };
  const options = serviceImpl.configure?.(startOptions, baseOptions) || baseOptions;

  const config = await loadConfiguration({
    configurationDirectories: options.configurationDirectories,
    shortstopHandlers: options.shortstopHandlers,
  });

  const logging = config.logging;
  logger.level = logging?.level || 'info';

  // Concentrate the Typescript ugliness...
  const { default: express } = await import('express');
  const app = express() as unknown as ServiceExpress<SLocals>;
  const routing = config.routing;

  app.disable('x-powered-by');
  if (routing?.etag !== true) {
    app.disable('etag');
  }

  Object.assign(app.locals, startOptions.locals, {
    service: serviceImpl,
    logger,
    config,
    name,
    version,
  });

  if (serviceImpl.attach) {
    await serviceImpl.attach(app);
  }

  app.locals.meter = metrics.getMeterProvider().getMeter(name);
  setupNodeMetrics(app.locals.meter, {});

  if (config.trustProxy === true) {
    app.enable('trust proxy');
  } else if (config.trustProxy) {
    app.set('trust proxy', config.trustProxy);
  }

  const histogram = app.locals.meter.createHistogram('http_request_duration_seconds', {
    description: 'Duration of HTTP requests in seconds',
  });

  app.use(loggerMiddleware(app, histogram, logging));

  // Allow the service to add locals, etc. We put this before the body parsers
  // so that the req can decide whether to save the raw request body or not.
  const attachServiceLocals: RequestHandler = (req, res, next) => {
    res.locals.logger = logger;
    let maybePromise: Promise<void> | void | undefined;
    try {
      maybePromise = serviceImpl.onRequest?.(
        req as RequestWithApp<SLocals>,
        res as Response<unknown, RLocals>,
      );
    } catch (error) {
      next(error);
    }
    if (maybePromise) {
      maybePromise.catch(next).then(next);
    } else {
      next();
    }
  };
  app.use(attachServiceLocals);

  if (routing?.cookieParser) {
    app.use(cookieParser());
  }

  if (routing?.bodyParsers?.json) {
    const jsonArgs = typeof routing.bodyParsers.json === 'object' ? routing.bodyParsers.json : {};
    app.use(
      express.json({
        verify(req, res, buf) {
          const locals = (res as Response).locals as RequestLocals;
          if (locals?.rawBody === true) {
            locals.rawBody = buf;
          }
        },
        ...jsonArgs,
      }),
    );
  }
  if (routing?.bodyParsers?.form) {
    app.use(express.urlencoded());
  }

  if (serviceImpl.authorize) {
    const authorize: RequestHandler = (req, res, next) => {
      let maybePromise: Promise<boolean> | boolean | undefined;
      try {
        maybePromise = serviceImpl.authorize?.(
          req as RequestWithApp<SLocals>,
          res as Response<unknown, RLocals>,
        );
      } catch (error) {
        next(error);
      }
      if (maybePromise && typeof maybePromise !== 'boolean') {
        maybePromise
          .then((val) => {
            if (val === false) {
              return;
            }
            next();
          })
          .catch(next);
      } else if (maybePromise !== false) {
        next();
      }
    };
    app.use(authorize);
  }

  if (routing?.static?.enabled) {
    const localdir = path.resolve(rootDirectory, routing?.static?.path || 'public');
    if (routing.static.mountPath) {
      app.use(routing.static.mountPath, express.static(localdir));
    } else {
      app.use(express.static(localdir));
    }
  }

  if (routing?.freezeQuery) {
    app.use((req, res, next) => {
      // Express 5 re-parses the query string every time. This causes problems with
      // various libraries, namely the express OpenAPI parser. So we "freeze it" in place
      // here, which runs right before the routing validation logic does. Note that this
      // means the app middleware will see the unfrozen one, which is intentional. If the
      // app wants to modify or freeze the query itself, this shouldn't get in the way.
      const { query } = req;
      if (query) {
        Object.defineProperty(req, 'query', {
          configurable: true,
          enumerable: true,
          value: query,
        });
      }
      next();
    });
  }

  const codePattern = codepath === 'src' ? '**/*.ts' : '**/*.js';
  if (routing?.routes) {
    await loadRoutes(
      app,
      path.resolve(rootDirectory, codepath, config.routing?.routes || 'routes'),
      codePattern,
    );
  }
  if (routing?.openapi) {
    app.use(await openApi(app, rootDirectory, codepath, codePattern, options.openApiOptions));
  }

  // Putting this here allows more flexible middleware insertion
  await serviceImpl.start(app);

  const { notFound, errors } = routing?.finalHandlers || {};
  if (notFound) {
    app.use(notFoundMiddleware());
  }
  if (errors?.enabled) {
    app.use(errorHandlerMiddleware(app, histogram, errors?.unnest, errors?.render));
  }

  return app;
}

export type StartAppFn<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> = typeof startApp<SLocals, RLocals>;

export async function shutdownApp<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(app: ServiceExpress<SLocals>) {
  const { logger } = app.locals;
  try {
    await app.locals.service.stop?.(app);
    logger.info('App shutdown complete');
  } catch (error) {
    logger.warn(error, 'Shutdown failed');
  }
  (logger as pino.Logger).flush?.();
}

function httpServer<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
>(app: ServiceExpress<SLocals>, config: ConfigurationSchema['server']) {
  if (!config.certificate) {
    return http.createServer(app);
  }

  return https.createServer(
    {
      key: config.key ? Buffer.from(config.key as string) : undefined,
      cert: config.certificate ? Buffer.from(config.certificate as string) : undefined,
    },
    app,
  );
}

function url(config: ConfigurationSchema['server'], port: number) {
  if (config.certificate) {
    return `https://${config.hostname}${port === 443 ? '' : `:${port}`}`;
  }
  return `http://${config.hostname}${port === 80 ? '' : `:${port}`}`;
}

export async function listen<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  shutdownHandler?: () => Promise<void>,
) {
  const config = app.locals.config.server || {};
  const { port } = config;

  const { service, logger } = app.locals;
  const server = httpServer(app, config);
  await app.locals.service.attachServer?.(app, server);

  let shutdownInProgress = false;
  createTerminus(server, {
    timeout: 15000,
    useExit0: true,
    // https://github.com/godaddy/terminus#how-to-set-terminus-up-with-kubernetes
    beforeShutdown() {
      if (shutdownInProgress) {
        return Promise.resolve();
      }
      shutdownInProgress = true;
      if (app.locals.internalApp) {
        app.locals.internalApp.locals.server?.close();
      }
      logger.info('Graceful shutdown beginning');
      return new Promise((accept) => {
        // Per docs https://www.npmjs.com/package/@godaddy/terminus in Kubernetes, wait for readiness threshold
        setTimeout(accept, 10000);
      });
    },
    onShutdown() {
      return Promise.resolve()
        .then(() => service.stop?.(app))
        .then(() => { logger.info('Service stop complete'); })
        .then(shutdownHandler || (() => Promise.resolve()))
        .then(() => logger.info('Graceful shutdown complete'))
        .catch((error) => logger.error(error, 'Error terminating tracing'))
        .then(() => (logger as pino.Logger).flush?.());
    },
    logger: (msg, e) => {
      logger.error(e, msg);
    },
  });

  server.on('close', () => {
    if (!shutdownInProgress) {
      shutdownInProgress = true;
      app.locals.logger.info('Shutdown requested');
      if (app.locals.internalApp) {
        app.locals.internalApp.locals.server?.close();
      }
      shutdownApp(app);
    }
  });

  server.on('error', (error) => {
    logger.error(error, 'Main service listener error');
  });

  // TODO handle rejection/error?
  const listenPromise = new Promise<void>((accept) => {
    server.listen(port, () => {
      const { locals } = app;
      locals.logger.info({ url: url(config, port), service: locals.name }, 'express listening');

      const serverConfig = app.locals.config.server;
      // Ok now start the internal port if we have one.
      if (serverConfig?.internalPort || serverConfig?.internalPort === 0) {
        startInternalApp(app, serverConfig.internalPort)
          .then((internalApp) => {
            locals.internalApp = internalApp;
            const prometheusExporter = getGlobalPrometheusExporter();
            if (prometheusExporter) {
              locals.internalApp.get(
                '/metrics',
                prometheusExporter.getMetricsRequestHandler.bind(prometheusExporter),
              );
              locals.logger.info('Metrics exporter started');
            } else {
              locals.logger.info('No metrics will be exported');
            }
            if (app.locals.openApiSpecification) {
              locals.internalApp.get('/api-docs', (req, res) => {
                res.json(app.locals.openApiSpecification);
              });
            }
            accept();
          })
          .catch((error) => {
            locals.logger.warn(error, 'Failed to start internal metadata app');
          });
      } else {
        accept();
      }
    });
  });

  await listenPromise;
  return server;
}

export type ListenFn<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>> =
  typeof listen<SLocals>;
