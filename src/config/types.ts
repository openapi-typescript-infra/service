export interface ConfigStore {
  // Confit supports more things (e.g. use), but that's not how we
  // intend it to be used.
  get<T>(name: string): T | undefined;
  set<T>(name: string, value: T): void;
}
