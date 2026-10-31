import { t, getLanguage, translate } from './i18n.js';

export function scoreMessage(message) {
  const missing = /^Missing dimension: ([\w-]+)\.$/.exec(message);
  if (missing) return translate('Missing dimension: {0}.', [t(missing[1])]);
  const required = /^([\w-]+)( needs (?:a score from 0 to 100|a weight greater than zero|a rationale|at least one valid evidence reference)\.)$/.exec(message);
  if (required) return translate(`{0}${required[2]}`, [t(required[1])]);
  return t(message);
}

const stages = {
  'needs-baseline': '采集起始界面', 'needs-diagnosis': '诊断已有证据',
  'awaiting-confirmation': '诊断完成，可以开始修复', 'needs-plan': '准备自动修复',
  'needs-execution': '准备自动修复', 'needs-after-capture': '采集修改后的界面',
  'needs-structural-evaluation': '检查结构与可达性', 'needs-visual-qa': '独立视觉复核',
  'awaiting-judgment': '等待你的最终判断', complete: '本次审阅已记录',
  'judgment-withdrawn':'本轮决定已撤回',
  'visual-qa-failed': '视觉复核未通过', 'visual-qa-needs-evidence': '视觉证据待补充',
  'finding-stale': '问题证据已过期', 'execution-failed': '执行未完成',
  'boundary-breached': '执行超出允许范围', 'onboarding-failed': '项目接入未完成',
  'needs-absent-baseline': '记录基线缺失原因', 'needs-foundation-approval': '批准设计基础',
  'needs-first-render-plan': '规划首个页面'
};
export function stageLabel(stage) { return t(stages[stage] || stage); }
export function workflowReason(state, manifest) {
  if (!state.reason) return '';
  if (getLanguage() === 'en') return state.reason;
  if (state.stage === 'boundary-breached') return `执行修改了隔离工作区以外的仓库内容：${manifest.execution?.boundaryBreaches?.join('；') || '—'}。`;
  if (state.stage === 'execution-failed') {
    const execution = manifest.execution || {};
    if (execution.timedOut) return `执行超时（${execution.limits?.maxMinutes ?? '设定时限'} 分钟），工作区保留了部分修改。请检查工作区和日志。`;
    return `执行未完成（${execution.exitCode ?? execution.signal ?? '已停止'}）。请检查保留的工作区和日志。`;
  }
  // Onboarding errors are diagnostic evidence; retain the source verbatim.
  if (state.stage === 'onboarding-failed' && manifest.onboarding?.error) return `项目接入失败。原始错误：${manifest.onboarding.error}`;
  return t(state.reason);
}
