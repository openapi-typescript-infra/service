import module from 'node:module';

module.register('import-in-the-middle/hook.mjs', import.meta.url, {
  parentURL: import.meta.url,
  data: {
    include: [
      'express',
      'pino',
      'http',
      'dns',
      'net',
      'pg',
      'ioredis',
      'undici',
      'generic-pool',
    ],
  },
});
