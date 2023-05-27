import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import * as opentelemetry from '@opentelemetry/sdk-node';

import type {
  DelayLoadServiceStartOptions,
  RequestLocals,
  ServiceLocals,
  ServiceStartOptions,
} from '../types';
import type { ListenFn, StartAppFn } from '../express-app/index';

import { getAutoInstrumentations } from './instrumentations';

// For troubleshooting, set the log level to DiagLogLevel.DEBUG
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO);

function getExporter() {
  if (['production', 'staging'].includes(process.env.APP_ENV || process.env.NODE_ENV || '')) {
    return new OTLPTraceExporter({
      url: process.env.OTLP_EXPORTER || 'http://otlp-exporter:4318/v1/traces',
    });
  }
  return new opentelemetry.tracing.ConsoleSpanExporter();
}

export async function startWithTelemetry<
  SLocals extends ServiceLocals = ServiceLocals,
  RLocals extends RequestLocals = RequestLocals,
>(options: DelayLoadServiceStartOptions) {
  const sdk = new opentelemetry.NodeSDK({
    serviceName: options.name,
    autoDetectResources: true,
    traceExporter: getExporter(),
    instrumentations: [getAutoInstrumentations()],
  });
  await sdk.start();

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
    await sdk.shutdown();
    app.locals.logger.info('OpenTelemetry shut down');
  });
  return { app, server };
}
