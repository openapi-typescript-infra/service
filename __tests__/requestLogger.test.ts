import type { NextFunction, Request, Response } from 'express';
import { describe, expect, test, vi } from 'vitest';

import { ServiceError } from '../src/error.js';
import { notFoundMiddleware } from '../src/telemetry/requestLogger.js';

function getNotFoundError(serviceName: string) {
  const next = vi.fn();
  const req = {
    app: { locals: { name: serviceName } },
    method: 'GET',
    path: '/missing',
  } as unknown as Request;

  void notFoundMiddleware()(req, {} as unknown as Response, next as NextFunction);

  const error = next.mock.calls[0]?.[0];
  expect(error).toBeInstanceOf(ServiceError);
  return error as ServiceError;
}

describe('notFoundMiddleware', () => {
  test.each(['app-web', 'rest-api', 'graphql-api'])(
    'marks a 404 from public service %s as expected',
    (serviceName) => {
      const error = getNotFoundError(serviceName);

      expect(error.status).toBe(404);
      expect(error.expected_error).toBe(true);
    },
  );

  test.each(['identity-internal', 'worker', 'api-worker'])(
    'keeps a 404 from non-public service %s unexpected',
    (serviceName) => {
      const error = getNotFoundError(serviceName);

      expect(error.status).toBe(404);
      expect(error.expected_error).toBe(false);
    },
  );
});
