import path from 'path';

import express from 'express';

import type { AnyServiceLocals, ServiceExpress, ServiceLocals } from '../types';
import { ConfigurationSchema } from '../config/schema';

import { getFilesInDir, loadModule } from './modules';

export async function loadRoutes<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(app: ServiceExpress<SLocals>, routingDir: string, pattern: string) {
  const files = await getFilesInDir(pattern, routingDir);

  await Promise.all(
    files.map(async (filename) => {
      const routeBase = path.dirname(filename);
      const modulePath = path.resolve(routingDir, filename);
      const module = await loadModule(modulePath);
      const mounter = module.default || module.route;
      if (typeof mounter === 'function') {
        const childRouter = express.Router();
        mounter(childRouter, app);
        const pathParts = [''];
        if (routeBase !== '.') {
          pathParts.push(routeBase);
        }
        const fn = path.parse(path.basename(filename)).name;
        if (fn.toLowerCase() !== 'index') {
          pathParts.push(fn);
        }
        const finalPath = pathParts.join('/') || '/';
        app.locals.logger.debug({ path: finalPath, source: filename }, 'Registering routes');
        app.use(finalPath, childRouter);
      } else {
        app.locals.logger.warn({ filename }, 'Route file had no default export');
      }
    }),
  );
}
