import type { ShutdownConfiguration } from '../config/schema.js';
import { getNodeEnv, isDev } from '../env.js';
import type { ServiceLogger } from '../types.js';

export function shutdownConfiguration(
  config: ShutdownConfiguration = {},
): Required<ShutdownConfiguration> {
  const settings = {
    routingDelayMs: config.routingDelayMs ?? (isDev() || getNodeEnv() === 'test' ? 0 : 10000),
    beforeHttpDrainTimeoutMs: config.beforeHttpDrainTimeoutMs ?? 5000,
    httpDrainTimeoutMs: config.httpDrainTimeoutMs ?? 15000,
    serviceStopTimeoutMs: config.serviceStopTimeoutMs ?? 30000,
    shutdownHandlerTimeoutMs: config.shutdownHandlerTimeoutMs ?? 10000,
  };
  for (const [key, value] of Object.entries(settings)) {
    const minimum = key === 'routingDelayMs' ? 0 : 1;
    if (!Number.isInteger(value) || value < minimum || value > 2147483647) {
      throw new Error(
        `server.shutdown.${key} must be an integer between ${minimum} and 2147483647`,
      );
    }
  }
  return settings;
}

/** A timeout bounds waiting, not the underlying operation; the process exits after shutdown. */
export async function runShutdownPhase(
  logger: ServiceLogger,
  phase: string,
  timeoutMs: number,
  action: () => void | Promise<void>,
) {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  logger.info({ phase, timeoutMs }, 'Shutdown phase beginning');
  try {
    await Promise.race([
      Promise.resolve().then(action),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Shutdown phase ${phase} timed out after ${timeoutMs}ms`)),
          timeoutMs,
        );
      }),
    ]);
    logger.info({ phase, durationMs: Date.now() - startedAt }, 'Shutdown phase complete');
  } catch (err) {
    logger.error(
      { err, phase, timeoutMs, durationMs: Date.now() - startedAt },
      'Shutdown phase failed',
    );
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
