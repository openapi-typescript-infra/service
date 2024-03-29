export function getNodeEnv() {
  switch (process.env.APP_ENV || process.env.NODE_ENV) {
    case 'production':
    case 'staging':
    case 'test':
      return process.env.APP_ENV || process.env.NODE_ENV;
    default:
      return 'development';
  }
}

export function isDev() {
  return getNodeEnv() === 'development';
}

export function isProd() {
  return getNodeEnv() === 'production';
}

export function isStaging() {
  return getNodeEnv() === 'staging';
}

export function isTest() {
  return getNodeEnv() === 'test';
}
