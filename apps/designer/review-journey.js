export const reviewSteps = ['连接项目', '选择问题', '确认修改', '查看结果'];

export function reviewStep(stage, readOnly = false) {
  if (readOnly || ['needs-baseline','onboarding-failed','needs-absent-baseline','needs-foundation-approval','needs-first-render-plan'].includes(stage)) return 0;
  if (['needs-diagnosis','awaiting-confirmation','finding-stale'].includes(stage)) return 1;
  if (['needs-plan','needs-execution','execution-failed','boundary-breached'].includes(stage)) return 2;
  return 3;
}
