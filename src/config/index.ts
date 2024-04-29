import fs from 'fs';
import path from 'path';

import {
  BaseConfitSchema,
  Confit,
  Factory,
  ShortstopHandler,
  confit,
} from '@sesamecare-oss/confit';

import { getAvailablePort } from '../development/port-finder';

import type { ConfigurationSchema } from './schema';

// Order matters here.
const ENVIRONMENTS = ['production', 'staging', 'test', 'development'] as const;

async function pathExists(f: string) {
  return new Promise((accept, reject) => {
    fs.stat(f, (err) => {
      if (!err) {
        accept(true);
      } else if (err.code === 'ENOENT') {
        accept(false);
      } else {
        reject(err);
      }
    });
  });
}

async function addDefaultConfiguration<Config extends ConfigurationSchema = ConfigurationSchema>(
  configFactory: Factory<Config>,
  directory: string,
  envConfit: Confit<BaseConfitSchema>,
) {
  const addIfEnv = async (e: (typeof ENVIRONMENTS)[number]) => {
    const c = path.join(directory, `${e}.json`);
    if (envConfit.get().env[e] && (await pathExists(c))) {
      configFactory.addDefault(c);
      return true;
    }
    return false;
  };

  await ENVIRONMENTS.reduce(
    (runningPromise, environment) => runningPromise.then((prev) => prev || addIfEnv(environment)),
    Promise.resolve(false),
  );

  const baseConfig = path.join(directory, 'config.json');
  if (await pathExists(baseConfig)) {
    configFactory.addDefault(baseConfig);
  }
}

export interface ServiceConfigurationSpec {
  // The LAST configuration is the most "specific" - if a configuration value
  // exists in all directories, the last one wins
  configurationDirectories: string[];
  shortstopHandlers: Record<string, ShortstopHandler<string, unknown>>;
}

export async function loadConfiguration<Config extends ConfigurationSchema>({
  configurationDirectories: dirs,
  shortstopHandlers,
}: ServiceConfigurationSpec): Promise<Config> {
  const specificConfig = dirs[dirs.length - 1];

  // This confit version just gets us environment info
  const envConfit = await confit({ basedir: specificConfig }).create();
  const configFactory = confit<Config>({
    basedir: specificConfig,
    protocols: shortstopHandlers,
  });

  /**
   * Note that in confit, when using addDefault,
   * the FIRST addDefault takes precendence over the next (and so on), so
   * if you override this method, you should register your defaults first.
   */
  const defaultOrder = dirs.slice(0, dirs.length - 1).reverse();
  defaultOrder.push(path.join(__dirname, '../..', 'config'));
  await defaultOrder.reduce(
    (promise, dir) => promise.then(() => addDefaultConfiguration(configFactory, dir, envConfit)),
    Promise.resolve(),
  );

  const loaded = await configFactory.create();

  // Because other things need to know the port we choose, we pick it here if it's
  // configured to auto-select
  const serverConfig = loaded.get().server;
  if (serverConfig.port === 0) {
    const port = await getAvailablePort(8001);
    const store = loaded.get();
    store.server = store.server || {};
    store.server.port = port;
  }

  // TODO init other stuff based on config here, such as key management or
  // other cloud-aware shortstop handlers

  // Not sure why this is necessary, but it is
  return loaded.get();
}

export function insertConfigurationBefore(
  configDirs: string[] | undefined,
  insert: string,
  before: string,
) {
  const copy = [...(configDirs || [])];
  const index = copy.indexOf(before);
  if (index === -1) {
    copy.push(insert, before);
  } else {
    copy.splice(index, 0, insert);
  }
  return copy;
}

export * from './schema';
export * from './validation';
