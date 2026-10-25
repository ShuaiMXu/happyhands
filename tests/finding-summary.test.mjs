import test from 'node:test';import assert from 'node:assert/strict';
import {findingSummary} from '../apps/designer/finding-summary.js';import {setLanguage} from '../apps/designer/i18n.js';
test('recorded rule checks have readable editable suggestions without changing the source diagnosis',()=>{
 const finding={id:'IA-MAIN-MOBILE',title:'Raw main landmark check',verificationStatus:'review-target',sources:[{type:'skill'}],evidenceRefs:['E']};const original=structuredClone(finding);setLanguage('zh');const summary=findingSummary(finding);assert.match(summary.title,/移动端/);assert.ok(summary.proposal);assert.deepEqual(finding,original);assert.equal(finding.verificationStatus,'review-target');
});
test('authored titles and proposals remain authoritative even when IDs resemble automated rules',()=>{
 for(const finding of [{id:'IA-MAIN-MOBILE',title:'My wording',proposal:'My actual change',sources:[{type:'skill'}]},{id:'IA-MAIN-MOBILE',title:'My authored observation',sources:[{type:'experience-spec'}]}]){const summary=findingSummary(finding);assert.equal(summary.title,finding.title);assert.equal(summary.proposal,finding.proposal||'');}
});
test('unknown checks keep their original wording and do not receive invented fix advice',()=>{assert.deepEqual(findingSummary({id:'UNKNOWN',title:'Original',sources:[{type:'skill'}]}),{title:'Original',proposal:''});});
test('the same diagnosis can be presented in English while raw evidence stays unchanged',()=>{setLanguage('en');const finding={id:'A11Y-AXE-COLOR-CONTRAST-DESKTOP',title:'Original contrast evidence',sources:[{type:'skill'}]};assert.equal(findingSummary(finding).title,'Check text contrast · desktop');assert.equal(finding.title,'Original contrast evidence');setLanguage('zh');});
