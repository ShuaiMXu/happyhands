import test from 'node:test';
import assert from 'node:assert/strict';
import {selectSkills, skillCapability, auditReadingMethods} from '../packages/skill-core/method-policy.js';
import {loadRegistry} from '../packages/skill-core/registry.js';
import {loadDesignGuidance} from '../packages/skill-core/design-guidance.js';
import {validateSkillEvolution} from '../packages/skill-core/evolution.js';

test('default task routes exclude placeholder providers without removing explicit compatibility', async () => {
  const registry = await loadRegistry();
  assert.equal(registry.filter(skill => !skillCapability(skill).defaultEligible).length, 9);
  for (const stage of ['diagnose','foundation','plan','review','learn']) {
    const selection = await selectSkills(stage);
    assert.ok(selection.selected.length);
    assert.ok(selection.selected.every(row => row.defaultEligible && row.provider === 'bounded-handler'));
  }
  const explicit = await selectSkills('diagnose', {requested:['error-recovery-reviewer','error-recovery-reviewer']});
  assert.equal(explicit.selected.length, 1);
  assert.equal(explicit.selected[0].provider, 'contract-only');
  assert.equal(explicit.selected[0].invocation, 'explicit');
  assert.equal(skillCapability({maturity:'bounded',handler:'evidenceGate',role:'review'}).defaultEligible, false);
  await assert.rejects(selectSkills('diagnose', {requested:['not-installed']}), /Unknown skill/);
  assert.ok(!auditReadingMethods().some(path => /error-recovery|fix-planner|judgment-distiller|regression-case/.test(path)));
});

test('specialist implementation routes use the selected pinned playbook before polish', async () => {
  for (const intent of ['harden','distill','typeset','clarify','adapt','onboard','optimize','extract']) {
    const bundle = await loadDesignGuidance('implementation', {taste:'app-screen',intent});
    const pack = bundle.packs.find(pack => pack.metadata.id === 'impeccable');
    const paths = pack.metadata.readFirst;
    assert.ok(paths.at(-2).endsWith('/' + intent + '.md'));
    assert.ok(paths.at(-1).endsWith('/polish.md'));
    assert.ok(paths.filter(path => path.startsWith('upstream/')).every(path => pack.documents.some(doc => doc.path === path)));
  }
});

const oldHash='a'.repeat(64), newHash='b'.repeat(64), evidenceHash='c'.repeat(64);
const baseline={version:'1.0.0',skills:[{id:'example',contractHash:oldHash}],regression:{implementationHash:oldHash}};
const args={baseline,skills:[{id:'example',contractHash:newHash}],implementationHash:oldHash,report:{evidenceHash,cases:[{id:'broken',passed:true},{id:'preserve',passed:true},{id:'affected',passed:true}]}};
const record=()=>({baselineVersion:'1.0.0',evidenceHash,changes:[{id:'example',beforeHash:oldHash,afterHash:newHash,reason:'Bound the label heuristic',observedFailure:'A correct Continue action was admitted without task evidence.',preserveBehavior:'Retain a correct task-specific Continue action.',failureCases:['broken'],preserveCases:['preserve'],affectedCases:['affected']}]});
test('evolution requires bound old/new hashes and executed failure, preserve and affected cases', () => {
  assert.throws(()=>validateSkillEvolution(args), /evolution record/);
  const change=record();
  assert.equal(validateSkillEvolution({...args,change}).status,'reviewed-contract-candidate');
  assert.equal(validateSkillEvolution({...args,change}).qualityClaim,'not-established');
  for (const mutate of [c=>c.changes[0].beforeHash=newHash,c=>c.changes.push(c.changes[0]),c=>c.changes[0].preserveCases=['broken'],c=>c.changes[0].failureCases=['unexecuted'],c=>c.evidenceHash=oldHash,c=>c.changes[0].observedFailure='']) {
    const invalid=record();mutate(invalid);assert.throws(()=>validateSkillEvolution({...args,change:invalid}));
  }
  assert.throws(()=>validateSkillEvolution({...args,implementationHash:newHash,change:record()}),/evolution record/);
  assert.equal(validateSkillEvolution({...args,baseline:null}).status,'baseline-only');
});
