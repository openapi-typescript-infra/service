import type { Instrumentation } from '@opentelemetry/instrumentation';
import { DnsInstrumentation } from '@opentelemetry/instrumentation-dns';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { UndiciInstrumentation } from '@opentelemetry/instrumentation-undici';
import { GenericPoolInstrumentation } from '@opentelemetry/instrumentation-generic-pool';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NetInstrumentation } from '@opentelemetry/instrumentation-net';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import {
  Resource,
  detectResources,
  detectResourcesSync,
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
} from '@opentelemetry/resources';

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
};

export function getAutoInstrumentations(
  inputConfigs: InstrumentationConfigMap = {},
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

// Async function to get combined resources
export async function getResource(): Promise<Resource> {
  const syncDetectors = [
    envDetectorSync,
    hostDetectorSync,
    osDetectorSync,
    processDetectorSync,
  ];
  const asyncDetectors = [
    containerDetector,
    gcpDetector,
  ];

  const asyncResources = await detectResources({ detectors: asyncDetectors });
  const syncResources = detectResourcesSync({ detectors: syncDetectors });

  // Combine async and sync resources
  return syncResources.merge(asyncResources);
}
