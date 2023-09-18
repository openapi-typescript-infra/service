import { ExportResultCode } from '@opentelemetry/core';
import type { SpanExporter } from '@opentelemetry/sdk-trace-base';

const noop: SpanExporter['export'] = (spans, resultCallback) => {
  setImmediate(() =>
    resultCallback({
      code: ExportResultCode.SUCCESS,
    }),
  );
};

export class DummySpanExporter implements SpanExporter {
  export = noop;

  async shutdown() {
    // Nothing to do
  }
}
