import assert from 'assert';
import http from 'http';
import https from 'https';
import path from 'path';

import express from 'express';
import { pino } from 'pino';
import cookieParser from 'cookie-parser';
import { metrics } from '@opentelemetry/api';
import { setupNodeMetrics } from '@sesamecare-oss/opentelemetry-node-metrics';
import { createTerminus } from '@godaddy/terminus';
import type { RequestHandler, Response } from 'express';
import { Confit } from '@sesamecare-oss/confit';

import { loadConfiguration } from '../config/index';
import { openApi } from '../openapi';
import {
  errorHandlerMiddleware,
  loggerMiddleware,
  notFoundMiddleware,
} from '../telemetry/requestLogger';
import type {
  AnyServiceLocals,
  RequestLocals,
  RequestWithApp,
  ServiceExpress,
  ServiceLocals,
  ServiceOptions,
  ServiceStartOptions,
} from '../types';
import { ConfigurationSchema } from '../config/schema';
import { getNodeEnv, isDev } from '../env';
import { getGlobalPrometheusExporter } from '../telemetry/index';

import { loadRoutes } from './route-loader';
import { startInternalApp } from './internal-server';

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
  const { service, rootDirectory, codepath = 'build', name } = startOptions;
  const shouldPrettyPrint = isDev() && !process.env.NO_PRETTY_LOGS;
  const destination = pino.destination({
    sync: isSyncLogging(),
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
    sourceDirectory: path.join(rootDirectory, codepath),
  });

  const logging = config.get('logging');
  logger.level = logging?.level || 'info';

  // Concentrate the Typescript ugliness...
  const app = express() as unknown as ServiceExpress<SLocals>;
  const routing = config.get('routing');

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

  if (serviceImpl.attach) {
    await serviceImpl.attach(app);
  }

  app.locals.meter = metrics.getMeterProvider().getMeter(name);
  setupNodeMetrics(app.locals.meter, {});

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
      key: config.key,
      cert: config.certificate,
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
  // TODO I don't know why this is necessary, but TS can't quite figure this out
  // otherwise.
  const typedConfig = app.locals.config as unknown as Confit<ConfigurationSchema>;
  const config = typedConfig.get('server') as Required<ConfigurationSchema['server']>;
  const { port } = config;

  const { service, logger } = app.locals;
  const server = httpServer(app, config);
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

  // TODO handle rejection/error?
  const listenPromise = new Promise<void>((accept) => {
    server.listen(port, () => {
      const { locals } = app;
      locals.logger.info({ url: url(config, port), service: locals.name }, 'express listening');

      const serverConfig = typedConfig.get('server');
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
