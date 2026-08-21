import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, describe, expect, test, vi } from 'vitest';

import type { ConfigurationSchema } from '../src/config/index.js';
import { insertConfigurationBefore, loadConfiguration } from '../src/config/index.js';
import { shortstops } from '../src/config/shortstops.js';

interface CustomConfig extends ConfigurationSchema {
  google: string;
  envswitchon: boolean;
  envswitchoff: boolean;
  servicetype: string;
  oservicetype: string;
  notservicetype: string;
  bash_profile: string;
  inheritedEnvironment: string;
  sandboxOnly: boolean;
}

describe.sequential('configuration loader', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('overrides and shortstops', async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootDirectory = path.resolve(__dirname, './fake-serv');
    const shortstopHandlers = shortstops({ name: 'fake-serv' }, path.join(rootDirectory, 'src'));
    const config = await loadConfiguration<CustomConfig>({
      configurationDirectories: [path.resolve(rootDirectory, './config')],
      shortstopHandlers,
    });

    expect(config.logging?.level).toEqual('debug');
    expect(config.google).toBeTruthy();
    expect(config.google).not.toEqual('google.com');

    expect(config.envswitchoff).toBeFalsy();
    expect(config.envswitchon).toBeTruthy();

    expect(config.servicetype).toBeTruthy();
    expect(config.oservicetype).toBeTruthy();
    expect(config.notservicetype).toBeFalsy();

    expect(config.bash_profile).toEqual(path.join(os.homedir(), '.bash_profile'));
    expect(config.env.sandbox).toBe(false);

    const orig = ['a', 'b', 'd'];
    const withC = insertConfigurationBefore(orig, 'c', 'd');
    expect(withC).toEqual(['a', 'b', 'c', 'd']);
    const withE = insertConfigurationBefore(orig, 'e', 'q');
    expect(withE).toEqual(['a', 'b', 'd', 'e', 'q']);
    expect(insertConfigurationBefore(undefined, 'a', 'b')).toEqual(['a', 'b']);
    expect(insertConfigurationBefore([], 'a', 'b')).toEqual(['a', 'b']);
  });

  test('loads sandbox configuration through the full default stack', async () => {
    vi.stubEnv('APP_ENV', 'sandbox');

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const rootDirectory = path.resolve(__dirname, './fake-serv');
    const shortstopHandlers = shortstops({ name: 'fake-serv' }, path.join(rootDirectory, 'src'));
    const config = await loadConfiguration<CustomConfig>({
      configurationDirectories: [
        path.resolve(__dirname, './fake-defaults'),
        path.resolve(rootDirectory, './config'),
      ],
      shortstopHandlers,
    });

    expect(config.env.env).toBe('sandbox');
    expect(config.env.sandbox).toBe(true);
    expect(config.sandboxOnly).toBe(true);
    expect(config.inheritedEnvironment).toBe('sandbox');
  });
});
