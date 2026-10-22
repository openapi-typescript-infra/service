import { createHash } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Duplex } from 'node:stream';

import express from 'express';
import { pino } from 'pino';

import { listen } from '../../src/express-app/app.js';
import type { ServiceExpress } from '../../src/types.js';
import { useService } from '../../src/hook.js';

const mode = process.argv[2];
const send = (type: string) => process.send?.({ type });
const sockets = new Set<Duplex>();
const app = express() as unknown as ServiceExpress;
let releaseSlow: (() => void) | undefined;
const hang = () => new Promise<void>(() => {});
Object.assign(app.locals, {
  name: 'shutdown-test',
  version: '1',
  logger: pino(),
  config: {
    server: {
      port: 0,
      shutdown: {
        routingDelayMs: 350,
        beforeHttpDrainTimeoutMs: 250,
        httpDrainTimeoutMs: 500,
        serviceStopTimeoutMs: 250,
        shutdownHandlerTimeoutMs: 250,
      },
    },
  },
  service: useService({
    start() {},
    attachServer(_app, server) {
      server.on('upgrade', (request, socket) => {
        const accept = createHash('sha1')
          .update(`${request.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest('base64');
        socket.write(
          `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`,
        );
        sockets.add(socket);
        socket.on('data', () => socket.end());
        socket.on('close', () => sockets.delete(socket));
        socket.on('error', () => sockets.delete(socket));
      });
    },
    async beforeHttpDrain() {
      send('before-http-drain');
      if (mode === 'hook-hang') {
        await hang();
      }
      if (mode === 'hook-throw') {
        throw new Error('connection cleanup failed');
      }
      await Promise.all(
        [...sockets].map(
          (socket) =>
            new Promise<void>((resolve) => {
              socket.once('close', resolve);
              // Minimal RFC 6455 server close frame: status 1001 (going away).
              socket.write(Buffer.from([0x88, 0x02, 0x03, 0xe9]));
            }),
        ),
      );
    },
    async stop() {
      send('stop');
      if (mode === 'stop-hang') {
        await hang();
      }
      if (mode === 'stop-throw') {
        throw new Error('resource cleanup failed');
      }
      if (mode === 'repeat-signal') {
        // An additional SIGTERM during cleanup must not abort the finalizer.
        process.kill(process.pid, 'SIGTERM');
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    },
  }),
});
app.get('/fast', (_req, res) => {
  res.json({ ok: true });
});
app.get('/slow', async (_req, res) => {
  send('slow-started');
  await new Promise<void>((resolve) => {
    releaseSlow = resolve;
  });
  res.json({ ok: true });
});
process.on('message', (message) => {
  if (message === 'release-slow') {
    releaseSlow?.();
  }
});
const server = await listen(app, async () => {
  send('finalizer');
  if (mode === 'finalizer-hang') {
    await hang();
  }
  if (mode === 'finalizer-throw') {
    throw new Error('telemetry cleanup failed');
  }
});
process.send?.({ type: 'ready', port: (server.address() as AddressInfo).port });
