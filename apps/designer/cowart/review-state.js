import { workflowState, visualReviewFor } from '../../../packages/harness-core/workflow.js';
import { assertVisualReview } from '../../../packages/harness-core/visual-review.js';

// An exported run is evidence to read, not a writable local run connection.
export function exportedReviewState(run) {
  const reviews = (run.reviews || []).flatMap(item => {
    if(item.skillId==='visual-qa-evaluator'&&!visualReviewFor(run.manifest,item.skillId))return [];
    if (item.problem || !item.document || item.document.skillId !== item.skillId) return [];
    try { return [assertVisualReview(item.document, run.manifest)]; } catch { return []; }
  });
  const manifest = { ...run.manifest, visualReviews: reviews };
  return { readOnly: true, reviews, reviewHistory:run.manifest.visualReviewHistory||[], workflow: workflowState(manifest), judgment: manifest.judgment || null, judgmentWithdrawal:manifest.judgmentWithdrawal||null, jobs: [] };
}
