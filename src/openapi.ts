import path from 'path';

import _ from 'lodash';
import * as OpenApiValidator from 'express-openapi-validator';
import type { Handler } from 'express';

import type { ServiceExpress } from './types';
import { getFilesInDir, loadModule } from './express-app/modules';

const notImplementedHandler: Handler = (req, res) => {
  res.status(501).json({
    code: 'NotImplemented',
    domain: 'http',
    message: 'This method is not yet implemented',
  });
};

type OAPIOpts = Parameters<typeof OpenApiValidator.middleware>[0];

export async function openApi(
  app: ServiceExpress,
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
      return loadModule(fullPath).catch((error) => {
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
        acc[`/${path.basename(file, path.extname(file))}`] = m;
      }
      return acc;
    },
    {} as Record<string, Record<string, unknown>>,
  );

  const defaultOptions: OAPIOpts = {
    apiSpec,
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
          return module[method];
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

  return OpenApiValidator.middleware(_.defaultsDeep(defaultOptions, openApiOptions || {}));
}
