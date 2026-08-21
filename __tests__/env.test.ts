import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  getNodeEnv,
  isDev,
  isProd,
  isSandbox,
  isStaging,
  isTest,
} from '../src/env.js';

describe.sequential('service environment', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('recognizes sandbox as a first-class environment', () => {
    vi.stubEnv('APP_ENV', 'sandbox');
    vi.stubEnv('NODE_ENV', 'production');

    expect(getNodeEnv()).toBe('sandbox');
    expect(isSandbox()).toBe(true);
    expect(isDev()).toBe(false);
    expect(isProd()).toBe(false);
    expect(isStaging()).toBe(false);
    expect(isTest()).toBe(false);
  });

  test('continues to default unknown environments to development', () => {
    vi.stubEnv('APP_ENV', 'unknown');
    vi.stubEnv('NODE_ENV', 'production');

    expect(getNodeEnv()).toBe('development');
    expect(isDev()).toBe(true);
    expect(isSandbox()).toBe(false);
  });
});
