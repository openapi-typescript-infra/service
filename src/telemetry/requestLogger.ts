import type { RequestHandler, Request, Response, ErrorRequestHandler } from 'express';

import { ServiceError } from '../error';
import type { AnyServiceLocals, RequestWithApp, ServiceExpress, ServiceLocals } from '../types';
import type { ServiceHandler } from '../express-app/types';
import { ConfigurationSchema } from '../config/schema';

const LOG_PREFS = Symbol('Logging information');

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
}

function getBasicInfo(req: Request) {
  const url = req.originalUrl || req.url;

  const preInfo: Record<string, string> = {
    url,
    m: req.method,
  };

  return preInfo;
}

function finishLog<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  error: Error | undefined,
  req: Request,
  res: Response,
) {
  const prefs = (res.locals as WithLogPrefs)[LOG_PREFS];
  if (prefs.logged) {
    // This happens when error handler runs, but onEnd hasn't fired yet. We only log the first one.
    return;
  }

  const { logger, service } = app.locals;
  const hrdur = process.hrtime(prefs.start);

  const dur = hrdur[0] + hrdur[1] / 1000000000;
  const endLog: Record<string, string | string[] | number | undefined> = {
    ...getBasicInfo(req),
    s: (error as ErrorWithStatus)?.status || res.statusCode || 0,
    dur,
  };

  if (res.locals.user?.id) {
    endLog.u = res.locals.user.id;
  }

  if (error) {
    endLog.e = error.message;
    if (!(error instanceof ServiceError) || error.log_stack) {
      endLog.st = error.stack;
    }
  }

  if (prefs.logRequests) {
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

  service.getLogFields?.(req as RequestWithApp<SLocals>, endLog);
  logger.info(endLog, 'req');
}

export function loggerMiddleware<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(app: ServiceExpress<SLocals>, logRequests?: boolean, logResponses?: boolean): RequestHandler {
  const { logger, service } = app.locals;
  return function gblogger(req, res, next) {
    const prefs: LogPrefs = {
      start: process.hrtime(),
      logRequests,
      chunks: logResponses ? [] : undefined,
      logged: false,
    };

    (res.locals as WithLogPrefs)[LOG_PREFS] = prefs;

    if (logResponses) {
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

    const preLog: Record<string, string | string[] | number | undefined> = {
      ...getBasicInfo(req),
      ref: req.headers.referer || undefined,
      sid: (req as WithIdentifiedSession).session?.id,
      c: req.headers.correlationid || undefined,
    };
    service.getLogFields?.(req as RequestWithApp<SLocals>, preLog);
    logger.info(preLog, 'pre');

    const logWriter = () => finishLog(app, undefined, req, res);
    res.on('finish', logWriter);
    next();
  };
}

export function errorHandlerMiddleware<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(app: ServiceExpress<SLocals>, unnest?: boolean, returnError?: boolean) {
  const gbErrorHandler: ErrorRequestHandler = (error, req, res, next) => {
    let loggable: Partial<ServiceError> = error;
    const body = error.response?.body || error.body;
    if (unnest && body?.domain && body?.code && body?.message) {
      loggable = {
        status: error.status,
        message: body.message,
        domain: body.domain,
        code: body.code,
        display_message: body.display_message,
      };
    }
    // Set the status to error, even if we aren't going to render the error.
    res.status(loggable.status || 500);
    if (returnError) {
      finishLog(app, error, req, res);
      const prefs = (res.locals as WithLogPrefs)[LOG_PREFS];
      prefs.logged = true;
      res.json({
        code: loggable.code,
        message: loggable.message,
        domain: loggable.domain,
        display_message: loggable.display_message,
      });
    } else {
      next(error);
    }
  };
  return gbErrorHandler;
}

export function notFoundMiddleware() {
  const gbNotFoundHandler: ServiceHandler = (req, res, next) => {
    const error = new ServiceError(req.app, `Cannot ${req.method} ${req.path}`, {
      status: 404,
      code: 'NotFound',
      domain: 'http',
    });
    next(error);
  };
  return gbNotFoundHandler as RequestHandler;
}
