import os from 'os';
import path from 'path';

import shortstop from 'shortstop-handlers';
import shortstopYaml from 'shortstop-yaml';
import shortstopDns from 'shortstop-dns';
import { ProtocolFn } from '@gasbuddy/confit';

/**
 * Default shortstop handlers for GasBuddy service configuration
 */

/**
 * A require: shortstop that will dig and find a named function
 * with a url-like hash pattern
 */
function betterRequire(basepath: string) {
  const baseRequire = shortstop.require(basepath);
  return function hashRequire(v: string) {
    const [moduleName, func] = v.split('#');
    const module = baseRequire(moduleName);
    if (func) {
      if (module[func]) {
        return module[func];
      }
      return baseRequire(v);
    }
    return module;
  };
}

function canonicalizeServiceSuffix(suffix?: string) {
  if (!suffix) {
    return 'internal';
  }
  return { serv: 'internal' }[suffix] || suffix;
}

/**
 * Our convention is that service names end with:
 *  -serv or -internal - a back end service not callable by the outside world and where no authorization occurs (canonicalized to internal)
 *  -api - a non-UI front end service that exposes swagger and sometimes non-swagger APIs
 *  -web - a UI front end service
 *  -worker - a scheduled job or queue processor
 *
 * This shortstop will take a CSV of service types and tell you if this service is
 * of that type, or if the first character after serviceType: is an exclamation point,
 * whether it's NOT of any of the specified types
 */
function serviceTypeFactory(name: string) {
  const type = canonicalizeServiceSuffix(name.split('-').pop());

  return function serviceType(v: string) {
    let checkValue = v;
    let matchIsGood = true;
    if (checkValue[0] === '!') {
      matchIsGood = false;
      checkValue = checkValue.substring(1);
    }
    const values = checkValue.split(',').map(canonicalizeServiceSuffix);
    // Welp, there's no XOR so here we are.
    return type && values.includes(type) ? matchIsGood : !matchIsGood;
  };
}

const osMethods = {
  hostname: os.hostname,
  platform: os.platform,
  type: os.type,
  version: os.version,
};

export function shortstops(
  service: { name: string; },
  sourcedir: string,
) {
  /**
   * Since we use transpiled sources a lot,
   * basedir and sourcedir are meaningfully different reference points.
   */
  const basedir = path.join(sourcedir, '..');

  const env = shortstop.env();

  return {
    env,
    // A version of env that can default to false
    env_switch(v: string) {
      if (v && v[0] === '!') {
        const bval = env(`${v.substring(1)}|b`);
        return !bval;
      }
      return !!env(v);
    },
    base64: shortstop.base64(),
    regex(v: string) {
      const [, pattern, flags] = v.match(/^\/(.*)\/([a-z]*)/) || [];
      return new RegExp(pattern, flags);
    },

    // handle source and base directory intelligently
    path: shortstop.path(basedir),
    sourcepath: shortstop.path(sourcedir),
    file: shortstop.file(basedir),
    sourcefile: shortstop.file(sourcedir),
    require: betterRequire(basedir),
    sourcerequire: betterRequire(sourcedir),

    // Sometimes yaml is more pleasant for configuration
    yaml: shortstopYaml(basedir) as ProtocolFn<ReturnType<typeof JSON.parse>>,

    // Switch on service type
    servicetype: serviceTypeFactory(service.name),
    servicename: (v: string) => v.replace(/\$\{name\}/g, service.name),

    os(p: keyof typeof osMethods) {
      return osMethods[p]();
    },
    dns: shortstopDns() as ProtocolFn<string>,
    // No-op in case you have values that start with a shortstop handler name (and colon)
    literal(v: string) {
      return v;
    },
  };
}
