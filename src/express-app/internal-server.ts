import express from 'express';
import type { Application } from 'express-serve-static-core';

import { AnyServiceLocals, InternalLocals, ServiceExpress, ServiceLocals } from '../types';
import { findPort } from '../development/port-finder';
import { ConfigurationSchema } from '../config/schema';

export async function startInternalApp<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
>(mainApp: ServiceExpress<SLocals>, port: number) {
  const app = express() as unknown as Application<InternalLocals<SLocals>>;
  app.locals.mainApp = mainApp;

  const finalPort = port === 0 ? await findPort(3001) : port;

  app.get('/health', async (req, res) => {
    if (mainApp.locals.service?.healthy) {
      try {
        const ok = await mainApp.locals.service.healthy(mainApp);
        res.sendStatus(ok ? 204 : 500);
      } catch (error) {
        mainApp.locals.logger.error(error, 'Health check failed');
      }
    } else {
      res.sendStatus(204);
    }
  });

  const listenPromise = new Promise<void>((accept) => {
    app.locals.server = app.listen(finalPort, () => {
      accept();
    });
    app.locals.server.on('error', (error) => {
      mainApp.locals.logger.error(error, 'Internal app server error');
    });
  });

  await listenPromise;

  mainApp.locals.logger.info({ port: finalPort }, 'Internal metadata server started');

  return app;
}
