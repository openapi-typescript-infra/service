import repl, { REPLServer } from 'repl';
import fs from 'fs';
import path from 'path';

import { glob } from 'glob';

import { AnyServiceLocals, ServiceExpress, ServiceLocals } from '../types';
import { ConfigurationSchema } from '../config/schema';

export function serviceRepl<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  codepath: string | undefined,
  onExit: () => void,
) {
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

  loadReplFunctions(app, codepath, rl);

  rl.on('exit', onExit);
}

function loadReplFunctions<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  codepath: string | undefined,
  rl: REPLServer,
) {
  if (!codepath) {
    return;
  }

  const files = glob.sync(path.join(codepath, '**/*.{js,ts}'));

  files.forEach((file) => {
    try {
      // Read the file content as text
      const fileContent = fs.readFileSync(file, 'utf-8');

      // Check if @repl is present
      if (/addToRepl\(/.test(fileContent)) {
        // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
        const module = require(file); // Only require if @repl is found

        // Look for functions with the __isReplFunction marker
        Object.values(module).forEach((exported) => {
          if (!exported) {
            return;
          }
          if (typeof exported === 'function' || typeof exported === 'object') {
            const obj = exported as Record<string, unknown>;
            for (const key of Object.keys(obj)) {
              if ((obj[key] as { __openApiServiceReplFunction?: boolean }).__openApiServiceReplFunction) {
                const fn = obj[key] as (app: ServiceExpress<SLocals>, ...args: unknown[]) => unknown;
                rl.context[key] = (...args: unknown[]) => fn(app, ...args);
              }
            }
          }
        });
      }
    } catch (err) {
      console.error(`Failed to load REPL functions from ${file}:`, err);
    }
  });
}

/**
 * This decorator-like function can be applied to functions and the service will load and expose
 * the function when the repl is engaged.
 */
export function addToRepl<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  fn: (app: ServiceExpress<SLocals>, ...args: unknown[]) => unknown,
  name?: string,
) {
  const functionName = name || fn.name;
  if (!functionName) {
    throw new Error('Function must have a name or a name must be provided.');
  }
  (fn as unknown as { __openApiServiceReplFunction: string }).__openApiServiceReplFunction = functionName;
}
