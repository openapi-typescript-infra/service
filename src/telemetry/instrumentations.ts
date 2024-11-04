import { IncomingMessage} from 'http';

import type { Request } from 'express';
import type { Instrumentation } from '@opentelemetry/instrumentation';
import { DnsInstrumentation } from '@opentelemetry/instrumentation-dns';
import { ExpressInstrumentation, ExpressInstrumentationConfig } from '@opentelemetry/instrumentation-express';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { GenericPoolInstrumentation } from '@opentelemetry/instrumentation-generic-pool';
import { HttpInstrumentation, HttpInstrumentationConfig } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NetInstrumentation } from '@opentelemetry/instrumentation-net';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

const InstrumentationMap = {
  '@opentelemetry/instrumentation-http': HttpInstrumentation,
  '@opentelemetry/instrumentation-dns': DnsInstrumentation,
  '@opentelemetry/instrumentation-express': ExpressInstrumentation,
  '@opentelemetry/instrumentation-undici': UndiciInstrumentation,
  '@opentelemetry/instrumentation-generic-pool': GenericPoolInstrumentation,
  '@opentelemetry/instrumentation-ioredis': IORedisInstrumentation,
  '@opentelemetry/instrumentation-net': NetInstrumentation,
  '@opentelemetry/instrumentation-pg': PgInstrumentation,
  '@opentelemetry/instrumentation-pino': PinoInstrumentation,
};

// Config types inferred automatically from the first argument of the constructor
type ConfigArg<T> = T extends new (...args: infer U) => unknown ? U[0] : never;
export type InstrumentationConfigMap = {
  [Name in keyof typeof InstrumentationMap]?: ConfigArg<(typeof InstrumentationMap)[Name]>;
} & {
  // Add optional global ignore patterns
  ignoreIncomingPaths?: string[];
};

// Add default ignored endpoints
const DEFAULT_IGNORED_ENDPOINTS = ['/health', '/metrics'];

// Add helper function to create span names
function createSpanName(method: string, route: string): string {
  return `${method.toUpperCase()} ${route}`;
}

export function getAutoInstrumentations(
  inputConfigs: InstrumentationConfigMap = {},
): Instrumentation[] {
  const keys = Object.keys(InstrumentationMap) as Array<keyof typeof InstrumentationMap>;
  const ignorePaths = [...DEFAULT_IGNORED_ENDPOINTS, ...(inputConfigs.ignoreIncomingPaths || [])];
  
  return keys
    .map((name) => {
      const Instance = InstrumentationMap[name];
      // Create a base config from user input or empty object
      const userConfig = { ...(inputConfigs[name] || {}) };

      // Configure HTTP instrumentation
      if (name === '@opentelemetry/instrumentation-http') {
        const httpConfig = userConfig as HttpInstrumentationConfig;
        httpConfig.ignoreIncomingRequestHook = (request) => {
          const path = request.url?.split('?')[0] || '/';
          return ignorePaths.includes(path);
        };
        httpConfig.requestHook = (span, request) => {
          const method = request.method || 'UNKNOWN';
          const path = (request instanceof IncomingMessage ? request.url : request.path)?.split('?')[0] || '/';
          span.updateName(createSpanName(method, path));
        };
      }

      // Configure Express instrumentation
      if (name === '@opentelemetry/instrumentation-express') {
        const expressConfig = userConfig as ExpressInstrumentationConfig;
        expressConfig.ignoreLayers = ignorePaths;
        expressConfig.requestHook = (span, req) => {
          const method = req.request?.method || 'UNKNOWN';
          // Use the matched route path instead of raw URL if available
          const route = (req.request as Request).route?.path || req.request?.url?.split('?')[0] || '/';
          span.updateName(createSpanName(method, route));
        };
      }

      try {
        return new Instance(userConfig);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`Failed to load ${name}`, e);
        return null;
      }
    })
    .filter((i) => !!i) as Instrumentation[];
}
