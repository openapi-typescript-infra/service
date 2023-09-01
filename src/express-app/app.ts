import assert from 'assert';
import http from 'http';
import https from 'https';
import path from 'path';

import express from 'express';
import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { metrics } from '@opentelemetry/api-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { createTerminus } from '@godaddy/terminus';
import type { RequestHandler, Response } from 'express';

import { loadConfiguration } from '../config/index';
import { findPort } from '../development/port-finder';
import { openApi } from '../openapi';
import {
  errorHandlerMiddleware,
  loggerMiddleware,
  notFoundMiddleware,
} from '../telemetry/requestLogger';
import type {
  RequestLocals,
  RequestWithApp,
  ServiceExpress,
  ServiceLocals,
  ServiceOptions,
  ServiceStartOptions,
} from '../types';
import { ConfigurationItemEnabled, ConfigurationSchema } from '../config/schema';
import { isDev } from '../env';

import { loadRoutes } from './route-loader';
import { startInternalApp } from './internal-server';

const METRICS_KEY = Symbol('PrometheusMetricsInfo');

interface InternalMetricsInfo {
  meterProvider: MeterProvider;
  exporter?: PrometheusExporter;
}

interface AppWithMetrics {
  [METRICS_KEY]?: InternalMetricsInfo;
}

async function enableMetrics<SLocals extends ServiceLocals = ServiceLocals>(
  app: ServiceExpress<SLocals>,
  name: string,
) {
  const meterProvider = new MeterProvider();
  metrics.setGlobalMeterProvider(meterProvider);
  app.locals.meter = meterProvider.getMeter(name);

  const metricsConfig = app.locals.config.get<ConfigurationItemEnabled>('server:metrics');
  const value: InternalMetricsInfo = { meterProvider };
  if (metricsConfig?.enabled) {
    const finalConfig = {
      ...metricsConfig,
      preventServerStart: true,
    };
    // There is what I would consider a bug in OpenTelemetry metrics
    // wherein adding metrics BEFORE the metricReader is added results
    // in those metrics screaming into the void. So, we need to add
    // this up front and then just tie it to the internal express
    // app if and when "listen" is called.
    const exporter = new PrometheusExporter(finalConfig);
    meterProvider.addMetricReader(exporter);
    value.exporter = exporter;
  } else {
    app.locals.logger.info('No metrics will be exported');
  }
  // Squirrel it away for later
  Object.defineProperty(app.locals, METRICS_KEY, {
    value,
    enumerable: false,
    configurable: true,
  });
}

async function endMetrics<SLocals extends ServiceLocals = ServiceLocals>(
  app: ServiceExpress<SLocals>,
) {
  const { internalApp, logger } = app.locals;
  const meterProvider = internalApp?.locals.meterProvider as MeterProvider | undefined;
  await meterProvider?.shutdown();
  logger.info('Metrics shutdown');
}

export async function startApp<
  SLocals extends ServiceLocals = ServiceLocals,
  RLocals extends RequestLocals = RequestLocals,
