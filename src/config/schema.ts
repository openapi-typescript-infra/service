import type { BaseConfitSchema } from '@sesamecare-oss/confit';
import type { middleware } from 'express-openapi-validator';
import type { Level } from 'pino';
import type bodyParser from 'body-parser';

export interface ConfigurationItemEnabled {
  enabled?: boolean;
}

export interface ConfigurationSchema extends BaseConfitSchema {
  trustProxy?: string[] | boolean;
  logging?: {
    level?: Level;
    logRequestBody?: boolean;
    logResponseBody?: boolean;
    // Whether to log a "pre" message when request processing starts. Most useful in
    // situations where there is some problem causing requests to hang
    preLog?: boolean;
  };
  routing?: {
    openapi?: boolean | Partial<Parameters<typeof middleware>[0]>;
    // Relative to the *root directory* of the app
    routes?: string;
    // Whether to add middleware that "freezes" the query string
    // rather than preserving the new Express@5 behavior of reparsing
    // every time (which causes problems for OpenAPI validation)
    freezeQuery?: boolean;
    // Whether to compute etag headers. http://expressjs.com/en/api.html#etag.options.table
    etag?: boolean;
    cookieParser?: boolean;
    bodyParsers?: {
      json?: boolean | Parameters<typeof bodyParser.json>[0];
      form?: boolean | Parameters<typeof bodyParser.urlencoded>[0];
    };
    // Set static.enabled to true to enable static assets to be served
    static?: ConfigurationItemEnabled & {
      // The path relative to the root directory of the app
      path?: string;
      // The path on which to mount the static assets (defaults to /)
      mountPath?: string;
    };
    finalHandlers: {
      // Whether to create and return errors for unhandled routes
      notFound?: boolean;
      // Whether to handle errors and return them to clients
      // (currently means we will return JSON errors)
      errors?: ConfigurationItemEnabled & {
        render?: boolean;
        // Check to see if we got an error from an upstream
        // service that has code/domain/message, and if so return
        // that as is. Otherwise we will sanitize it to avoid leaking
        // information.
        unnest: boolean;
      };
    };
  };
  server: {
    internalPort?: number;
    port?: number;
    // To enable HTTPS on the main service, set the key and cert to the
    // actual key material (not the path). Use shortstop file: handler.
    // Note that generally it's better to offload tls termination,
    // but this is useful for dev.
    key?: string | Uint8Array;
    certificate?: string | Uint8Array;
    // If you have an alternate host name (other than localhost) that
    // should be used when referring to this service, set it here.
    hostname?: string;
  };
}
