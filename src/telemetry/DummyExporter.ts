import { SpanExporter } from '@opentelemetry/sdk-trace-base';

export class DummySpanExporter implements SpanExporter {
  export() {
    // Nothing
  }

  async shutdown() {
    // Nothing
  }
}
