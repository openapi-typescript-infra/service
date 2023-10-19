#!/usr/bin/env node
import fs from 'fs';
import { spawnSync } from 'child_process';

import Ajv from 'ajv';
import standaloneCode from 'ajv/dist/standalone';
import minimist from 'minimist';

// Generate an AJV validator from a Typescript type
// This is mostly included since we already have AJV,
// and we want you to use it to validate configurations.
const argv = minimist(process.argv.slice(2));

async function run() {
  // First we need to run typescript-json-schema to
  // generate the JSON schema. We use npx to avoid the
  // runtime dependency.
  const tsJsonSchema = spawnSync(
    'npx',
    [
      '-y',
      'typescript-json-schema',
      argv.tsconfig || 'tsconfig.build.json',
      argv.type,
      '--required',
      '--noExtraProps',
      '--strictNullChecks',
      '--include',
      argv.source || 'src/types/config.ts',
    ],
    {
      stdio: 'pipe',
      encoding: 'utf-8',
    },
  );
  if (tsJsonSchema.status !== 0) {
    console.error(tsJsonSchema.stderr);
    process.exit(1);
  }
  const schema = JSON.parse(tsJsonSchema.stdout);

  const ajv = new Ajv({ code: { source: true, esm: true } });
  const validate = ajv.compile(schema);
  const moduleCode = standaloneCode(ajv, validate);
  if (argv.output) {
    fs.writeFileSync(argv.output, `// @ts-nocheck\n${moduleCode}\n`);
  } else {
    console.log(moduleCode);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
