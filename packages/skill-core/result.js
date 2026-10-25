const STATUSES = new Set(['complete', 'needs-evidence', 'failed']);

export function skillResult(skill, value, provenance = null) {
  if (!STATUSES.has(value.status)) throw new Error(`Invalid result status from ${skill.id}.`);
  for (const key of ['evidence', 'findings', 'proposedUpdates', 'limitations']) {
    if (!Array.isArray(value[key])) throw new Error(`Skill ${skill.id} result needs ${key}.`);
  }
  for (const finding of value.findings) {
    if (!Array.isArray(finding?.evidence) || !finding.evidence.some(item => item && typeof item === 'object' && Object.keys(item).length)) {
      throw new Error(`Skill ${skill.id} finding ${finding?.id || 'unnamed'} requires evidence.`);
    }
  }
  // Aggregate scores belong to the rubric-backed diagnosis evaluator, not the
  // skill-result contract. A handler cannot add an unvalidated score to a run.
  if (value.score != null) throw new Error(`Skill ${skill.id} cannot publish a score outside the diagnosis rubric evaluator.`);
  return {
    ...value,
    schemaVersion: '0.1',
    skill: { id: skill.id, version: skill.version, role: skill.role },
    runAt: new Date().toISOString(),
    provenance
  };
}
