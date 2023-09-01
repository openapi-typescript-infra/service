/* eslint-disable import/no-default-export */
declare module 'shortstop-handlers' {
  export function require(module: string): ReturnType<NodeRequire>;
  export function env(): (envVarName: string) => string | undefined;
  export function base64(): (blob: string) => Buffer;
  export function path(baseDir?: string): (relativePath: string) => string;
  export function file(
    baseDir?: string,
  ): (
    relativePath: string,
    cb: (err: Error | null, result?: Buffer | string | undefined) => void,
  ) => void;
}

declare module 'shortstop-yaml' {
  export default function yaml<T>(
    basepath: string,
  ): (path: string, callback: (error?: Error, result?: T) => void) => void;
}

declare module 'shortstop-dns' {
  export default function dns(opts?: {
    family?: number;
    all?: boolean;
  }): (address: string, callback: (error?: Error, result?: string[]) => void) => void;
}

declare module '@gasbuddy/confit' {
  type Json = ReturnType<typeof JSON.parse>;

  export type ProtocolFn<CallbackType> = (
    value: Json,
    callback?: (error: Error | null, result?: CallbackType) => void,
  ) => void;

  interface ProtocolsSetPrivate<C> {
    [protocol: string]: ProtocolFn<C> | ProtocolFn<C>[];
  }

  interface ConfigStore {
    get<T>(name: string): T | undefined;
    set<T>(name: string, newValue: T): T;
    use(newSettings: unknown): void;
  }

  type Options<C> = {
    basedir: string;
    protocols: ProtocolsSetPrivate<C>;
  };

  interface ConfigFactory {
    create(callback: (err: Error, config: ConfigStore) => unknown): void;
    addOverride(filepathOrSettingsObj: string | object): this;
    addDefault(filepathOrSettingsObj: string | object): this;
  }

  function confit<C>(optionsOrBaseDir: Options<C> | string): ConfigFactory;

  namespace confit {
    export type ProtocolsSet<C> = ProtocolsSetPrivate<C>;
  }

  export default confit;
}
