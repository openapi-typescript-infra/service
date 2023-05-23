import diagch from 'node:diagnostics_channel';

import { SemanticAttributes } from '@opentelemetry/semantic-conventions';
import { Instrumentation, InstrumentationConfig } from '@opentelemetry/instrumentation';
import {
  Attributes,
  context,
  propagation,
  Span,
  SpanKind,
  SpanStatusCode,
  trace,
  Tracer,
  TracerProvider,
} from '@opentelemetry/api';
import { Meter, MeterProvider, metrics } from '@opentelemetry/api-metrics';

interface ListenerRecord {
  name: string;
  channel: diagch.Channel;
  onMessage: diagch.ChannelListener;
}

interface FetchRequestArguments {
  request: {
    path: string;
    method: string;
    origin: string;
    headers: string;
  };
  span: Span;
  additionalHeaders: Record<string, unknown>;
  error?: Error;
}

type ErrorFetchRequestArguments = FetchRequestArguments & { error: Error; };
type ResponseFetchRequestArguments = FetchRequestArguments & {
  response: {
    statusCode: number;
    headers: Buffer[];
  };
};

interface FetchInstrumentationConfig extends InstrumentationConfig {
  onRequest?: (args: FetchRequestArguments) => void;
}

// Get the content-length from undici response headers.
// `headers` is an Array of buffers: [k, v, k, v, ...].
// If the header is not present, or has an invalid value, this returns null.
function contentLengthFromResponseHeaders(headers: Buffer[]) {
  const name = 'content-length';
  for (let i = 0; i < headers.length; i += 2) {
    const k = headers[i];
    if (k.length === name.length && k.toString().toLowerCase() === name) {
      const v = Number(headers[i + 1]);
      if (!Number.isNaN(Number(v))) {
        return v;
      }
      return undefined;
    }
  }
  return undefined;
}

// A combination of https://github.com/elastic/apm-agent-nodejs and
// https://github.com/gadget-inc/opentelemetry-instrumentations/blob/main/packages/opentelemetry-instrumentation-undici/src/index.ts
export class FetchInstrumentation implements Instrumentation {
  // Keep ref to avoid https://github.com/nodejs/node/issues/42170 bug and for
  // unsubscribing.
  private channelSubs: ListenerRecord[];

  private spanFromReq = new WeakMap<object, Span>();

  private tracer: Tracer;

  private config: FetchInstrumentationConfig;

  private meter: Meter;

  public readonly instrumentationName = 'opentelemetry-instrumentation-node-18-fetch';

  public readonly instrumentationVersion = '1.0.0';

  public readonly instrumentationDescription = 'Instrumentation for Node 18 fetch via diagnostics_channel';

  private subscribeToChannel(diagnosticChannel: string, onMessage: diagch.ChannelListener) {
    const channel = diagch.channel(diagnosticChannel);
    channel.subscribe(onMessage);
    this.channelSubs.push({
      name: diagnosticChannel,
      channel,
      onMessage,
    });
  }

  constructor(config: FetchInstrumentationConfig) {
    // Force load fetch API (since it's lazy loaded in Node 18)
    fetch('').catch(Promise.resolve);
    this.channelSubs = [];
    this.meter = metrics.getMeter(this.instrumentationName, this.instrumentationVersion);
    this.tracer = trace.getTracer(this.instrumentationName, this.instrumentationVersion);
    this.config = { ...config };
  }

  disable(): void {
    this.channelSubs?.forEach((sub) => sub.channel.unsubscribe(sub.onMessage));
  }

  enable(): void {
    this.subscribeToChannel('undici:request:create', (args) => this.onRequest(args as FetchRequestArguments));
    this.subscribeToChannel('undici:request:headers', (args) => this.onHeaders(args as ResponseFetchRequestArguments));
    this.subscribeToChannel('undici:request:trailers', (args) => this.onDone(args as FetchRequestArguments));
    this.subscribeToChannel('undici:request:error', (args) => this.onError(args as ErrorFetchRequestArguments));
  }

  setTracerProvider(tracerProvider: TracerProvider): void {
    this.tracer = tracerProvider.getTracer(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  public setMeterProvider(meterProvider: MeterProvider): void {
    this.meter = meterProvider.getMeter(
      this.instrumentationName,
      this.instrumentationVersion,
    );
  }

  setConfig(config: InstrumentationConfig): void {
    this.config = { ...config };
  }

  getConfig(): InstrumentationConfig {
    return this.config;
  }

  onRequest({ request }: FetchRequestArguments): void {
    // We do not handle instrumenting HTTP CONNECT. See limitation notes above.
    if (request.method === 'CONNECT') {
      return;
    }
    const span = this.tracer.startSpan(`HTTP ${request.method}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        [SemanticAttributes.HTTP_URL]: String(request.origin),
        [SemanticAttributes.HTTP_METHOD]: request.method,
        [SemanticAttributes.HTTP_TARGET]: request.path,
        'http.client': 'fetch',
      },
    });
    const requestContext = trace.setSpan(context.active(), span);
    const addedHeaders: Record<string, string> = {};
    propagation.inject(requestContext, addedHeaders);

    if (this.config.onRequest) {
      this.config.onRequest({ request, span, additionalHeaders: addedHeaders });
    }

    request.headers += Object.entries(addedHeaders)
      .map(([k, v]) => `${k}: ${v}\r\n`)
      .join('');
    this.spanFromReq.set(request, span);
  }

  onHeaders({ request, response }: ResponseFetchRequestArguments): void {
    const span = this.spanFromReq.get(request);

    if (span !== undefined) {
      // We are currently *not* capturing response headers, even though the
      // intake API does allow it, because none of the other `setHttpContext`
      // uses currently do.

      const cLen = contentLengthFromResponseHeaders(response.headers);
      const attrs: Attributes = {
        [SemanticAttributes.HTTP_STATUS_CODE]: response.statusCode,
      };
      if (cLen) {
        attrs[SemanticAttributes.HTTP_RESPONSE_CONTENT_LENGTH] = cLen;
      }
      span.setAttributes(attrs);
      span.setStatus({
        code: response.statusCode >= 400 ? SpanStatusCode.ERROR : SpanStatusCode.OK,
        message: String(response.statusCode),
      });
    }
  }

  onDone({ request }: FetchRequestArguments): void {
    const span = this.spanFromReq.get(request);
    if (span !== undefined) {
      span.end();
      this.spanFromReq.delete(request);
    }
  }

  onError({ request, error }: ErrorFetchRequestArguments): void {
    const span = this.spanFromReq.get(request);
    if (span !== undefined) {
      span.recordException(error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.end();
    }
  }
}
