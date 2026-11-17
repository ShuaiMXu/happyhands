import test from 'node:test';
import assert from 'node:assert/strict';
import {parseColor, contrastRatio, requiredContrast, deterministicChecks} from '../packages/harness-core/deterministic-checks.js';

const element = (over = {}) => ({tag: 'p', id: null, role: null, className: '', styles: {color: 'rgb(27, 27, 27)', backgroundColor: 'rgb(247, 244, 238)', fontSize: '16px', fontWeight: '400'}, size: {width: 200, height: 40}, state: {}, ...over});
const entry = (over = {}) => ({stateId: 'page', configurationId: 'phone', width: 390, documentSize: {width: 390, height: 844}, screenshot: 'before/page--phone.png', dom: {horizontalOverflow: false, designSystem: {elements: []}} , ...over});

test('colours parse and contrast follows WCAG 2 relative luminance', () => {
  assert.deepEqual(parseColor('rgb(27, 27, 27)'), {r: 27, g: 27, b: 27, alpha: 1});
  assert.deepEqual(parseColor('rgba(0, 0, 0, 0)'), {r: 0, g: 0, b: 0, alpha: 0});
  assert.deepEqual(parseColor('#fff'), {r: 255, g: 255, b: 255, alpha: 1});
  assert.equal(parseColor('transparent'), null);
  const white = parseColor('#fff'), black = parseColor('#000');
  assert.ok(Math.abs(contrastRatio(white, black) - 21) < 0.01);
  assert.equal(requiredContrast(16, 400), 4.5);
  assert.equal(requiredContrast(24, 400), 3);
  assert.equal(requiredContrast(19, 700), 3);
});

test('a document wider than its viewport is reported with the measured numbers', () => {
  const {findings, evidence} = deterministicChecks({phase: 'before', entries: [entry({documentSize: {width: 900, height: 844}})]});
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /Horizontal overflow/);
  assert.deepEqual(findings[0].evidenceRefs, ['capture:before:page--phone', 'check-overflow-1:measurement']);
  assert.equal(evidence[0].value.documentWidth, 900);
  assert.equal(findings[0].verificationStatus, 'review-target');
});

test('a capture that fits its viewport produces no overflow finding', () => {
  const {findings} = deterministicChecks({phase: 'before', entries: [entry({documentSize: {width: 390, height: 844}})]});
  assert.deepEqual(findings, []);
});

test('text below the contrast threshold is reported, including why it was judged', () => {
  const button = element({tag: 'a', className: 'btn', styles: {color: 'rgb(255, 255, 255)', backgroundColor: 'rgb(255, 209, 102)', fontSize: '16px', fontWeight: '600'}, size: {width: 104, height: 44}});
  const {findings} = deterministicChecks({phase: 'before', entries: [entry({dom: {horizontalOverflow: false, designSystem: {elements: [button]}}})]});
  const contrast = findings.find(item => item.title.startsWith('Text contrast'));
  assert.ok(contrast, 'white on the pale accent must be reported');
  assert.match(contrast.proposal, /needs 4.5:1 at 16px/);
  assert.equal(findings.some(item => item.title.startsWith('Tap target')), false, '104x44 is large enough');
});

test('readable text and transparent backgrounds are not reported', () => {
  const readable = element();
  const transparent = element({tag: 'a', styles: {color: 'rgb(85, 85, 85)', backgroundColor: 'rgba(0, 0, 0, 0)', fontSize: '14px', fontWeight: '400'}});
  const {findings} = deterministicChecks({phase: 'before', entries: [entry({dom: {horizontalOverflow: false, designSystem: {elements: [readable, transparent]}}})]});
  assert.deepEqual(findings, []);
});

test('interactive targets smaller than 24x24 are reported', () => {
  const link = element({tag: 'a', className: '', styles: {color: 'rgb(85, 85, 85)', backgroundColor: 'rgba(0, 0, 0, 0)', fontSize: '14px', fontWeight: '400'}, size: {width: 28, height: 18}});
  const {findings} = deterministicChecks({phase: 'before', entries: [entry({dom: {horizontalOverflow: false, designSystem: {elements: [link]}}})]});
  assert.equal(findings.length, 1);
  assert.match(findings[0].title, /Tap target 28x18/);
  assert.match(findings[0].proposal, /24x24 minimum/);
});

test('an unreached state and a capture without a DOM contribute nothing', () => {
  assert.deepEqual(deterministicChecks({phase: 'before', entries: [entry({reached: false})]}), {evidence: [], findings: []});
  assert.deepEqual(deterministicChecks({phase: 'before', entries: []}), {evidence: [], findings: []});
});
