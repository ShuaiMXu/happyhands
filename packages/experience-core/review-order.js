// Shared planning/review policy; auxiliary checks are not native capture-plan stages.
export const reviewOrder = Object.freeze({version: 2, stages: ['normal-layout', 'normal-interaction', 'auxiliary'], auxiliary: 'supplemental-only'});
export const reviewOrderPrompt = `
## Normal-first visual review
1. Start with the current page at its actual working viewport. Inspect recurring AI slop and UI details against adopted project rules before expanding the scope. Record observed defects, reasonable choices to preserve and missing evidence separately.
2. Inspect shared components and the planned real interaction states on that page: dropdown arrows/checkmarks, gaps, selected/open states, keyboard focus, navigation, tabs and copy feedback. A still screenshot alone does not prove an action worked. Check known consumers of the shared component.
3. Verify the user task, information hierarchy, density, grouping, purposeful copy and the adopted current-page grid, alignment and natural text flow. Do not replace these decisions with a token-only or no-overflow check.
4. After current-page remediation and interactions, inspect every planned device, route and region for regression, including phone reflow. Report missing planned evidence; checking devices last never waives their coverage. Existing normal-layout/normal-interaction stage labels classify evidence; they do not authorize postponing current-page interaction defects behind mobile polish.
5. Only after normal layout and interactions, use 200% text resizing or other stress checks as supplementary diagnostics. Native capture plans record viewports and actions, not zoom; do not claim an auxiliary check ran without separate evidence. An auxiliary pass cannot override a normal-layout regression or missing primary evidence. When an explicitly confirmed task requires an accessibility fix, verify that scope as well and retain unresolved findings.
Preserve natural words, brand names and short labels. Do not insert discretionary word breaks or arbitrary character wrapping to make a stress case pass. Use appropriate layout and contained horizontal scrolling for long code where necessary; retain complete selectable/copyable content. Do not add user-facing zoom controls or distort the default interface merely for the auxiliary test.
This ordering supplements the COMPLETE skill packages; it does not replace, shorten or approve them.
`;

export function captureReviewStage(entry) {
  // Navigation/scroll/settling/assertions may locate a normal region. Other
  // actions require a separate interaction review, including unknown actions.
  return (entry.actions || []).some(action => !['navigate', 'scroll-to', 'wait-for', 'assert-state'].includes(action.type))
    ? 'normal-interaction' : 'normal-layout';
}
