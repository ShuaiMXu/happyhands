#!/usr/bin/env node
import {runVerificationChecks} from '../packages/workbench/verification.js';
import {withdrawJudgment} from '../packages/harness-core/store.js';
import {saveRunMemoryException} from '../packages/harness-core/store.js';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRun, loadRun, runFilePath, saveCapture, confirmFinding, savePlan, saveEvaluation, saveJudgment, saveOnboarding, saveDiagnosis, saveVisualReview, recordAbsentBaseline, saveFoundationApproval } from '../packages/harness-core/store.js';
import { captureBrowser, captureBrowserPlan, DEFAULT_VIEWPORTS } from '../packages/harness-core/browser.js';
import { evaluateCaptures, evaluateFirstRender } from '../packages/harness-core/evaluate.js';
import { resolveMode } from '../packages/harness-core/entry.js';
import { executeWithAgent } from '../packages/harness-core/runner.js';
import { listAgents, DEFAULT_AGENT } from '../packages/harness-core/agents.js';
import { exportRun, reindex } from '../packages/harness-core/export.js';
import { inspectRepository, loadProjectConfig, publicProjectConfig, spawnPreview, stopPreview, waitForPreview } from '../packages/harness-core/onboard.js';
import { diagnoseRun, overridePriority } from '../packages/harness-core/diagnosis.js';
import { workflowState } from '../packages/harness-core/workflow.js';
import { executeSkill, loadRegistry } from '../packages/skill-core/runner.js';
import { extractFoundationInventory } from '../packages/skill-core/foundation-inventory.js';
import {captureWithDesignSystem} from '../packages/harness-core/design-system.js';

function argsOf(values) {
  const options = {};
  for (let i = 0; i < values.length; i++) {
    if (!values[i].startsWith('--')) throw new Error(`Expected --option near ${values[i]}`);
    // `--option=value` is the escape hatch for a value that itself starts
    // with `--`, such as a judgment reason quoting a flag.
    const equals = values[i].slice(2).indexOf('=');
    if (equals > 0) {
      options[values[i].slice(2, 2 + equals)] = values[i].slice(3 + equals);
      continue;
    }
    if (i + 1 >= values.length) throw new Error(`Expected a value after ${values[i]}`);
    options[values[i].slice(2)] = values[++i];
  }
  return options;
}

function required(options, key) {
  if (!options[key]) throw new Error(`Missing --${key}`);
  return options[key];
}

