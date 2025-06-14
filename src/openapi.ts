import path from 'path';

import { merge } from 'moderndash';
import * as OpenApiValidator from 'express-openapi-validator';
import { OpenAPIFramework } from 'express-openapi-validator/dist/framework/index.js';
import type { Handler, Request, RequestHandler } from 'express';

import type { AnyServiceLocals, ServiceExpress, ServiceLocals } from './types.js';
import { getNodeEnv } from './env.js';
import { getFilesInDir } from './express-app/modules.js';
import { ConfigurationSchema } from './config/schema.js';

const notImplementedHandler: Handler = (req, res) => {
  res.status(501).json({
    code: 'NotImplemented',
    domain: 'http',
    message: 'This method is not yet implemented',
  });
};

type OAPIOpts = Parameters<typeof OpenApiValidator.middleware>[0];

function stripExtension(filename: string) {
  return filename.slice(0, filename.lastIndexOf('.'));
}

export async function openApi<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(
  app: ServiceExpress<SLocals>,
  rootDirectory: string,
  codepath: string,
  pattern: string,
  openApiOptions?: Partial<OAPIOpts>,
) {
  const apiSpec = path.resolve(rootDirectory, `./api/${app.locals.name}.yaml`);
  app.locals.logger.debug({ apiSpec, codepath }, 'Serving OpenAPI');

  const basePath = path.resolve(rootDirectory, `${codepath}/handlers`);
  // Because of the weirdness of ESM/CJS interop, and the synchronous nature of
  // the OpenAPI resolver, we need to preload all the modules we might need
  const moduleFiles = await getFilesInDir(
    pattern,
    path.resolve(rootDirectory, `${codepath}/handlers`),
  );
  const preloadedModules = await Promise.all(
    moduleFiles.map((file) => {
      const fullPath = path.join(basePath, file);
      return import(fullPath).catch((error) => {
        app.locals.logger.warn(
          { file: fullPath, message: error.message },
          'Could not load potential API handler',
        );
        return undefined;
      });
    }),
  );
  const modulesByPath = moduleFiles.reduce(
    (acc, file, index) => {
      const m = preloadedModules[index];
      if (m) {
        acc[`/${stripExtension(file)}`] = m;
      }
      return acc;
    },
    {} as Record<string, Record<string, unknown>>,
  );

  // This is nuts, but there are testing frameworks or some other things
  // that seem to set window in Node. The OpenAPI infra will fail under that
  // circumstance.
  const _window = global.window;
  if (_window) {
    delete (global as { window: unknown }).window;
  }

  try {
    app.locals.openApiSpecification = await new OpenAPIFramework({ apiDoc: apiSpec })
      .initialize({ visitApi() {} })
      .then((docs) => docs.apiDoc)
      .catch((error) => {
        app.locals.logger.error(error, 'Failed to parse and load OpenAPI spec');
      });

    const defaultOptions: OAPIOpts = {
      apiSpec: app.locals.openApiSpecification,
      ignoreUndocumented: true,
      validateRequests: {
        allowUnknownQueryParameters: true,
        coerceTypes: 'array',
      },
      operationHandlers: {
        basePath,
        resolver(
          basePath: string,
          route: Parameters<typeof OpenApiValidator.resolvers.defaultResolver>[1],
        ) {
          const pathKey = route.openApiRoute.substring(route.basePath.length);
          const modulePath = path.join(basePath, pathKey);

          try {
            const module = modulesByPath[pathKey];
            const method = module
              ? Object.keys(module).find((m) => m.toUpperCase() === route.method)
              : undefined;
            if (!module || !method) {
              throw new Error(
                `Could not find a [${route.method}] function in ${modulePath} when trying to route [${route.method} ${route.expressRoute}].`,
              );
            }
            return module[method] as RequestHandler;
          } catch (error) {
            app.locals.logger.error(
              {
                error: (error as Error).message,
                pathKey,
                modulePath: path.relative(rootDirectory, modulePath),
              },
              'Failed to load API method handler',
            );
            return notImplementedHandler;
          }
        },
      },
    };

    const { routing } = app.locals.config;
    const combinedOptions = {
      // In test mode, validate returned swagger responses. This can easily be disabled
      // by setting validateResponses to false in the config.
      ...(getNodeEnv() === 'test'
        ? {
            validateResponses: {
              onError(error: Error, body: unknown, req: Request) {
                console.log('Response body fails validation: ', error);
                console.log('Emitted from:', req.originalUrl);
                console.debug(body);
                throw error;
              },
            },
          }
        : {}),
      ...(typeof routing.openapi === 'object' ? routing.openapi : {}),
      ...openApiOptions,
    };

    return OpenApiValidator.middleware(merge(defaultOptions, combinedOptions));
  } finally {
    if (_window) {
      (global as { window: unknown }).window = _window;
    }
  }
}
