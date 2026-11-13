import test from 'node:test';
import assert from 'node:assert/strict';
import {designIntents,designIntentOptions} from '../packages/skill-core/design-intents.js';
import {designGuidanceProfile,loadDesignGuidance} from '../packages/skill-core/design-guidance.js';
import {editedDesignProfile} from '../apps/designer/cowart/design-profile.js';
import {translate} from '../apps/designer/i18n.js';

test('all supported specialist choices have localized labels and validate',()=>{
  assert.deepEqual(designIntents,['polish','layout','animate','harden','distill','typeset','clarify','adapt','onboard','optimize','extract']);
  for(const [intent,label]of designIntentOptions){
    assert.equal(designGuidanceProfile({intent}).intent,intent);
    assert.notEqual(translate(label,[],'en'),label);
    assert.equal(translate(label,[],'zh'),label);
  }
  assert.throws(()=>designGuidanceProfile({intent:''}),/Unknown/);
  assert.throws(()=>designGuidanceProfile({intent:'unrecognized'}),/Unknown/);
});

test('project edits roundtrip specialists, legacy profiles and adopted remediation',()=>{
  for(const taste of ['existing','app-screen','public-page','legacy-v2','dials-v1'])for(const intent of designIntents){
    const initial=designGuidanceProfile({taste,intent,remediation:{profile:'happyhands',adoptionReason:'Owned workbench'},...(taste==='dials-v1'?{dials:{MOTION_INTENSITY:2}}:{})});
    const copy=JSON.stringify(initial);
    assert.deepEqual(designGuidanceProfile(editedDesignProfile(initial,taste,intent,initial.dials)),initial);
    const switched=designGuidanceProfile(editedDesignProfile(initial,'app-screen','typeset',{}));
    assert.equal(switched.intent,'typeset');assert.equal(switched.dials,undefined);assert.deepEqual(switched.remediation,initial.remediation);
    assert.equal(JSON.stringify(initial),copy);
  }
  assert.deepEqual(designGuidanceProfile(editedDesignProfile(undefined,'existing','polish',{})),{taste:'existing',intent:'polish'});
});

test('saved Typeset hands off only Typeset then Polish; review remains read-only',async()=>{
  const profile=editedDesignProfile({taste:'app-screen',intent:'typeset'},'app-screen','typeset',{});
  for(const mode of ['implementation','review']){
    const bundle=await loadDesignGuidance(mode,profile);
    const pack=bundle.packs.find(p=>p.metadata.id==='impeccable');
    assert.deepEqual(pack.metadata.readFirst.filter(p=>p.includes('/reference/')).map(p=>p.split('/').at(-1)),mode==='implementation'?['typeset.md','polish.md']:['audit.md','critique.md']);
    for(const path of pack.metadata.readFirst.filter(p=>p.startsWith('upstream/')))assert.ok(pack.documents.some(d=>d.path===path));
  }
});