// B10-H2 invariant: any command that prints a run directory also prints the
// workbench deep link. One helper, called everywhere a run dir is printed.
// Tries a 500ms HEAD against the dev server; when it's not running, the link
// still prints alongside the command to start it. OSC 8 makes it clickable in
// supporting terminals; falls back to a bare URL.
const SITE_URL = process.env.PD_SITE_URL || 'http://127.0.0.1:4190';
async function printWorkbenchLink(runId, stage) {
  const url = `${SITE_URL}/apps/designer/?case=run:${runId}&view=canvas${stage ? `#stage=${stage}` : ''}`;
  let alive = false;
  try {
    alive = await new Promise(resolveReady => {
      const parsed = new URL(SITE_URL);
      const request = (parsed.protocol === 'https:' ? httpsRequest : httpRequest)(parsed, {method:'HEAD',timeout:500}, response => { response.resume(); resolveReady(response.statusCode >= 200 && response.statusCode < 400); });
      request.on('timeout', () => {request.destroy();resolveReady(false);});
      request.on('error', () => resolveReady(false));
      request.end();
    });
  } catch { /* not running */ }
  const prefix = '  画布 → ';
  if (process.stdout.isTTY && process.env.TERM !== 'dumb') {
    process.stdout.write(`\x1b]8;;${url}\x07${prefix}${url}\x1b]8;;\x07\n`);
  } else {
    process.stdout.write(`${prefix}${url}\n`);
  }
  if (!alive) {
    process.stdout.write(`  未启动 → 在 HappyHands 工程目录运行 npm run workbench\n`);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === 'help') {
    process.stdout.write(`Product Designer Harness v0.1

pnpm harness init --spec FILE [--url URL] [--mode review|bootstrap] [--out DIRECTORY]
pnpm harness onboard --config FILE [--out DIRECTORY]
pnpm harness baseline --run DIRECTORY --reason TEXT
pnpm harness foundation-approve --run DIRECTORY --input FILE
pnpm harness capture --run DIRECTORY --phase before|after [--url URL] [--plan FILE] [--repo DIRECTORY] [--browser chrome|msedge]
pnpm harness skills
pnpm harness agents
pnpm harness skill --run DIRECTORY --skill ID [--repo DIRECTORY]
pnpm harness diagnose --run DIRECTORY [--rubric FILE]
pnpm harness prioritize --run DIRECTORY --finding ID --priority NUMBER --reason TEXT
pnpm harness verify --run DIRECTORY --config FILE [--repo DIRECTORY]
pnpm harness attest --run DIRECTORY --input FILE
pnpm harness confirm --run DIRECTORY --finding ID --verdict supported|stale --note TEXT
pnpm harness plan --run DIRECTORY [--finding ID]
pnpm harness execute --run DIRECTORY --repo DIRECTORY [--agent ID] [--command PATH]
pnpm harness evaluate --run DIRECTORY
pnpm harness judge --run DIRECTORY --decision accept|reject [--reason TEXT] (required for reject)
pnpm harness withdraw-judgment --run DIRECTORY --reason TEXT
pnpm harness memory-exception --run DIRECTORY --principle ID --hash CONTENT_HASH --decision exclude|apply --reason TEXT
pnpm harness status --run DIRECTORY
pnpm harness next --run DIRECTORY
pnpm harness export --run DIRECTORY [--out DIRECTORY]
pnpm harness reindex [--out DIRECTORY]

Every --option takes the next value (--run DIR); --option=value also works, for values that
themselves start with "--" such as a judgment reason.

export copies an allow-list of run files into a statically served folder; it never copies the Git worktree or the agent event log.
init, capture and plan do not edit the target repository. execute explicitly starts the selected agent in a new Git worktree; it does not push or deploy, and a run whose agent touched the host repository is failed.

A run is either a review run or a bootstrap run. onboard infers which by probing the entry routes: a route that
renders gives a baseline to review, a route that is missing has to be built first. A bootstrap run has no baseline,
so baseline records why it is absent, plan is constrained by the approved design foundation instead of a confirmed
finding, and evaluate reports deterministic render checks without claiming an improvement.
`);
    return;
  }
  const options = argsOf(rest);
  if (command === 'skills') {
    const skills = await loadRegistry();
    process.stdout.write(JSON.stringify(skills.map(({ directory, ...skill }) => skill), null, 2) + '\n');
    return;
  }
  if (command === 'agents') {
    process.stdout.write(JSON.stringify(listAgents(), null, 2) + '\n');
    return;
  }
  if (command === 'reindex') {
    const outputRoot = resolve(options.out || 'public/runs');
    const runs = await reindex(outputRoot);
    process.stdout.write(`Indexed ${runs.length} run(s) in ${outputRoot}
`);
    return;
  }
  if (command === 'init') {
    const spec = JSON.parse(await readFile(resolve(required(options, 'spec')), 'utf8'));
    const outputRoot = resolve(options.out || '.harness/runs');
    const mode = options.mode || (options.url ? 'review' : 'bootstrap');
    if (mode === 'review' && !options.url) throw new Error('Missing --url; a review run needs a baseline to capture.');
    await mkdir(outputRoot, { recursive: true });
    const run = await createRun({ spec, url: options.url || null, outputRoot, mode });
    process.stdout.write(`${run.directory}\n`);
    return;
  }
  if (command === 'onboard') {
    const startedAt = new Date().toISOString();
    const config = await loadProjectConfig(required(options, 'config'));
    const spec = JSON.parse(await readFile(config.spec, 'utf8'));
    const repository = await inspectRepository(config.repo);
    const outputRoot = resolve(options.out || '.harness/runs');
    await mkdir(outputRoot, { recursive: true });
    let preview = null;
    let child = null;
    try {
      if (config.start) child = spawnPreview(config.start);
      let previewError = null;
      if (config.url) {
        // In auto mode an unreachable preview is evidence about the surface, not a fatal error.
        try { preview = await waitForPreview(config.url, { timeoutMs: config.timeoutMs || 30000 }); } catch (error) { previewError = error; }
      }
      const entry = await resolveMode({ mode: config.mode, url: config.url, routes: config.routes });
      if (entry.mode === 'review' && previewError) throw previewError;
      if (entry.mode === 'bootstrap') {
        const run = await createRun({ spec, url: config.url, outputRoot, mode: 'bootstrap', entry });
        await recordAbsentBaseline(run.directory, entry.reason, entry.entries);
        let foundationInventory;
        try {
          foundationInventory = (await extractFoundationInventory({ directory: run.directory, repo: config.repo })).inventory;
        } catch (error) {
          foundationInventory = { status: 'failed', error: error.message };
          process.stderr.write(`Design Foundation extraction failed; the run remains usable and can be retried: ${error.message}\n`);
        }
        await saveOnboarding(run.directory, {
          status: 'ready', mode: 'bootstrap', startedAt, config: publicProjectConfig(config), repository,
          preview, previewError: previewError?.message || null, viewports: DEFAULT_VIEWPORTS,
          foundationInventory: { status: foundationInventory.status },
          completedAt: new Date().toISOString()
        });
        process.stdout.write(`${run.directory}\n`);
        process.stderr.write(`Bootstrap run: ${entry.reason}\nThere is no baseline to review. Plan the first render with: pnpm harness plan --run ${run.directory}\n`);
        return;
      }
      const run = await createRun({ spec, url: config.url, outputRoot, mode: 'review', entry });
      const base = {
        status: 'capturing', mode: 'review', startedAt, config: publicProjectConfig(config), repository, preview,
        viewports: DEFAULT_VIEWPORTS
      };
      await saveOnboarding(run.directory, base);
      try {
        await captureWithDesignSystem({directory:run.directory,repo:config.repo,phase:'before',bindVerificationSource:Boolean(config.verificationChecks?.length),verificationUrl:config.url,capture:async()=>config.capturePlanDocument
          ? await captureBrowserPlan({ plan: config.capturePlanDocument, directory: run.directory, phase: 'before', channel: config.browser, sourceRoot: config.repo })
          : await captureBrowser({ url: config.url, directory: run.directory, phase: 'before', channel: config.browser })});
        let foundationInventory;
        try {
          foundationInventory = (await extractFoundationInventory({ directory: run.directory, repo: config.repo })).inventory;
        } catch (error) {
          foundationInventory = { status: 'failed', error: error.message };
          process.stderr.write(`Design Foundation extraction failed; the baseline remains usable and can be retried: ${error.message}\n`);
        }
        await saveOnboarding(run.directory, { ...base, status: 'ready', foundationInventory: { status: foundationInventory.status }, completedAt: new Date().toISOString() });
        process.stdout.write(`${run.directory}\n`);
      } catch (error) {
        await saveOnboarding(run.directory, { ...base, status: 'failed', failedAt: new Date().toISOString(), error: error.message });
        throw new Error(`Baseline capture failed; the failed run is preserved at ${run.directory}: ${error.message}`);
      }
    } finally {
      stopPreview(child);
    }
    return;
  }
  const directory = resolve(required(options, 'run'));
  if (command === 'status') {
    const manifest = (await loadRun(directory)).manifest;
    await printWorkbenchLink(manifest.id, workflowState(manifest).stage);
    process.stdout.write(JSON.stringify({ ...manifest, workflow: workflowState(manifest) }, null, 2) + '\n');
  } else if (command === 'next') {
    const manifest = (await loadRun(directory)).manifest;
    await printWorkbenchLink(manifest.id, workflowState(manifest).stage);
    process.stdout.write(JSON.stringify(workflowState(manifest), null, 2) + '\n');
  } else if (command === 'skill') {
    const result = await executeSkill({ id: required(options, 'skill'), directory, repo: options.repo ? resolve(options.repo) : undefined });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (command === 'baseline') {
    const manifest = await recordAbsentBaseline(directory, required(options, 'reason'));
    process.stdout.write(JSON.stringify(manifest.baseline, null, 2) + '\n');
  } else if (command === 'foundation-approve') {
    const input = JSON.parse(await readFile(resolve(required(options, 'input')), 'utf8'));
    const manifest = await saveFoundationApproval(directory, input);
    process.stdout.write(JSON.stringify(manifest.foundationApproval, null, 2) + '\n');
  } else if (command === 'diagnose') {
    const run = await loadRun(directory);
    if (run.manifest.mode === 'bootstrap') throw new Error('A bootstrap run has nothing rendered to diagnose. Plan the first render, then diagnose it in the next run.');
    if (!run.manifest.captures.before) throw new Error('Capture a baseline before diagnosing.');
    const skillResults = await Promise.all(run.manifest.skills.map(async item => JSON.parse(await readFile(runFilePath(directory, item.path), 'utf8'))));
    const rubric = options.rubric ? JSON.parse(await readFile(resolve(options.rubric), 'utf8')) : null;
    const diagnosis = diagnoseRun({ run, skillResults, rubric });
    await saveDiagnosis(directory, diagnosis);
    process.stdout.write(JSON.stringify(diagnosis, null, 2) + '\n');
  } else if (command === 'prioritize') {
    const run = await loadRun(directory);
    if (!run.manifest.diagnosis) throw new Error('Run diagnose before overriding priority.');
    const diagnosisPath = runFilePath(directory, run.manifest.diagnosis.path);
    const diagnosis = JSON.parse(await readFile(diagnosisPath, 'utf8'));
    overridePriority(diagnosis, required(options, 'finding'), Number(required(options, 'priority')), required(options, 'reason'));
    await saveDiagnosis(directory, diagnosis);
    process.stdout.write(JSON.stringify(diagnosis.findings, null, 2) + '\n');
  } else if (command === 'verify') {
    const config=await loadProjectConfig(required(options,'config'));
    const result=await runVerificationChecks({directory,repo:options.repo?resolve(options.repo):config.repo,url:config.url,checks:config.verificationChecks,signal:new AbortController().signal});
    process.stdout.write(JSON.stringify(result,null,2)+'\n');
  } else if (command === 'attest') {
    const review = JSON.parse(await readFile(resolve(required(options, 'input')), 'utf8'));
    await saveVisualReview(directory, review);
    process.stdout.write(`Saved ${review.skillId} ${review.verdict} attestation in ${directory}\n`);
  } else if (command === 'capture') {
    const phase = required(options, 'phase');
    const run = await loadRun(directory);
    const bootstrap = run.manifest.mode === 'bootstrap';
    if (!['before', 'after'].includes(phase)) throw new Error('Phase must be before or after.');
    if (run.manifest.captures[phase]) throw new Error(`${phase} is already captured; start a new run for another comparison.`);
    if (bootstrap && phase === 'before') throw new Error('A bootstrap run has no baseline; capture the first render as after.');
    if (bootstrap && phase === 'after' && !run.manifest.plan) throw new Error('Plan the first render before capturing it.');
    if (!bootstrap && phase === 'after' && !run.manifest.captures.before) throw new Error('Capture the baseline first.');
    if (!bootstrap && phase === 'after' && run.manifest.confirmation?.verdict !== 'supported') throw new Error('Confirm a supported finding before capturing after.');
    if (!options.plan && !options.url && !run.manifest.url) throw new Error('Missing --url or --plan; this run has no recorded start point.');
    const repo=options.repo ? resolve(options.repo) : phase==='after' ? run.manifest.execution?.worktree : run.manifest.onboarding?.repository?.root;
    const plan=options.plan?JSON.parse(await readFile(resolve(options.plan),'utf8')):null;
    const bound=Boolean(run.manifest.onboarding?.config?.verificationChecks?.length);
    const verificationUrl=plan?.states?.[0]?.start?.url||options.url||run.manifest.url;
    if(bound&&plan){const origin=new URL(verificationUrl).origin;if(plan.states.some(state=>new URL(state.start.url).origin!==origin||state.actions.some(action=>action.type==='navigate'&&new URL(action.url).origin!==origin)))throw Error('Specialist capture requires one preview origin.');}
    const takeCapture=async()=>plan
      ? await captureBrowserPlan({ plan, directory, phase, channel: options.browser || 'chrome', sourceRoot: repo || null })
      : await captureBrowser({ url: options.url || run.manifest.url, directory, phase, channel: options.browser || 'chrome' });
    if(repo)await captureWithDesignSystem({directory,repo,phase,bindVerificationSource:bound,verificationUrl,capture:takeCapture});
    else await saveCapture(directory,phase,await takeCapture());
    process.stdout.write(`Saved ${phase} ${options.plan ? 'task-state' : 'desktop/mobile'} captures in ${directory}\n`);
  } else if (command === 'confirm') {
    await confirmFinding(directory, required(options, 'finding'), required(options, 'verdict'), required(options, 'note'));
    await printWorkbenchLink((await loadRun(directory)).manifest.id);
    process.stdout.write(`Recorded finding confirmation in ${directory}\n`);
  } else if (command === 'plan') {
    const run = await loadRun(directory);
    const bootstrap = run.manifest.mode === 'bootstrap';
    await savePlan(directory, bootstrap ? null : required(options, 'finding'));
    await printWorkbenchLink((await loadRun(directory)).manifest.id);
    process.stdout.write(`Saved ${bootstrap ? 'first-render' : 'scoped'} brief in ${directory}\n`);
  } else if (command === 'execute') {
    const execution = await executeWithAgent({
      directory,
      repo: required(options, 'repo'),
      agent: options.agent || DEFAULT_AGENT,
      commandOverride: options.command
    });
    await printWorkbenchLink(execution.branch.replace(/^pd\//, ""));
    process.stdout.write(JSON.stringify(execution, null, 2) + '\n');
  } else if (command === 'evaluate') {
    const run = await loadRun(directory);
    const bootstrap = run.manifest.mode === 'bootstrap';
    if (bootstrap && !run.manifest.captures.after) throw new Error('Capture the first render first.');
    if (!bootstrap && (!run.manifest.captures.before || !run.manifest.captures.after)) throw new Error('Capture before and after first.');
    const evaluation = bootstrap
      ? evaluateFirstRender(run.manifest.captures.after)
      : evaluateCaptures(run.manifest.captures.before, run.manifest.captures.after);
    await saveEvaluation(directory, evaluation);
    await printWorkbenchLink((await loadRun(directory)).manifest.id);
    process.stdout.write(JSON.stringify(evaluation, null, 2) + '\n');
  } else if (command === 'export') {
    const result = await exportRun({ directory, outputRoot: resolve(options.out || 'public/runs') });
    process.stdout.write(`Published run ${result.summary.id} to ${result.directory} (${result.files.length} files)
`);
  } else if (command === 'memory-exception') {
    await saveRunMemoryException(required(options,'run'),{id:required(options,'principle'),principleHash:required(options,'hash'),decision:required(options,'decision'),reason:required(options,'reason')});
    console.log('Run exception recorded. Generate a new plan before execution.');
  } else if (command === 'withdraw-judgment') {
    await withdrawJudgment(required(options,'run'),required(options,'reason'));
    console.log('Judgment withdrawn. Original decision and evidence retained; start a new run to reassess.');
  } else if (command === 'judge') {
    await saveJudgment(directory, required(options, 'decision'), options.reason ?? '');
    await printWorkbenchLink((await loadRun(directory)).manifest.id);
    process.stdout.write(`Saved judgment in ${directory}\n`);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
}

main().catch(error => {
  process.stderr.write(`Harness error: ${error.message}\n`);
  process.exitCode = 1;
});
