import os from 'os';
import path from 'path';

import { describe, expect, test } from 'vitest';

import { ConfigurationSchema, insertConfigurationBefore, loadConfiguration } from '../src/config';

interface CustomConfig extends ConfigurationSchema {
  google: string;
  envswitchon: boolean;
  envswitchoff: boolean;
  servicetype: string;
  oservicetype: string;
  notservicetype: string;
  bash_profile: string;
}

describe('configuration loader', () => {
  test('overrides and shortstops', async () => {
    const rootDirectory = path.resolve(__dirname, './fake-serv');
    const config = await loadConfiguration<CustomConfig>({
      name: 'fake-serv',
      sourceDirectory: path.join(rootDirectory, 'src'),
      configurationDirectories: [path.resolve(rootDirectory, './config')],
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

    const orig = ['a', 'b', 'd'];
    const withC = insertConfigurationBefore(orig, 'c', 'd');
    expect(withC).toEqual(['a', 'b', 'c', 'd']);
    const withE = insertConfigurationBefore(orig, 'e', 'q');
    expect(withE).toEqual(['a', 'b', 'd', 'e', 'q']);
    expect(insertConfigurationBefore(undefined, 'a', 'b')).toEqual(['a', 'b']);
    expect(insertConfigurationBefore([], 'a', 'b')).toEqual(['a', 'b']);
  });
});
