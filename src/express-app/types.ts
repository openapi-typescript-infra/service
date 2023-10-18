import type { NextFunction, Response } from 'express';

import type { AnyServiceLocals, RequestLocals, RequestWithApp, ServiceLocals } from '../types';
import { ConfigurationSchema } from '../config/schema';

export type ServiceHandler<
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
  ResBody = unknown,
  RetType = unknown,
> = (
  req: RequestWithApp<SLocals>,
  res: Response<ResBody, RLocals>,
  next: NextFunction,
) => RetType | Promise<RetType>;

// Make it easier to declare route files. This is not an exhaustive list
// of supported router methods, but it has the most common ones.
export interface ServiceRouter<
  Config extends ConfigurationSchema = ConfigurationSchema,
  SLocals extends ServiceLocals<Config> = ServiceLocals<Config>,
  RLocals extends RequestLocals = RequestLocals,
> {
  all(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  get(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  post(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  put(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  delete(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  patch(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  options(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  head(path: string, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  use(...handlers: ServiceHandler<SLocals, RLocals>[]): void;
}
