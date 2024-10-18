import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import {
  envDetectorSync,
  hostDetectorSync,
  osDetectorSync,
  processDetectorSync,
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

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
opentelemetry.api.diag.setLogger(new (opentelemetry.api.DiagConsoleLogger)(), opentelemetry.api.DiagLogLevel.INFO);

function getExporter() {
  if (
    !process.env.DISABLE_OLTP_EXPORTER &&
    (['production', 'staging'].includes(process.env.APP_ENV || process.env.NODE_ENV || '') ||
      process.env.OTLP_EXPORTER)
  ) {
    return new OTLPTraceExporter({
      url: process.env.OTLP_EXPORTER || 'http://otlp-exporter:4318/v1/traces',
    });
  }
  if (process.env.ENABLE_CONSOLE_OLTP_EXPORTER) {
    return new opentelemetry.tracing.ConsoleSpanExporter();
  }
  return new DummySpanExporter();
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
export async function startGlobalTelemetry(serviceName: string) {
  if (!prometheusExporter) {
    prometheusExporter = new PrometheusExporter({ preventServerStart: true });
    const instrumentations = getAutoInstrumentations();
    telemetrySdk = new opentelemetry.NodeSDK({
      serviceName,
      autoDetectResources: false,
      traceExporter: getExporter(),
      resourceDetectors: [
        envDetectorSync,
        hostDetectorSync,
        osDetectorSync,
        processDetectorSync,
        containerDetector,
        gcpDetector,
      ],
      metricReader: prometheusExporter,
      instrumentations,
      logRecordProcessors: [],
      views: [
        new opentelemetry.metrics.View({
          instrumentName: 'http_request_duration_seconds',
          instrumentType: opentelemetry.metrics.InstrumentType.HISTOGRAM,
          aggregation: new opentelemetry.metrics.ExplicitBucketHistogramAggregation(
            [0.003, 0.03, 0.1, 0.3, 1.5, 10],
            true,
          ),
        }),
      ],
    });
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
  await startGlobalTelemetry(options.name);

  // eslint-disable-next-line import/no-unresolved, @typescript-eslint/no-var-requires
  const { startApp, listen } = require('../express-app/app.js') as {
    startApp: StartAppFn<SLocals, RLocals>;
    listen: ListenFn<SLocals>;
  };
  // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
  const serviceModule = require(options.service);
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
