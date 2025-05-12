import type { RequestHandler, Request, Response, ErrorRequestHandler } from 'express';
import { getClientIp } from 'request-ip';
import { Histogram } from '@opentelemetry/api';
import cleanStack from 'clean-stack';

import { ServiceError } from '../error.js';
import type { AnyServiceLocals, RequestWithApp, ServiceExpress, ServiceLocals } from '../types.js';
import type { ServiceHandler } from '../express-app/types.js';
import { ConfigurationSchema } from '../config/schema.js';
import { getNodeEnv } from '../env.js';

const LOG_PREFS = Symbol('Logging information');
const LOGGED_SEMAPHORE = Symbol('Logged semaphore');

interface LogPrefs {
  start: [number, number];
  logRequests?: boolean;
  chunks?: Array<Buffer>;
  logged: boolean;
}

interface WithLogPrefs {
  [LOG_PREFS]: LogPrefs;
}

interface WithIdentifiedSession {
  session?: {
    id?: string;
  };
}

interface ErrorWithStatus extends Error {
  status?: number;
  expected_error?: boolean;
}

function getBasicInfo(req: Request): [string, Record<string, string | number>] {
  const url = req.originalUrl || req.url;

  const preInfo: Record<string, string> = {
    ip: getClientIp(req) || '',
    m: req.method,
  };

  if (req.headers['user-agent']) {
    preInfo.ua = req.headers['user-agent'];
  }

  const sessionReq = req as WithIdentifiedSession;
  if (sessionReq.session?.id) {
    preInfo.sid = sessionReq.session.id;
  }

  return [url, preInfo];
}

function finishLog<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  error: Error | undefined,
  req: Request,
  res: Response & { [LOGGED_SEMAPHORE]?: boolean },
  histogram: Histogram,
) {
  if (res[LOGGED_SEMAPHORE]) {
    return;
  }

  const prefs = (res.locals as WithLogPrefs)[LOG_PREFS] || {};
  if (prefs.logged) {
    // This happens when error handler runs, but onEnd hasn't fired yet. We only log the first one.
    return;
  }

  const { logger, service } = app.locals;

  let dur = 0;
  if (prefs.start) {
    const hrdur = process.hrtime(prefs.start);
    dur = hrdur[0] + hrdur[1] / 1000000000;
  }
  const [url, preInfo] = getBasicInfo(req);

  let responseType: string = 'finished';

  // ts warning is known and incorrect—`aborted` is a subset of `destroyed`
  if (req.aborted) {
    responseType = 'aborted';
  } else if (req.destroyed) {
    responseType = 'destroyed';
  } else if (error) {
    responseType = 'errored';
  }

  const endLog: Record<string, string | string[] | number | undefined> = {
    ...preInfo,
    t: 'req',
    r: responseType,
    s: (error as ErrorWithStatus)?.status || res.statusCode || 0,
    dur,
  };

  const path = req.route ? { path: req.route.path } : undefined;
  histogram.record(dur, {
    status_code: endLog.s,
    method: endLog.m,
    ...path,
    service: app.locals.name,
  });

  if (res.locals.user?.id) {
    endLog.u = res.locals.user.id;
  }

  let unexpectedError = false;
  if (error) {
    endLog.e = error.message;
    if (!(error instanceof ServiceError) || error.log_stack) {
      endLog.st = cleanStack(error.stack);
    }
    if (!(error as ErrorWithStatus).expected_error) {
      unexpectedError = true;
    }
  }

  if (prefs.logRequests) {
    endLog.h = JSON.stringify(req.headers);
    if (Buffer.isBuffer(req.body)) {
      endLog.b = req.body.toString('base64');
    } else if (typeof req.body !== 'string') {
      endLog.b = JSON.stringify(req.body);
    } else if (req.body) {
      endLog.b = req.body;
    }
  }

  if (prefs.chunks?.length) {
    const bodyString = Buffer.concat(prefs.chunks).toString('utf8');
    if (bodyString) {
      endLog.resBody = bodyString;
    }
  }
  const msg = service.getLogFields?.(req as RequestWithApp<SLocals>, endLog) || url;
  if (unexpectedError) {
    logger.error(endLog, msg);
  } else {
    logger.info(endLog, msg);
  }

  res[LOGGED_SEMAPHORE] = true;
}

