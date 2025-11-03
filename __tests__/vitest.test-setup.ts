import { afterAll, beforeAll } from 'vitest';

import { shutdownGlobalTelemetry, startGlobalTelemetry } from '../src/telemetry/index.js';

// Even in testing, this needs to run first so that the instrumentation
// is loaded BEFORE express is loaded.
const startPromise = startGlobalTelemetry('fake-serv');

beforeAll(async () => {
  await startPromise;
});

afterAll(async () => {
  await shutdownGlobalTelemetry().catch(() => undefined);
});
