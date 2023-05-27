import type { RequestLocals, Service, ServiceLocals } from './types';

/**
 * Your service should call this function and then "inherit"
 * the behavior in a functional way. So,
 *
 * const myServiceFn = () => {
 *   const baseService = useService<YourService>();
 *   return {
 *     ...baseService,
 *     async start(app) {
 *       await baseService.start(app);
 *       // your start stuff goes here
 *     },
 *     async onRequest(req, res) {
 *       // This might throw (auth for example), so don't catch it
 *       await baseService?.onRequest(req, res);
 *     },
 *   }
 * }
 *
 * @returns Service<SLocals, RLocals>
 */
export function useService<
  SLocals extends ServiceLocals = ServiceLocals,
  RLocals extends RequestLocals = RequestLocals,
>(baseService?: Service<SLocals, RLocals>): Service<SLocals, RLocals> {
  return {
    async start(app) {
      await baseService?.start(app);
      // Do nothing. This hook exists mainly to reduce change required
      // to adopt your specific companies base service.
    },
  };
}
