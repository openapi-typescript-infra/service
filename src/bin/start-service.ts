#!/usr/bin/env node
import minimist from 'minimist';

import { serviceRepl } from '../development/repl.js';
import { isDev } from '../env.js';
import { bootstrap } from '../bootstrap.js';

/**
 * built - forces the use of the build directory. Defaults to true in stage/prod, not in dev
 * repl - launch the REPL (defaults to disabling telemetry)
 * telemetry - whether to use OpenTelemetry. Defaults to false in dev or with repl
 * nobind - do not listen on http port or expose metrics
 */
const argv = minimist(process.argv.slice(2), {
  boolean: ['built', 'repl', 'telemetry', 'nobind'],
});

if (argv.telemetry) {
  await import('../telemetry/hook-modules.js');
}

const noTelemetry = (argv.repl || isDev()) && !argv.telemetry;
void bootstrap({
  ...argv,
  telemetry: !noTelemetry,
}).then(({ app, codepath, server }) => {
  if (argv.repl) {
    serviceRepl(app, codepath, () => {
      server?.close();
    });
  }
});
