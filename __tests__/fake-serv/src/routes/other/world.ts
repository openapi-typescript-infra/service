import type { Router } from 'express';

export function route(router: Router) {
  router.get('/', (req, res) => {
    res.json({ hello: 'jupiter' });
  });
}
