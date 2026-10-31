import {writeFile,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {loadRun,savePullRequest} from '../harness-core/store.js';
import {visualReviewFor} from '../harness-core/workflow.js';
import {readVisualReviewBinding} from '../harness-core/visual-review-binding.js';
import {readVerificationEvidence} from '../harness-core/verification.js';
import {readRepositoryInputs} from '../harness-core/repository-inputs.js';
import {repositoryFingerprint} from '../harness-core/repository-fingerprint.js';
import {runLocal} from './jobs.js';

export async function verifyPublication(run){
  if(run.manifest.judgment?.decision!=='accept')throw Error('Accept the final result before creating a pull request.');
  const qa=visualReviewFor(run.manifest,'visual-qa-evaluator');
  if(qa?.verdict!=='pass')throw Error('A passing independent review is required before publication.');
  await readVisualReviewBinding(run,qa,{requireBound:true});
  await readVerificationEvidence(run.directory,run.manifest);
  const execution=run.manifest.execution;
  if(!execution||execution.exitCode!==0||execution.boundaryBreaches?.length)throw Error('A successful isolated execution is required.');
  const worktree=await realpath(join(run.directory,'worktree'));
  if(await realpath(execution.worktree)!==worktree)throw Error('Publication must use this review’s isolated worktree.');
  const captured=await readRepositoryInputs(run,'after');
  const actual=await repositoryFingerprint(worktree);
  if(!captured||captured.fingerprint.contentHash!==actual.contentHash||captured.fingerprint.fileCount!==actual.fileCount)throw Error('The worktree changed after review. Capture and review it again before publication.');
  return worktree;
}

// Only an explicit final publication click reaches this function. No force push,
// merge, deployment, host-repository staging or private evidence upload.
export async function createReviewedPullRequest(directory,{cwd,signal,command=runLocal,verify=verifyPublication}={}){
  const run=await loadRun(directory);
  if(run.manifest.judgment?.decision!=='accept')throw Error('Accept the final result before creating a pull request.');
  const worktree=await verify(run),execution=run.manifest.execution;
  const branch=`pd/${run.manifest.id}`;
  if(execution.branch!==branch||!/^[a-zA-Z0-9_-]{4,64}$/.test(run.manifest.id))throw Error('Unexpected repair branch.');
  const invoke=(name,args)=>command(name,args,{cwd:worktree,signal,stdoutOnly:true});
  const git=args=>invoke('git',args);
  if((await git(['branch','--show-current'])).trim()!==branch)throw Error('The reviewed worktree branch changed.');
  const remote=(await git(['remote','get-url','origin'])).trim();
  const match=/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remote);
  if(!match)throw Error('Connect a GitHub origin remote before creating a pull request.');
  const repo=match[1];
  if(repo.split('/').some(part=>/^\.+$/.test(part)))throw Error('Invalid GitHub repository.');
  if(!/^[a-f0-9]{40,64}$/.test(execution.baseCommit||''))throw Error('Invalid reviewed baseline commit.');
  // Older Windows executions included Git's CRLF diagnostics in changedFiles.
  // Keep the original execution ledger; accept a diagnostic only when it names
  // an independently listed reviewed file, then compare the actual Git scope.
  const rawFiles=execution.changedFiles||[],crlf=/^warning: in the working copy of '(.+)', LF will be replaced by CRLF the next time Git touches it$/;
  const files=rawFiles.filter(path=>!crlf.test(path));
  if(rawFiles.some(path=>crlf.test(path)&&!files.includes(crlf.exec(path)[1])))throw Error('Unbound Git diagnostic in reviewed scope.');
  if(!files.length||files.length>1000||files.join('\n').length>12000||files.some(path=>typeof path!=='string'||/^[\\/]|^[A-Za-z]:|[\r\n\0]/.test(path)||path.split(/[\\/]/).some(part=>part==='..'||part==='.git')))throw Error('Invalid or empty reviewed file scope.');
  const tracked=(await git(['diff','--name-only',execution.baseCommit])).trim().split(/\r?\n/).filter(Boolean);
  const untracked=(await git(['ls-files','--others','--exclude-standard'])).trim().split(/\r?\n/).filter(Boolean);
  const current=[...new Set([...tracked,...untracked])];
  if(JSON.stringify([...current].sort())!==JSON.stringify([...files].sort()))throw Error('The changed files no longer match the reviewed scope.');
  const existing=JSON.parse(await invoke('gh',['pr','list','--repo',repo,'--head',branch,'--state','open','--limit','1','--json','url,isDraft,headRefOid']));
  const base=(await invoke('gh',['api',`repos/${repo}`,'--jq','.default_branch'])).trim();
  if(!/^[\w./-]+$/.test(base)||base.startsWith('-'))throw Error('Invalid default branch.');
  await git(['fetch','--no-tags','origin',base]);
  await git(['merge-base','--is-ancestor',execution.baseCommit,'FETCH_HEAD']);
  await git(['add','--',...files]);
  if((await git(['diff','--name-only'])).trim())throw Error('The index does not match the reviewed files.');
  // Verify content again after staging/commit. A retry may have a new commit but
  // must still contain exactly the after-capture input bytes.
  await verify(await loadRun(directory));
  // Publish one reviewed tree, never the agent's intermediate local history.
  const tree=(await git(['write-tree'])).trim();
  if(!/^[a-f0-9]{40,64}$/.test(tree))throw Error('Invalid reviewed tree.');
  const remoteRef=(await git(['ls-remote','--heads','origin',branch])).trim();
  let head=existing[0]?.headRefOid||remoteRef.split(/\s/)[0];
  if(head){
    if(!/^[a-f0-9]{40,64}$/.test(head))throw Error('Invalid publication head.');
    const commit=JSON.parse(await invoke('gh',['api',`repos/${repo}/git/commits/${head}`]));
    if(commit.tree?.sha!==tree||commit.parents?.length!==1||commit.parents[0].sha!==execution.baseCommit)throw Error('The publication branch differs from the reviewed result.');
  }else{
    head=(await git(['commit-tree',tree,'-p',execution.baseCommit,'-m',`fix: apply reviewed HappyHands repairs (${run.manifest.id})`])).trim();
    if(!/^[a-f0-9]{40,64}$/.test(head))throw Error('Invalid publication commit.');
    await git(['push','origin',`${head}:refs/heads/${branch}`]);
  }
  const body=join(cwd,'pull-request-body.md');
  await writeFile(body,`Repairs for ${run.spec.project.name}.\n\nIndependent visual review passed for the recorded capture scope; the user accepted the final result.\n\n- Review: ${run.manifest.id}\n- Baseline: ${execution.baseCommit}\n- Changed files: ${files.length}\n\nThis does not claim coverage of uncaptured pages or a production deployment.\n`);
  const output=existing[0]?.url||await invoke('gh',['pr','create','--draft','--repo',repo,'--base',base,'--head',branch,'--title',`HappyHands: repair ${run.spec.project.name}`,'--body-file',body]);
  const url=String(output).match(/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/)?.[0];
  if(!url||!url.startsWith(`https://github.com/${repo}/pull/`))throw Error('GitHub did not return a matching pull request URL.');
  const result={url,repository:repo,branch,head,at:new Date().toISOString(),draft:existing[0]?Boolean(existing[0].isDraft):true};
  await savePullRequest(directory,result);return result;
}
