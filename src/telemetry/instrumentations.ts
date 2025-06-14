import type { Instrumentation } from '@opentelemetry/instrumentation';
import { DnsInstrumentation } from '@opentelemetry/instrumentation-dns';
import { ExpressInstrumentation, SpanNameHook } from '@opentelemetry/instrumentation-express';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { GenericPoolInstrumentation } from '@opentelemetry/instrumentation-generic-pool';
import {
  HttpInstrumentation,
  IgnoreIncomingRequestFunction,
} from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NetInstrumentation } from '@opentelemetry/instrumentation-net';
import { GraphQLInstrumentation } from '@opentelemetry/instrumentation-graphql';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';

const InstrumentationMap = {
  '@opentelemetry/instrumentation-http': HttpInstrumentation,
  '@opentelemetry/instrumentation-dns': DnsInstrumentation,
  '@opentelemetry/instrumentation-express': ExpressInstrumentation,
  '@opentelemetry/instrumentation-graphql': GraphQLInstrumentation,
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
};

let ignoreIncomingRequestHook: IgnoreIncomingRequestFunction | undefined = (req) => {
  return req.url === '/health' || req.url === '/metrics';
};

let spanNameHook: SpanNameHook | undefined;

export function setTelemetryHooks(hooks: {
  ignoreIncomingRequestHook?: IgnoreIncomingRequestFunction;
  spanNameHook?: SpanNameHook;
}) {
  if ('ignoreIncomingRequestHook' in hooks) {
    ignoreIncomingRequestHook = hooks.ignoreIncomingRequestHook;
  }
  if ('spanNameHook' in hooks) {
    spanNameHook = hooks.spanNameHook;
  }
}

const defaultConfigs: InstrumentationConfigMap = {
  '@opentelemetry/instrumentation-http': {
    ignoreIncomingRequestHook(req) {
      if (ignoreIncomingRequestHook) {
        return ignoreIncomingRequestHook(req);
      }
      return false;
    },
  },
  '@opentelemetry/instrumentation-express': {
    spanNameHook(info, defaultName) {
      if (spanNameHook) {
        return spanNameHook(info, defaultName);
      }
      return defaultName;
    },
    ignoreLayers: [
      'middleware - serviceLogger',
      'middleware - jsonParser',
      'middleware - attachServiceLocals',
      'middleware - cookieParser',
      'middleware - corsMiddleware',
      'middleware - addReturnHeaders',
      'middleware - freezeQuery',
      'middleware - pathParamsMiddleware',
      'middleware - metadataMiddleware',
      'middleware - multipartMiddleware',
      'middleware - securityMiddleware',
    ],
  },
};

export function getAutoInstrumentations(
  inputConfigs: InstrumentationConfigMap = defaultConfigs,
): Instrumentation[] {
  const keys = Object.keys(InstrumentationMap) as Array<keyof typeof InstrumentationMap>;
  return keys
    .map((name) => {
      const Instance = InstrumentationMap[name];
      // Defaults are defined by the instrumentation itself
      const userConfig = inputConfigs[name] ?? {};

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
