import { workflowState } from './workflow.js';

const actions = {
  'needs-baseline': ['restart', '采集起始界面', '连接当前源码并开启新的基线采集。'],
  'needs-diagnosis': ['diagnose', '诊断已有证据', '从已采集的页面整理有来源的问题。'],
  'awaiting-confirmation': ['confirm', '选择问题并确认范围', '核对问题与建议，确认后生成完整修改计划；此时不会修改代码。'],
  'needs-plan': ['plan', '生成本轮修改计划', '只为已确认的问题生成修改任务。'],
  'needs-execution': ['execute', '审阅计划并开始修改', '核对任务后在隔离工作区执行；随后自动采集、检查和独立复核。'],
  'needs-after-capture': ['recapture', '采集并检查修改结果', '重放隔离工作区，再完成结构检查与独立复核。'],
  'needs-structural-evaluation': ['evaluate', '检查已采集结果', '使用匹配证据检查结构与可达性；检查完成后仍需独立复核。'],
  'verification-invalid': ['reconnect', '重新采集并验证', '原始证据缺失或已改变，需要重新采集；旧通过结论不能用于接受。'],
  'needs-specialist-verification': ['ai-review', '补跑专项验证并复核', '在相同源码上重启受管理预览，重跑缺证的专项验证，保留旧记录后再独立复核。'],
  'needs-visual-qa': ['ai-review', '发起独立视觉复核', '由新的只读会话检查前后证据，完成后再由你判断。'],
  'awaiting-judgment': ['judge', '查看复核并记录决定', '明确选择接受或拒绝，并保存理由。'],
  complete: ['restart', '开始下一轮审阅', '先将认可的改动应用到项目，再采集当前源码的新基线。'],
  'judgment-withdrawn': ['restart', '重新审阅当前项目', '原决定已撤回。保留本轮历史，从当前源码重新采集并判断。'],
  'onboarding-failed': ['reconnect', '修复连接后重新审阅', '保留失败记录，检查预览和配置后重新连接。'],
  'finding-stale': ['restart', '重新审阅当前源码', '当前问题已过期，需要新的证据。'],
  'execution-failed': ['restart', '检查改动后重新审阅', '先检查保留的工作区和日志，再启动新一轮；不会重复执行失败任务。'],
  'boundary-breached': ['restart', '检查源码后重新审阅', '先检查被修改的项目源码，修复后再采集新基线。'],
  'visual-qa-needs-evidence': ['reconnect', '补齐证据后重新审阅', '先补齐采集计划中缺失的状态，再开始新一轮。'],
  'visual-qa-failed': ['judge', '处理复核问题', '核对未解决的问题：记录拒绝，或提交新的反证申请独立复核。通过后再由你决定是否接受。'],
  'needs-absent-baseline': ['baseline', '说明起始界面为何缺失', '记录真实原因后，再审阅并批准设计基础。'],
  'needs-foundation-approval': ['foundation', '审阅并批准设计基础', '逐项决定候选规则，再由你明确批准版本。'],
  'needs-first-render-plan': ['plan', '生成首个页面计划', '只使用已批准的设计基础来规划首个页面。']
};

export function primaryActionForStage(stage) {
  const entry = actions[stage];
  return entry ? { stage, kind: entry[0], label: entry[1], description: entry[2] } : null;
}

export function reviewPrimaryAction(manifest) {
  return primaryActionForStage(workflowState(manifest).stage);
}
