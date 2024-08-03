import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';

export class DummySpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (r: ExportResult) => void) {
    setImmediate(() =>
      resultCallback({
        code: ExportResultCode.SUCCESS,
      }),
    );
  }

  async shutdown() {
    // Nothing to do
  }
}
