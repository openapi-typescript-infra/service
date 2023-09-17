import { glob } from 'glob';

export async function loadModule(path: string): Promise<Record<string, unknown>> {
  try {
    return require(path);
  } catch (error) {
    if ((error as Error).message.includes('Cannot use import statement outside a module')) {
      return import(path);
    }
    throw error;
  }
}

export async function getFilesInDir(pattern: string, dir: string) {
  const files: string[] = await new Promise((accept, reject) => {
    glob(
      pattern,
      {
        nodir: true,
        strict: true,
        cwd: dir,
        ignore: ['**/*.spec.@(js|ts)', '**/*.test.@(js|ts)', '**/*.fixtures.@(js|ts)'],
      },
      (error, matches) => (error ? reject(error) : accept(matches)),
    );
  });
  return files;
}
