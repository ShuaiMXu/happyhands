// Data-only protocol shared with the public website. No commands or approvals.
export const HANDOFF_VERSION = '0.1';
export function assertSiteHandoff(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['schemaVersion','id','repo','task','designSources'].includes(key))) throw Error('Invalid website handoff.');
  if (value.schemaVersion !== HANDOFF_VERSION || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value.id || '')) throw Error('Unsupported handoff version or identity.');
  for (const key of ['repo','task']) if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 2000 || /[\u0000-\u001f]/.test(value[key])) throw Error(`Invalid handoff ${key}.`);
  const paths = value.designSources;
  if (!Array.isArray(paths) || paths.length > 12 || paths.some(path => typeof path !== 'string' || !path || path.length > 400 || path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').some(part => !part || part === '.' || part === '..' || ['.git','.harness','node_modules'].includes(part)) || /[\u0000-\u001f]/.test(path))) throw Error('Design sources must be repository-relative file or directory paths.');
  return {schemaVersion:HANDOFF_VERSION,id:value.id.toLowerCase(),repo:value.repo.trim(),task:value.task.trim(),designSources:[...new Set(paths)]};
}
export function encodeSiteHandoff(value) {
  const bytes = new TextEncoder().encode(JSON.stringify(assertSiteHandoff(value)));
  if (bytes.length > 16000) throw Error('Handoff is too large.');
  return btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
export function decodeSiteHandoff(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 22000 || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw Error('Invalid handoff link.');
  const bytes = Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')), char => char.charCodeAt(0));
  return assertSiteHandoff(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));
}
export function localWorkbenchURL(address, value) {
  const url = new URL(address);
  if (url.protocol !== 'http:' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/apps/designer/') throw Error('Use a local workbench address, for example http://127.0.0.1:4190/apps/designer/.');
  // A fragment is not sent in HTTP requests or Referer headers.
  url.hash = 'handoff=' + encodeSiteHandoff(value);
  return url.href;
}
