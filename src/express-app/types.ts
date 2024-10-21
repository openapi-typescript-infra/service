import type { NextFunction, Response } from 'express';

import type { AnyServiceLocals, RequestLocals, RequestWithApp, ServiceLocals } from '../types.js';
import { ConfigurationSchema } from '../config/schema.js';

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
  SLocals extends AnyServiceLocals = ServiceLocals<ConfigurationSchema>,
  RLocals extends RequestLocals = RequestLocals,
> {
  all(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  get(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  post(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  put(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  delete(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  patch(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  options(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  head(path: string | RegExp, ...handlers: ServiceHandler<SLocals, RLocals>[]): void;
  use(...handlers: ServiceHandler<SLocals, RLocals>[]): void;
}