export function loggerMiddleware<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(
  app: ServiceExpress<SLocals>,
  histogram: Histogram,
  config?: ConfigurationSchema['logging'],
): RequestHandler {
  const nonProd = getNodeEnv() !== 'production';
  const { logger, service } = app.locals;
  return function serviceLogger(req, res, next) {
    const logResponse =
      config?.logResponseBody || (nonProd && req.headers['x-log']?.includes('res'));
    const logRequest = config?.logRequestBody || (nonProd && req.headers['x-log']?.includes('req'));
    const prefs: LogPrefs = {
      start: process.hrtime(),
      logRequests: logRequest,
      chunks: logResponse ? [] : undefined,
      logged: false,
    };

    (res.locals as WithLogPrefs)[LOG_PREFS] = prefs;

    if (logResponse) {
      // res is a read-only stream, so the only way to intercept response
      // data is to monkey-patch.
      const oldWrite = res.write;
      const oldEnd = res.end;
      res.write = ((...args: Parameters<(typeof res)['write']>) => {
        if (prefs.chunks) {
          prefs.chunks.push(Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(args[0]));
        }
        return (oldWrite as (typeof res)['write']).apply(res, args);
      }) as (typeof res)['write'];
      res.end = ((...args: Parameters<(typeof res)['end']>) => {
        if (args[0] && prefs.chunks) {
          prefs.chunks.push(Buffer.isBuffer(args[0]) ? args[0] : Buffer.from(args[0]));
        }
        return oldEnd.apply(res, args);
      }) as (typeof res)['end'];
    }

    if (config?.preLog) {
      const [url, preInfo] = getBasicInfo(req);
      const preLog: Record<string, string | string[] | number | undefined> = {
        ...preInfo,
        t: 'pre',
        ref: req.headers.referer || undefined,
        sid: (req as WithIdentifiedSession).session?.id,
        c: req.headers.correlationid || undefined,
      };
      const msg = service.getLogFields?.(req as RequestWithApp<SLocals>, preLog) || url;
      logger.info(preLog, msg);
    }

    const logWriter = (err?: Error) => finishLog(app, err, req, res, histogram);
    res.on('finish', logWriter);
    res.on('close', logWriter);
    res.on('error', logWriter);
    next();
  };
}

export function errorHandlerMiddleware<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(app: ServiceExpress<SLocals>, histogram: Histogram, unnest?: boolean, returnError?: boolean) {
  const svcErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
    let loggable: Partial<ServiceError> = error;
    const body = error.response?.body || error.body;
    if (unnest && body?.domain && body?.code && body?.message) {
      loggable = {
        status: error.status,
        message: body.message,
        domain: body.domain,
        code: body.code,
        display_message: body.display_message,
        ...loggable.client_metadata,
      };
    }
    // Set the status to error, even if we aren't going to render the error.
    res.status(loggable.status || 500);
    if (returnError) {
      finishLog(app, error, req, res, histogram);
      const prefs = (res.locals as WithLogPrefs)[LOG_PREFS];
      prefs.logged = true;
      res.json({
        code: loggable.code,
        message: loggable.message,
        domain: loggable.domain,
        display_message: loggable.display_message,
        ...loggable.client_metadata,
      });
    } else {
      next(error);
    }
  };
  return svcErrorHandler;
}

export function notFoundMiddleware() {
  const serviceNotFoundHandler: ServiceHandler = (req, res, next) => {
    const error = new ServiceError(req.app, `Cannot ${req.method} ${req.path}`, {
      status: 404,
      code: 'NotFound',
      domain: 'http',
    });
    next(error);
  };
  return serviceNotFoundHandler as RequestHandler;
}
