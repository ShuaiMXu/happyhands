export const reviewSteps = ['诊断问题', '自动修复', '自动复核', '最终审阅'];

export function reviewStep(stage, readOnly = false) {
  if (readOnly || ['needs-baseline','onboarding-failed','needs-absent-baseline','needs-foundation-approval','needs-first-render-plan'].includes(stage)) return 0;
  if (['needs-diagnosis','finding-stale'].includes(stage)) return 0;
  if (['awaiting-confirmation','needs-plan','needs-execution','execution-failed','boundary-breached'].includes(stage)) return 1;
  if (['needs-after-capture','needs-structural-evaluation','needs-visual-qa','needs-specialist-verification'].includes(stage)) return 2;
  return 3;
}
