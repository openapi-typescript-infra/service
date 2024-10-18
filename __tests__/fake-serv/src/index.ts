import type { Service, ServiceLocals } from '../../../src/types.js';
import { useService } from '../../../src/index.js';

export interface FakeServLocals extends ServiceLocals {
  services: {
    fakeServ: {
      get_something(): { things: string[] } | Error;
    };
  };
}

export function service(): Service<FakeServLocals> {
  const base = useService<FakeServLocals>();
  return {
    ...base,
    async start(app) {
      await base.start(app);
      app.locals.services = app.locals.services || {};
      app.locals.services.fakeServ = {
        get_something() {
          throw new Error('Should not be called.');
        },
      };
    },
    async onRequest(req, res) {
      await base.onRequest?.(req, res);
      res.locals.rawBody = true;
    },
    async healthy(app) {
      await base.healthy?.(app);
      return new Promise((accept) => {
        setTimeout(accept, 1000);
      });
    },
  };
}
