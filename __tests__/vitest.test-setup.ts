import { afterAll, beforeAll } from 'vitest';

import { shutdownGlobalTelemetry, startGlobalTelemetry } from '../src/telemetry';

const startPromise = startGlobalTelemetry('fake-serv');

beforeAll(async () => {
  await startPromise;
});

afterAll(async () => {
  await shutdownGlobalTelemetry();
});
