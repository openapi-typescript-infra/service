import net from 'net';

import { isTest } from '../env.js';

// Inspired by https://github.com/kessler/find-port/blob/master/lib/findPort.js
async function isAvailable(port: number) {
  return new Promise((accept, reject) => {
    const server = net.createServer().listen(port);

    const timeoutRef = setTimeout(() => {
      accept(false);
    }, 2000);

    timeoutRef.unref();

    server.once('listening', () => {
      clearTimeout(timeoutRef);
      server.close();
      accept(true);
    });
    server.once('error', (err) => {
      clearTimeout(timeoutRef);

      if ((err as { code?: string }).code === 'EADDRINUSE') {
        accept(false);
        return;
      }

      reject(err);
    });
  });
}

async function findPort(start: number) {
  for (let p = start; p < start + 1000; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await isAvailable(p)) {
      return p;
    }
  }
  return 0;
}

async function getEphemeralPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(0, () => {
      const address = server.address();
      if (typeof address === 'string' || !address) {
        reject(new Error('Invalid address'));
        return;
      }
      const port = address.port; // Retrieve the ephemeral port
      server.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve(port);
        }
      });
    });
  });
}

export async function getAvailablePort(basePort: number): Promise<number> {
  return isTest() || process.env.TEST_RUNNER ? getEphemeralPort() : findPort(basePort);
}
