import repl from 'repl';
import path from 'path';

import { ServiceExpress, ServiceLocals } from '../types';
import { ConfigurationSchema } from '../config/schema';

export function serviceRepl<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
>(app: ServiceExpress<Config, SLocals>, onExit: () => void) {
  const rl = repl.start({
    prompt: '> ',
  });
  Object.assign(rl.context, app.locals, {
    app,
    dump(o: unknown) {
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(o, null, '\t'));
    },
  });
  rl.setupHistory(path.resolve('.node_repl_history'), (err) => {
    if (err) {
      // eslint-disable-next-line no-console
      console.error('History setup failed', err);
    }
  });
  app.locals.service.attachRepl?.(app, rl);
  rl.on('exit', onExit);
}
