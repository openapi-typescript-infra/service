import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-proto';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  detectResources,
  envDetector,
  hostDetector,
  osDetector,
  processDetector,
} from '@opentelemetry/resources';
import { containerDetector } from '@opentelemetry/resource-detector-container';
import { gcpDetector } from '@opentelemetry/resource-detector-gcp';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

import type {
  AnyServiceLocals,
  DelayLoadServiceStartOptions,
  RequestLocals,
  ServiceLocals,
  ServiceStartOptions,
} from '../types.js';
import type { ListenFn, StartAppFn } from '../express-app/index.js';
import type { ConfigurationSchema } from '../config/schema.js';

import { getAutoInstrumentations } from './instrumentations.js';
import { DummySpanExporter } from './DummyExporter.js';

// OTLP seems to only support http, and this is a default on the local network so I'm keeping it.
// NOSONAR
const baseDefaultOtlpUrl = new URL('http://otlp-exporter:4318/v1').toString();

function getSpanExporter() {
  if (
    !process.env.DISABLE_OLTP_EXPORTER &&
    (['production', 'staging'].includes(process.env.APP_ENV || process.env.NODE_ENV || '') ||
      process.env.OTLP_EXPORTER)
  ) {
    return new OTLPTraceExporter({
      url: process.env.OTLP_EXPORTER || `${baseDefaultOtlpUrl}/traces`,
    });
  }
  if (process.env.ENABLE_CONSOLE_OLTP_EXPORTER) {
    return new opentelemetry.tracing.ConsoleSpanExporter();
  }
  return new DummySpanExporter();
}

function getLogExporter() {
  if (
    !process.env.DISABLE_OLTP_EXPORTER &&
    (['production', 'staging'].includes(process.env.APP_ENV || process.env.NODE_ENV || '') ||
      process.env.OTLP_EXPORTER)
  ) {
    return new OTLPLogExporter({
      url: process.env.OTLP_EXPORTER || `${baseDefaultOtlpUrl}/logs`,
    });
  }
  if (process.env.ENABLE_CONSOLE_OLTP_EXPORTER) {
    return new opentelemetry.logs.ConsoleLogRecordExporter();
  }
  return undefined;
}

let prometheusExporter: PrometheusExporter | undefined;
let telemetrySdk: opentelemetry.NodeSDK | undefined;

/**
 * OpenTelemetry is not friendly to the idea of stopping
 * and starting itself, it seems. So we can only keep a global
 * instance of the infrastructure no matter how many times
 * you start/stop your service (this is mostly only relevant for testing).
 * In addition, since we have to load it right away before configuration
 * is available, we can't use configuration to decide anything.
 */
export async function startGlobalTelemetry(
  serviceName: string,
  customizer?:
    | ((
        options: Partial<opentelemetry.NodeSDKConfiguration>,
      ) => Partial<opentelemetry.NodeSDKConfiguration>)
    | undefined,
) {
  if (!prometheusExporter) {
    const { metrics, logs, NodeSDK } = opentelemetry;

    const resource = await detectResources({
      detectors: [
        envDetector,
        hostDetector,
        osDetector,
        processDetector,
        containerDetector,
        gcpDetector,
      ],
    });

    prometheusExporter = new PrometheusExporter({ preventServerStart: true });
    const instrumentations = getAutoInstrumentations();
    const logExporter = getLogExporter();
    const options: Partial<opentelemetry.NodeSDKConfiguration> = {
      serviceName,
      autoDetectResources: false,
      resource,
      traceExporter: getSpanExporter(),
      metricReader: prometheusExporter,
      instrumentations,
      logRecordProcessors: logExporter ? [new logs.BatchLogRecordProcessor(logExporter)] : [],
      views: [
        {
          instrumentName: 'http_request_duration_seconds',
          instrumentType: metrics.InstrumentType.HISTOGRAM,
          aggregation: {
            type: metrics.AggregationType.EXPLICIT_BUCKET_HISTOGRAM,
            options: {
              boundaries: [0.003, 0.03, 0.1, 0.3, 1.5, 10],
              recordMinMax: true,
            },
          },
        },
      ],
    };
    telemetrySdk = new NodeSDK(customizer ? customizer(options) : options);
    telemetrySdk.start();
  }
}

export function getGlobalPrometheusExporter() {
  return prometheusExporter;
}

export async function shutdownGlobalTelemetry() {
  await telemetrySdk?.shutdown();
  telemetrySdk = undefined;
  prometheusExporter = undefined;
}

export async function startWithTelemetry<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
>(options: DelayLoadServiceStartOptions) {
  await startGlobalTelemetry(options.name, options.customizer);

  // eslint-disable-next-line import/no-unresolved, @typescript-eslint/no-var-requires
  const { startApp, listen } = (await import('../express-app/app.js')) as {
    startApp: StartAppFn<SLocals, RLocals>;
    listen: ListenFn<SLocals>;
  };
  const serviceModule = await import(options.service);
  const service = serviceModule.default || serviceModule.service;
  const startOptions: ServiceStartOptions<SLocals> = {
    ...options,
    service,
    locals: { ...options.locals } as Partial<SLocals>,
  };
  const app = await startApp(startOptions);
  app.locals.logger.info('OpenTelemetry enabled');

  const server = await listen(app, async () => {
    await shutdownGlobalTelemetry();
    app.locals.logger.info('OpenTelemetry shut down');
  });
  return { app, codepath: options.codepath, server };
}

export { setTelemetryHooks } from './instrumentations.js';
