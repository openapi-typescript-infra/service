import { ServiceHandler } from '../../../../src/index.js';
import { FakeServLocals } from '../index.js';

export const get: ServiceHandler<FakeServLocals> = async (req, res) => {
  res.json({ greeting: req.query.greeting || 'Hello World' });
};

export const post: ServiceHandler<FakeServLocals> = async (req, res) => {
  res.sendStatus(204);
};
