import { glob } from 'glob';

export async function getFilesInDir(pattern: string, dir: string) {
  const files = await glob(pattern, {
    nodir: true,
    cwd: dir,
    ignore: ['**/*.spec.@(js|ts)', '**/*.test.@(js|ts)', '**/*.fixtures.@(js|ts)'],
  });
  return files;
}
