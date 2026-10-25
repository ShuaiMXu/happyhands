import test from 'node:test';
import assert from 'node:assert/strict';
import {contrastEvidenceKind} from '../examples/happyclaw-site/triage-runtime-contrast.mjs';

test('occlusion remains a visibility problem even when a gradient is also present',()=>{
 assert.equal(contrastEvidenceKind('Background gradient; partially obscured by another element'),'visibility-review');
 assert.equal(contrastEvidenceKind('Element partially overlaps another element'),'visibility-review');
 assert.equal(contrastEvidenceKind('Background could not be determined due to a background gradient'),'gradient-review');
 assert.equal(contrastEvidenceKind('Unknown background condition'),'unresolved-evidence');
 assert.equal(contrastEvidenceKind('Clipboard status needs inspection'),'unresolved-evidence');
 assert.equal(contrastEvidenceKind('Text is clipped by its container'),'visibility-review');
});
