import path from 'node:path';
import assert from 'node:assert';

import { config } from 'dotenv';
import { readPackageUp } from 'read-package-up';
import type { NormalizedPackageJson } from 'read-package-up';

import type { AnyServiceLocals, RequestLocals, ServiceLocals, ServiceStartOptions } from './types.js';
import { isDev } from './env.js';
import { startWithTelemetry } from './telemetry/index.js';
import { ConfigurationSchema } from './config/schema.js';

interface BootstrapArguments {
  // The name of the service, else discovered via read-package-up
  name?: string;
  // The name of the file with the service function, relative to root
  main?: string;
  // Root directory of the app, else discovered via read-package-up
  root?: string;
  // Use built directory. Omitting lets us determine a sensible default
  built?: boolean;
  // The location of the package.json used for discovery (defaults to cwd)
  packageDir?: string;
  // Whether to engage telemetry
  telemetry?: boolean;
  // Don't bind to http port or expose metrics
  nobind?: boolean;
  // The version of the app, else discovered via read-package-up
  version?: string;
}

function resolveMain(packageJson: NormalizedPackageJson) {
  if (typeof packageJson.main === 'string') {
    return packageJson.main;
  }
  return undefined;
}

async function getServiceDetails(argv: BootstrapArguments = {}) {
  if (argv.name && argv.root) {
    return {
      rootDirectory: argv.root,
      name: argv.name,
      version: argv.version || '0.0.0',
      main: argv.main || (isDev() && !argv.built ? 'src/index.ts' : 'build/index.js'),
    };
  }
  const cwd = argv.packageDir ? path.resolve(argv.packageDir) : process.cwd();
  const pkg = await readPackageUp({ cwd });
  if (!pkg) {
    throw new Error(
      `Unable to find package.json in ${cwd} to get main module. Make sure you are running from the package root directory.`,
    );
  }
  const main = resolveMain(pkg.packageJson);
  const parts = pkg.packageJson.name.split('/');
  return {
    main,
    rootDirectory: path.dirname(pkg.path),
    name: parts[parts.length - 1],
    version: pkg.packageJson.version,
  };
}

function getBuildDir(main: string): 'build' | 'dist' {
  const dir = /^(?:\.?\/?)(build|dist)\//.exec(main);
  assert(dir, 'Could not determine build directory - should be dist or build');
  return dir[1] as 'build' | 'dist';
}

// Automagically start your app by using common patterns
// to find your implementation and settings. This is most useful
// for jobs or other scripts that need service infra but are
// not simply the service
export async function bootstrap<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
>(argv?: BootstrapArguments) {
  const { main, rootDirectory, name, version } = await getServiceDetails(argv);

  let entrypoint: string;
  let codepath: 'build' | 'dist' | 'src' = 'build';
  if (isDev() && argv?.built !== true) {
    // eslint-disable-next-line import/no-extraneous-dependencies
    const { register } = await import('ts-node');
    register();
    if (main) {
      entrypoint = main.replace(/^(\.?\/?)(build|dist)\//, '$1src/').replace(/\.js$/, '.ts');
    } else {
      entrypoint = './src/index.ts';
    }
    codepath = 'src';
  } else if (main) {
    codepath = getBuildDir(main);
    entrypoint = main;
  } else {
    entrypoint = './build/index.js';
  }

  config();

  const absoluteEntrypoint = path.resolve(rootDirectory, entrypoint);
  if (argv?.telemetry) {
    return startWithTelemetry<SLocals, RLocals>({
      name,
      rootDirectory,
      service: absoluteEntrypoint,
      codepath,
      version,
    });
  }

  // This needs to be required for TS on-the-fly to work
  // eslint-disable-next-line global-require, import/no-dynamic-require, @typescript-eslint/no-var-requires
  const impl = await import(absoluteEntrypoint);
  const opts: ServiceStartOptions<SLocals, RLocals> = {
    name,
    version,
    rootDirectory,
    service: impl.default || impl.service,
    codepath,
  };
  // eslint-disable-next-line import/no-unresolved
  const { startApp, listen } = await import('./express-app/app.js');
  const app = await startApp<SLocals, RLocals>(opts);
  const server = argv?.nobind ? undefined : await listen(app);
  return { server, app, codepath };
}
