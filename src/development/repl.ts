import repl, { REPLServer } from 'repl';
import fs from 'fs';
import path from 'path';

import { glob } from 'glob';
import { set } from 'moderndash';

import { AnyServiceLocals, ServiceExpress, ServiceLocals } from '../types.js';
import { ConfigurationSchema } from '../config/schema.js';

const REPL_PROP = '$$repl$$';

interface WithReplProp {
  [REPL_PROP]?: string;
}

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
    // Use iTerm2's escape code to copy to clipboard
    pbcopy(str: string) {
      const encoded = Buffer.from(str.toString(), 'utf8').toString('base64');
      process.stdout.write(`\x1b]52;c;${encoded}\x07`);
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

async function loadReplFunctions<SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>>(
  app: ServiceExpress<SLocals>,
  codepath: string | undefined,
  rl: REPLServer,
) {
  if (!codepath) {
    return;
  }

  const files = glob.sync(path.join(codepath, '**/*.{js,ts}'));

  for (const file of files) {
    try {
      // Read the file content as text
      const fileContent = fs.readFileSync(file, 'utf-8');

      // Check if repl$ is present, in a very rudimentary way (note built JS has close paren not open)
      if (/repl\$[()]/.test(fileContent)) {
        const module = await import(path.resolve(file));

        // Look for functions with the REPL_PROP marker
        Object.values(module).forEach((exported) => {
          if (!exported) {
            return;
          }
          if (typeof exported === 'function') {
            const replName = (exported as WithReplProp)[REPL_PROP];
            if (replName) {
              set(rl.context, replName, exported.bind(null, app));
            }
          }
        });
      }
    } catch (err) {
      console.error(`Failed to load REPL functions from ${file}:`, err);
    }
  }
}

// Can't seem to sort out proper generics here, so we'll just use any since it's dev only
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReplAny = any;

/**
 * This decorator-like function can be applied to functions and the service will load and expose
 * the function when the repl is engaged.
 *
 * async function myFunction(app: MyService['App'], arg1: string, arg2: number) {
 * }
 * repl$(myFunction);
 *
 * or
 *
 * repl(myFunction, 'some.func.name');
 */
export function repl$<
  S extends ServiceExpress<ReplAny>,
  T extends (app: S, ...args: ReplAny[]) => ReplAny
>(fn: T, name?: string) {
  const functionName = name || fn.name;
  if (!functionName) {
    throw new Error('Function must have a name or a name must be provided.');
  }
  Object.defineProperty(fn, REPL_PROP, {
    enumerable: false,
    value: functionName,
  });
}
