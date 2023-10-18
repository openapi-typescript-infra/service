import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import * as opentelemetry from '@opentelemetry/sdk-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

import type {
  DelayLoadServiceStartOptions,
  RequestLocals,
  ServiceLocals,
  ServiceStartOptions,
} from '../types';
import type { ListenFn, StartAppFn } from '../express-app/index';
import type { ConfigurationSchema } from '../config/schema';

import { getAutoInstrumentations, getResourceDetectors } from './instrumentations';
import { DummySpanExporter } from './DummyExporter';

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

function getExporter() {
  if (
    !process.env.DISABLE_OLTP_EXPORTER &&
    ['production', 'staging'].includes(process.env.APP_ENV || process.env.NODE_ENV || '')
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
export function startGlobalTelemetry(serviceName: string) {
  if (!prometheusExporter) {
    prometheusExporter = new PrometheusExporter({ preventServerStart: true });
    telemetrySdk = new opentelemetry.NodeSDK({
      serviceName,
      autoDetectResources: true,
      traceExporter: getExporter(),
      resourceDetectors: getResourceDetectors(),
      metricReader: prometheusExporter,
      instrumentations: [getAutoInstrumentations()],
    });
    telemetrySdk.start();
  }
}

export function getGlobalPrometheusExporter() {
  return prometheusExporter;
}

export async function shutdownGlobalTelemetry() {
  await prometheusExporter?.shutdown();
  await telemetrySdk?.shutdown();
  telemetrySdk = undefined;
  prometheusExporter = undefined;
}

export async function startWithTelemetry<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
>(options: DelayLoadServiceStartOptions) {
  startGlobalTelemetry(options.name);

  // eslint-disable-next-line import/no-unresolved, @typescript-eslint/no-var-requires
  const { startApp, listen } = require('../express-app/app.js') as {
    startApp: StartAppFn<Config, SLocals, RLocals>;
    listen: ListenFn<Config, SLocals>;
  };
  // eslint-disable-next-line import/no-dynamic-require, global-require, @typescript-eslint/no-var-requires
  const serviceModule = require(options.service);
  const service = serviceModule.default || serviceModule.service;
  const startOptions: ServiceStartOptions<Config, SLocals> = {
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
  return { app, server };
}
