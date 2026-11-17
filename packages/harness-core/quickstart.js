// One command instead of three hand-written JSON files. From a repository, a
// running preview URL and the user's task in their own words, build the minimum
// valid Experience Spec, a desktop + phone Capture Plan for that page, and the
// project config `start` reads. The files go outside the product repository so
// the checkout stays clean for isolated execution.

import {basename, resolve} from 'node:path';

export const QUICKSTART_CONFIGURATIONS = Object.freeze([
  {id: 'desktop', viewport: {width: 1280, height: 800}},
  {id: 'phone', viewport: {width: 390, height: 844}}
]);

export function buildQuickstartInputs({repo, url, task, name, request}) {
  if (!repo || !url || !task?.trim()) throw Error('quickstart needs --repo PATH, --url PREVIEW_URL and --task "what the user is trying to do".');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw Error('--url must be an HTTP(S) preview URL without credentials.');
  const root = resolve(repo);
  const projectName = name?.trim() || basename(root);
  const evidence = [], findings = [];
  // A concrete change the user asked for is kept as a requested change, not
  // relabelled as a defect (see SKILL.md "Starting a run").
  if (request?.trim()) {
    evidence.push({id: 'E-request', state: 'page', observation: `User request: ${request.trim()}`, origin: 'authored-sample'});
    findings.push({id: 'REQUEST', title: request.trim().slice(0, 120), evidenceIds: ['E-request'], impact: 3, confidence: 3, effort: 2, proposal: `Requested change, not an observed defect: ${request.trim()}`});
  }
  const spec = {
    version: '0.1',
    project: {
      name: projectName,
      goal: task.trim(),
      audience: 'People using this product',
      task: task.trim(),
      source: 'Created by happyhands quickstart from the user\'s own description of the task.'
    },
    evidence,
    findings,
    review: {status: 'not-started', before: '', after: '', judgment: 'pending', reason: ''}
  };
  const capturePlan = {
    schemaVersion: '0.1',
    adapter: 'web',
    configurations: QUICKSTART_CONFIGURATIONS,
    states: [{id: 'page', start: {url: parsed.href}, actions: []}]
  };
  const config = {version: '0.1', spec: 'experience.json', repo: root, url: parsed.href, mode: 'review', capturePlan: 'capture-plan.json'};
  return {spec, capturePlan, config};
}
