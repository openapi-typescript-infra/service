import { fork } from 'node:child_process';
import { Agent, request } from 'node:http';
import { fileURLToPath } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import { shutdownConfiguration } from '../src/express-app/shutdown.js';

interface Message {
  type: string;
  port?: number;
}
function childService(mode = 'normal') {
  const child = fork(fileURLToPath(new URL('./fixtures/shutdown.ts', import.meta.url)), [mode], {
    execArgv: ['--import', 'tsx'],
    silent: true,
    env: { ...process.env, NODE_ENV: 'production', APP_ENV: 'production' },
  });
  const messages: Message[] = [];
  let output = '';
  child.on('message', (message: Message) => messages.push(message));
  child.stdout?.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr?.on('data', (chunk) => {
    output += String(chunk);
  });
  const exit = new Promise<{ code: number | null; signal: string | null }>((resolve) => {
    child.once('exit', (code, signal) => resolve({ code, signal }));
  });
  async function wait(type: string) {
    await expect
      .poll(
        () => {
          if (child.exitCode !== null || child.signalCode !== null) {
            throw new Error(`Child exited: ${output}`);
          }
          return messages.find((message) => message.type === type);
        },
        { timeout: 5000, interval: 10 },
      )
      .toBeDefined();
    return messages.find((message) => message.type === type) as Message;
  }
  return {
    child,
    messages,
    exit,
    wait,
    output: () => output,
    async cleanup() {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
        await exit;
      }
    },
  };
}
function get(port: number, path: string, agent?: Agent) {
  return new Promise<{ body: string; socket: unknown }>((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, agent }, (res) => {
      const socket = res.socket;
      let body = '';
      res.on('data', (chunk) => {
        body += String(chunk);
      });
      res.on('end', () => resolve({ body, socket }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

describe('shutdown settings', () => {
  test('preserves deployed/dev defaults and supports an explicit zero routing delay', () => {
    vi.stubEnv('APP_ENV', 'production');
    try {
      expect(shutdownConfiguration()).toEqual({
        routingDelayMs: 10000,
        beforeHttpDrainTimeoutMs: 5000,
        httpDrainTimeoutMs: 15000,
        serviceStopTimeoutMs: 30000,
        shutdownHandlerTimeoutMs: 10000,
      });
      expect(shutdownConfiguration({ routingDelayMs: 0 }).routingDelayMs).toBe(0);
      vi.stubEnv('APP_ENV', 'test');
      expect(shutdownConfiguration().routingDelayMs).toBe(0);
      expect(shutdownConfiguration({ routingDelayMs: 20 }).routingDelayMs).toBe(20);
    } finally {
      vi.unstubAllEnvs();
    }
  });
  test.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2147483648])(
    'rejects invalid timer %s',
    (value) => {
      expect(() => shutdownConfiguration({ routingDelayMs: value })).toThrow('routingDelayMs');
    },
  );
  test('rejects zero cleanup budgets', () => {
    expect(() => shutdownConfiguration({ serviceStopTimeoutMs: 0 })).toThrow(
      'serviceStopTimeoutMs',
    );
  });
});

describe('real SIGTERM shutdown', () => {
  test('serves keep-alive during withdrawal, closes WebSockets cleanly, then drains active HTTP before cleanup', async () => {
    const service = childService();
    const agent = new Agent({ keepAlive: true, maxSockets: 1 });
    let ws: WebSocket | undefined;
    try {
      const { port } = await service.wait('ready');
      const first = await get(port as number, '/fast', agent);
      ws = new WebSocket(`ws://127.0.0.1:${port}`);
      const opened = new Promise<void>((resolve, reject) => {
        ws?.addEventListener('open', () => resolve(), { once: true });
        ws?.addEventListener('error', reject, { once: true });
      });
      const closed = new Promise<number>((resolve) =>
        ws?.addEventListener('close', (event) => resolve(event.code), { once: true }),
      );
      await opened;
      const slow = get(port as number, '/slow');
      const result = slow.then(
        (value) => ({ value }),
        (error) => ({ error }),
      );
      await service.wait('slow-started');
      service.child.kill('SIGTERM');
      await expect.poll(service.output, { interval: 10 }).toContain('Graceful shutdown beginning');
      const during = await get(port as number, '/fast', agent);
      expect(during.socket).toBe(first.socket);
      expect(during.body).toBe('{"ok":true}');
      expect(await closed).toBe(1001);
      await service.wait('before-http-drain');
      expect(service.messages.some((message) => message.type === 'stop')).toBe(false);
      service.child.send('release-slow');
      expect(await result).toMatchObject({ value: { body: '{"ok":true}' } });
      expect(await service.exit).toEqual({ code: 0, signal: null });
      expect(service.messages.map((message) => message.type)).toEqual([
        'ready',
        'slow-started',
        'before-http-drain',
        'stop',
        'finalizer',
      ]);
    } finally {
      ws?.close();
      agent.destroy();
      await service.cleanup();
    }
  }, 10000);

  test.each([
    ['hook-hang', 'service.beforeHttpDrain'],
    ['hook-throw', 'service.beforeHttpDrain'],
    ['stop-hang', 'service.stop'],
    ['stop-throw', 'service.stop'],
    ['finalizer-hang', 'shutdownHandler'],
    ['finalizer-throw', 'shutdownHandler'],
  ])(
    '%s is bounded, reports its phase and attempts the remaining cleanup',
    async (mode, phase) => {
      const service = childService(mode);
      try {
        await service.wait('ready');
        service.child.kill('SIGTERM');
        expect(await service.exit).toEqual({ code: 1, signal: null });
        expect(service.messages.map((message) => message.type)).toContain('finalizer');
        expect(service.output()).toContain(`"phase":"${phase}"`);
        expect(service.output()).toContain('Shutdown phase failed');
        expect(service.output()).not.toContain('Graceful shutdown complete');
      } finally {
        await service.cleanup();
      }
    },
    10000,
  );

  test('retains signal protection through cleanup', async () => {
    const service = childService('repeat-signal');
    try {
      await service.wait('ready');
      service.child.kill('SIGTERM');
      expect(await service.exit).toEqual({ code: 0, signal: null });
      expect(service.messages.filter((message) => message.type === 'stop')).toHaveLength(1);
      expect(service.messages.filter((message) => message.type === 'finalizer')).toHaveLength(1);
    } finally {
      await service.cleanup();
    }
  }, 10000);

  test('forces a stuck HTTP request closed within its configured drain budget', async () => {
    const service = childService();
    try {
      const { port } = await service.wait('ready');
      const slow = get(port as number, '/slow').then(
        () => 'completed',
        () => 'closed',
      );
      await service.wait('slow-started');
      service.child.kill('SIGTERM');
      expect(await service.exit).toEqual({ code: 0, signal: null });
      expect(await slow).toBe('closed');
      expect(service.messages.map((message) => message.type)).toContain('finalizer');
    } finally {
      await service.cleanup();
    }
  }, 10000);
});
