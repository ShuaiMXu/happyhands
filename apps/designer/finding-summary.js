import {t} from './i18n.js';

// Presentation only: keep original diagnoses, IDs and evidence unchanged. These
// are editable suggestions for recorded rule checks, never verified new findings.
const rules = [
  [/^IA-MAIN-|^A11Y-AXE-LANDMARK-ONE-MAIN-/, '主内容区域标记需要核对', '核对页面正文的主区域标记。为真正的主要内容保留一个主区域，保持导航、页脚和现有布局，再检查桌面与手机。'],
  [/^A11Y-AXE-COLOR-CONTRAST-/, '部分文字对比度需要核对', '按报告定位文字与背景组合。在保留现有品牌的前提下改善可读性，并复查桌面、手机和相关控件状态。'],
  [/^A11Y-AXE-SCROLLABLE-REGION-FOCUSABLE-/, '滚动区域的键盘操作需要核对', '核对报告中的滚动区域是否能获得键盘焦点并滚动。保留现有内容与鼠标操作，补齐键盘操作后重新验证。'],
  [/^A11Y-AXE-IMAGE-REDUNDANT-ALT-/, '图片说明可能与相邻文字重复', '核对图片用途和相邻文字，调整重复的图片说明，保留必要信息与现有视觉呈现，再检查读屏顺序。'],
  [/^A11Y-AXE-REGION-/, '页面内容区域标记需要核对', '按报告检查内容所属的页面区域，补齐恰当的区域标记，保持现有布局与内容。'],
  [/^RESPONSIVE-TARGET-/, '部分控件的点击范围偏小', '核对报告中点击范围偏小的控件，扩大可操作范围，保留原有功能和布局，再检查桌面与手机。']
];

export function findingSummary(finding) {
  if (finding.proposal || finding.sources?.some(source=>source.type==='experience-spec') || !finding.sources?.some(source=>source.type==='skill')) return {title:finding.title,proposal:finding.proposal||''};
  const rule=rules.find(([pattern])=>pattern.test(finding.id));
  if(!rule)return {title:finding.title,proposal:''};
  const device=/-DESKTOP$/.test(finding.id)?t('desktop'):/-MOBILE$/.test(finding.id)?t('mobile'):'';
  return {title:t(rule[1])+(device?' · '+device:''),proposal:t(rule[2])};
}
