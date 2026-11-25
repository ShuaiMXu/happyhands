/** Shared criterion for audit, implementation and independent design-system review. */
export const COMPONENT_LINEAGE_CRITERION = [
  'Component lineage: trace each changed user-facing UI instance to a project component and its tokens or documented variant.',
  'Compare same-purpose instances across affected surfaces, including Design.md and component examples when present. Use source locations to establish the relationship, then inspect the applicable rendered states and actual interactions.',
  'Prefer reuse or a documented extension. A new family needs a distinct user-facing purpose, evidence that existing APIs do not fit, and named consumers and states. Theme differences specified by the source and isolated original third-party previews are legitimate.',
  'For independent design-system review, fail proven parallel implementations or page-local styles that bypass the agreed component without justification. Use needs-evidence when lineage, exception rationale, or affected states are unavailable. A screenshot or an automated check alone cannot prove reuse.'
].join(' ');
