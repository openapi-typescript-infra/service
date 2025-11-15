import type { ServiceHandler } from '../../../../src/index';
import { repl$ } from '../../../../src/index';
import type { FakeServLocals } from '../index';

export const get: ServiceHandler<FakeServLocals> = async (req, res) => {
  res.json({ greeting: req.query.greeting || 'Hello World' });
};

export const post: ServiceHandler<FakeServLocals> = async (req, res) => {
  res.sendStatus(204);
};

export function thisIsATest() {
  return 'Yes, true';
}

repl$(thisIsATest);
