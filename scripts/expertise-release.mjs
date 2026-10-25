#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { activateSkillRelease, createSkillRelease } from '../packages/skill-core/releases.js';

const [command, ...args] = process.argv.slice(2), options = {};
for (let index=0; index<args.length; index+=2) {
  if (!args[index]?.startsWith('--') || !args[index+1]) throw new Error('Every option needs a value.');
  options[args[index].slice(2)] = args[index+1];
}
const need = key => { if (!options[key]) throw new Error(`Missing --${key}`); return options[key]; };
if (command === 'publish') {
  const report = JSON.parse(await readFile(resolve(need('report')), 'utf8'));
  console.log(JSON.stringify(await createSkillRelease({ version: need('version'), reviewer: need('reviewer'), reason: need('reason'), regressionReport: report }), null, 2));
} else if (command === 'activate' || command === 'rollback') {
  console.log(JSON.stringify(await activateSkillRelease({ version: need('version'), reviewer: need('reviewer'), reason: need('reason') }), null, 2));
} else {
  console.log('Usage:\n  pnpm expertise publish --version X.Y.Z --report FILE --reviewer NAME --reason TEXT\n  pnpm expertise activate --version X.Y.Z --reviewer NAME --reason TEXT\n  pnpm expertise rollback --version X.Y.Z --reviewer NAME --reason TEXT');
}
