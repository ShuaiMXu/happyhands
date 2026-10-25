// Shared planning/review policy; auxiliary checks are not native capture-plan stages.
export const reviewOrder = Object.freeze({version: 1, stages: ['normal-layout', 'normal-interaction', 'auxiliary'], auxiliary: 'supplemental-only'});
export const reviewOrderPrompt = `
## Normal-first visual review
1. Inspect normal-size desktop and mobile whole-page originals, then every planned region: hierarchy, density, alignment, natural text flow and repeated components. Report missing planned device/route evidence. No-overflow checks alone do not establish visual quality.
2. Inspect the planned real interaction states next: navigation, tabs, keyboard focus, copy feedback and other applicable actions. A still screenshot alone does not prove an action worked.
3. Only after normal layout and interactions, use 200% text resizing or other stress checks as supplementary diagnostics. Native capture plans record viewports and actions, not zoom; do not claim an auxiliary check ran without separate evidence. An auxiliary pass cannot override a normal-layout regression or missing primary evidence. When an explicitly confirmed task requires an accessibility fix, verify that scope as well and retain unresolved findings.
Preserve natural words, brand names and short labels. Do not insert discretionary word breaks or arbitrary character wrapping to make a stress case pass. Use appropriate layout and contained horizontal scrolling for long code where necessary; retain complete selectable/copyable content. Do not add user-facing zoom controls or distort the default interface merely for the auxiliary test.
This ordering supplements the COMPLETE skill packages; it does not replace, shorten or approve them.
`;

export function captureReviewStage(entry) {
  // Navigation/scroll/settling/assertions may locate a normal region. Other
  // actions require a separate interaction review, including unknown actions.
  return (entry.actions || []).some(action => !['navigate', 'scroll-to', 'wait-for', 'assert-state'].includes(action.type))
    ? 'normal-interaction' : 'normal-layout';
}
