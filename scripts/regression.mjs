import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runRegression } from '../packages/skill-core/regression.js';

const args = process.argv.slice(2);
const options = {};
for (let index = 0; index < args.length; index += 2) {
  if (!['--output', '--baseline'].includes(args[index]) || !args[index + 1]) throw new Error('Usage: pnpm regression [--output FILE] [--baseline FILE]');
  options[args[index].slice(2)] = args[index + 1];
}
const corpus = JSON.parse(await readFile(new URL('../regression/cases.json', import.meta.url), 'utf8'));
const baseline = options.baseline ? JSON.parse(await readFile(resolve(options.baseline), 'utf8')) : null;
if (baseline && (baseline.schemaVersion !== '0.1' || !Array.isArray(baseline.cases))) throw new Error('Invalid regression baseline report.');
const report = await runRegression(corpus, { baseline });
if (options.output) {
  await mkdir(dirname(resolve(options.output)), { recursive: true });
  await writeFile(resolve(options.output), JSON.stringify(report, null, 2) + '\n');
}
console.log(`${report.cases.filter(entry => entry.passed).length}/${report.cases.length} regression cases passed. Review required: ${report.requiresReview}.`);
for (const entry of report.cases.filter(entry => !entry.passed)) console.error(`${entry.id}: ${entry.failures.join('; ')}`);
if (!report.passed || report.requiresReview) process.exitCode = 1;
