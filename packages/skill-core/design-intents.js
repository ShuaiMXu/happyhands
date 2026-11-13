// Browser-safe catalog shared by project settings and runtime validation.
// Labels are translation keys; the workbench owns their localized text.
export const designIntentOptions = Object.freeze([
  ['polish', '细节打磨'],
  ['layout', '布局与层级'],
  ['animate', '动效与反馈'],
  ['harden', '健壮性与边界情况'],
  ['distill', '简化界面'],
  ['typeset', '文字排版'],
  ['clarify', '文案澄清'],
  ['adapt', '设备适配'],
  ['onboard', '新手引导'],
  ['optimize', '性能优化'],
  ['extract', '组件提取'],
].map(option => Object.freeze(option)));
export const designIntents = Object.freeze(designIntentOptions.map(([intent]) => intent));