>(startOptions: ServiceStartOptions<SLocals, RLocals>): Promise<ServiceExpress<SLocals>> {
  const { service, rootDirectory, codepath = 'build', name } = startOptions;
  const shouldPrettyPrint = isDev() && !process.env.NO_PRETTY_LOGS;
  const destination = pino.destination({
    dest: process.env.LOG_TO_FILE || process.stdout.fd,
    minLength: process.env.LOG_BUFFER ? Number(process.env.LOG_BUFFER) : undefined,
  });
  const logger = shouldPrettyPrint
    ? pino({
        transport: {
          destination,
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      })
    : pino(
        {
          formatters: {
            level(label) {
              return { level: label };
            },
          },
        },
        destination,
      );

  const serviceImpl = service();
  assert(serviceImpl?.start, 'Service function did not return a conforming object');

  const baseOptions: ServiceOptions = {
    configurationDirectories: [path.resolve(rootDirectory, './config')],
  };
  const options = serviceImpl.configure?.(startOptions, baseOptions) || baseOptions;

  const config = await loadConfiguration({
    name,
    configurationDirectories: options.configurationDirectories,
    rootDirectory,
  });

  const logging = config.get('logging') as ConfigurationSchema['logging'];
  logger.level = logging?.level || 'info';

  // Concentrate the Typescript ugliness...
  const app = express() as unknown as ServiceExpress<SLocals>;
  const routing = config.get('routing') as ConfigurationSchema['routing'];

  app.disable('x-powered-by');
  if (routing?.etag !== true) {
    app.disable('etag');
  }

  Object.assign(app.locals, { services: {} }, startOptions.locals, {
    service: serviceImpl,
    logger,
    config,
    name,
  });

  try {
    await enableMetrics(app, name);
  } catch (error) {
    logger.error(error, 'Could not enable metrics.');
    throw error;
  }

  if (config.get('trustProxy')) {
    app.set('trust proxy', config.get('trustProxy'));
  }

  app.use(loggerMiddleware(app, logging?.logRequestBody, logging?.logResponseBody));

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
    app.use(
      express.json({
        verify(req, res, buf) {
          const locals = (res as Response).locals as RequestLocals;
          if (locals?.rawBody === true) {
            locals.rawBody = buf;
          }
        },
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
      path.resolve(rootDirectory, codepath, config.get<string>('routing:routes') || 'routes'),
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
    app.use(errorHandlerMiddleware(app, errors?.unnest, errors?.render));
  }

  return app;
}

export type StartAppFn<
  SLocals extends ServiceLocals = ServiceLocals,
  RLocals extends RequestLocals = RequestLocals,
> = typeof startApp<SLocals, RLocals>;

export async function shutdownApp(app: ServiceExpress) {
  const { logger } = app.locals;
  try {
    await app.locals.service.stop?.(app);
    await endMetrics(app);
    logger.info('App shutdown complete');
  } catch (error) {
    logger.warn(error, 'Shutdown failed');
  }
  (logger as pino.Logger).flush?.();
}

function tlsServer<SLocals extends ServiceLocals = ServiceLocals>(
  app: ServiceExpress<SLocals>,
  config: ConfigurationSchema['server'],
) {
  return https.createServer(
    {
      key: config.key,
      cert: config.certificate,
    },
    app,
  );
}

export async function listen<SLocals extends ServiceLocals = ServiceLocals>(
  app: ServiceExpress<SLocals>,
  shutdownHandler?: () => Promise<void>,
) {
  const config = app.locals.config.get('server') as Required<ConfigurationSchema['server']>;
  let { port } = config;

  if (port === 0) {
    port = (await findPort(8001)) as number;
  }

  const { service, logger } = app.locals;
  const server = config.certificate ? tlsServer(app, config) : http.createServer(app);
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
        setTimeout(accept, 10000);
      });
    },
    onShutdown() {
      return Promise.resolve()
        .then(() => service.stop?.(app))
        .then(() => endMetrics(app))
        .then(shutdownHandler || Promise.resolve)
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

  const metricInfo = (app.locals as AppWithMetrics)[METRICS_KEY] as InternalMetricsInfo;
  delete (app.locals as AppWithMetrics)[METRICS_KEY];

  // TODO handle rejection/error?
  const listenPromise = new Promise<void>((accept) => {
    server.listen(port, () => {
      const { locals } = app;
      locals.logger.info({ port, service: locals.name }, 'express listening');

      const serverConfig = locals.config.get('server') as ConfigurationSchema['server'];
      // Ok now start the internal port if we have one.
      if (serverConfig?.internalPort) {
        startInternalApp(app, serverConfig.internalPort)
          .then((internalApp) => {
            locals.internalApp = internalApp;
            internalApp.locals.meterProvider = metricInfo.meterProvider;
            locals.logger.info(
              { port: serverConfig.internalPort },
              'Internal metadata server started',
            );
          })
          .then(() => {
            if (metricInfo.exporter) {
              locals.internalApp.get(
                '/metrics',
                metricInfo.exporter.getMetricsRequestHandler.bind(metricInfo.exporter),
              );
              locals.logger.info('Metrics exporter started');
            } else {
              locals.logger.info('No metrics will be exported');
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

export type ListenFn<SLocals extends ServiceLocals = ServiceLocals> = typeof listen<SLocals>;
