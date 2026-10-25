export function reviewProject(source, project = '') {
  const value = source?.trim() || '';
  const address = /^https?:\/\/\S+/i.exec(value)?.[0];
  if (address) {
    try {
      const url = new URL(address);
      let path = url.pathname.replace(/\/$/, '').replace(/\.git$/i, '');
      if (url.hostname.toLowerCase() === 'github.com') path = '/' + path.split('/').filter(Boolean).slice(0, 2).join('/');
      return { key: `${url.origin}${path}`, name: decodeURIComponent(path.split('/').filter(Boolean).at(-1) || url.hostname) };
    } catch { /* Non-URL sources retain their exact project identity. */ }
  }
  if (/^[a-z]:[\\/]/i.test(value)) {
    const path = value.replaceAll('\\', '/').replace(/\/$/, '');
    return { key: path.toLowerCase(), name: path.split('/').at(-1) };
  }
  return { key: value || `project:${project}`, name: project || value };
}

export function groupReviewHistory(records) {
  const groups = new Map();
  for (const record of records) {
    const project = record.summary ? reviewProject(record.summary.source, record.summary.project) : { key: 'examples', name: '' };
    if (!groups.has(project.key)) groups.set(project.key, { ...project, examples: !record.summary, records: [] });
    groups.get(project.key).records.push(record);
  }
  return [...groups.values()];
}
