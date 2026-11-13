import test from 'node:test';
import assert from 'node:assert/strict';
import {remediationDefinition,assertExecutionResult,assertMethodChecks,methodStateEntries} from '../packages/harness-core/remediation.js';
const profile={profile:'project',adoptionReason:'Owner requires product-adapted iconography'};
const manifest={captures:{after:{states:[{stateId:'default',configurationId:'desktop',screenshot:'after/desktop.png'},{stateId:'default',configurationId:'mobile',screenshot:'after/mobile.png'}]}}};
test('product icon adaptation is bound for both strict profiles, without a library blacklist',async()=>{
 for(const kind of ['project','happyhands']){
  const contract=await remediationDefinition({...profile,profile:kind});
  const rule=contract.rules.find(r=>r.id==='UX-product-icons');
  assert.ok(rule);assert.match(rule.remediation,/target product/);assert.match(rule.remediation,/semantic mapping/);
  assert.match(rule.verification,/needs-evidence/);assert.match(contract.skill,/not a maintained blacklist/);
 }
});
test('execution cannot silently omit or block the product icon decision',async()=>{
 const contract={...await remediationDefinition(profile),issueIds:['F1']};
 const row={status:'preserved',observed:'Fixture product family source was inspected',decision:'Fixture icon fit assessment, not a real review',files:[],verification:'Synthetic protocol test only'};
 const report={contractHash:'test',checks:contract.rules.map(r=>({...row,ruleId:r.id})),issues:[{...row,id:'F1'}]};
 assert.doesNotThrow(()=>assertExecutionResult(report,contract,'test'));
 const missing=structuredClone(report);missing.checks=missing.checks.filter(r=>r.ruleId!=='UX-product-icons');
 assert.throws(()=>assertExecutionResult(missing,contract,'test'),/Missing/);
 report.checks.find(r=>r.ruleId==='UX-product-icons').status='blocked';
 assert.throws(()=>assertExecutionResult(report,contract,'test'),/blocked/);
});
test('independent icon QA must cover every viewport and cannot pass unresolved evidence',()=>{
 const rules=['UX-product-icons'];
 const rows=methodStateEntries(manifest).map(s=>({ruleId:rules[0],stateKey:s.key,status:'pass',reason:'Synthetic product-adaptation review protocol only',screenshotRefs:[s.screenshot]}));
 assert.doesNotThrow(()=>assertMethodChecks(rows,rules,manifest,'pass'));
 assert.throws(()=>assertMethodChecks(rows.slice(0,1),rules,manifest,'pass'),/Missing/);
 rows[1].screenshotRefs=['after/desktop.png'];assert.throws(()=>assertMethodChecks(rows,rules,manifest,'pass'),/assigned original/);
 rows[1].screenshotRefs=['after/mobile.png'];
 for(const status of ['fail','needs-evidence']){rows[1].status=status;assert.throws(()=>assertMethodChecks(rows,rules,manifest,'pass'),/prevents passing QA/);assert.doesNotThrow(()=>assertMethodChecks(rows,rules,manifest,'needs-evidence'));}
 rows[1].status='not-applicable';rows[1].reason='';assert.throws(()=>assertMethodChecks(rows,rules,manifest,'pass'),/reason/);
});
