export type ValidEnv = 'development' | 'production' | 'sandbox' | 'staging' | 'test';

export function getNodeEnv(): ValidEnv {
  switch (process.env.APP_ENV || process.env.NODE_ENV) {
    case 'production':
    case 'sandbox':
    case 'staging':
    case 'test':
      return (process.env.APP_ENV || process.env.NODE_ENV) as ValidEnv;
    case undefined:
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

export function isSandbox() {
  return getNodeEnv() === 'sandbox';
}

export function isStaging() {
  return getNodeEnv() === 'staging';
}

export function isTest() {
  return getNodeEnv() === 'test';
}
