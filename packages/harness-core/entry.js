// Deterministic entry probe. It answers one question before a run starts:
// does a rendered state exist for the critical user task, or does it still have to be built?
// It never decides whether a rendered surface is good.

const RENDERED = 'rendered';
const EMPTY = 'empty';
const MISSING = 'missing';
const UNREACHABLE = 'unreachable';
const AMBIGUOUS = 'client-rendered';
const REDIRECTED = 'redirected';

export const ENTRY_STATES = Object.freeze({ RENDERED, EMPTY, MISSING, UNREACHABLE, AMBIGUOUS, REDIRECTED });

export function resolveRoutes(url, routes) {
  if (!url) return [];
  if (!routes?.length) return [new URL(url).href];
  return routes.map(route => new URL(route, url).href);
}

// Only the path matters: http→https and bare→www keep the route, and a trailing slash is
// normalisation rather than a different page.
function servedItself(requested, final) {
  const path = value => new URL(value).pathname.replace(/\/+$/, '');
  return path(requested) === path(final);
}

function bodyOf(html) {
  const match = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html);
  return match ? match[1] : html;
}

function classifyHtml(html) {
  const body = bodyOf(html);
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (text.length > 0) return RENDERED;
  return /<script\b/i.test(body) || /<script\b/i.test(html) ? AMBIGUOUS : EMPTY;
}

// `requireSelf` is set for a route the config named. A listed route is a claim about one surface,
// so it has to serve itself: a host that answers every unknown path with the homepage would
// otherwise report an unbuilt route as rendered, which is the one mistake this probe exists to
// avoid. The bare preview URL is exempt — following the app to wherever it lives is normal.
export async function probeEntry(url, { timeoutMs = 5000, requireSelf = false } = {}) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Entry URL must use http or https.');
  try {
    const response = await fetch(parsed.href, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    const finalUrl = response.url || parsed.href;
    if (response.status >= 400) return { url: parsed.href, finalUrl, status: response.status, state: MISSING, detail: `HTTP ${response.status}` };
    if (requireSelf && !servedItself(parsed.href, finalUrl)) {
      return {
        url: parsed.href,
        finalUrl,
        status: response.status,
        state: REDIRECTED,
        detail: `The request was redirected to ${finalUrl}, so this route did not serve itself. A catch-all redirect and a real route that moved look identical from here.`
      };
    }
    const type = response.headers.get('content-type') || '';
    if (!/html/i.test(type)) return { url: parsed.href, finalUrl, status: response.status, state: RENDERED, detail: `Non-HTML response (${type || 'unknown type'}).` };
    const state = classifyHtml(await response.text());
    return {
      url: parsed.href,
      finalUrl,
      status: response.status,
      state,
      detail: state === AMBIGUOUS
        ? 'The response carries scripts but no server-rendered text; a browser is required to tell an empty route from a client-rendered one.'
        : state === EMPTY ? 'The response has no body content.' : 'The route renders text.'
    };
  } catch (error) {
    return { url: parsed.href, finalUrl: null, status: null, state: UNREACHABLE, detail: error.message };
  }
}

export async function probeEntries(urls, options) {
  return Promise.all(urls.map(url => probeEntry(url, options)));
}

// `mode` is a property of the target surface, not of the project. A repository can hold
// reviewable surfaces and unbuilt ones at the same time; a run targets one critical task.
export async function resolveMode({ mode = 'auto', url = null, routes = [], timeoutMs = 5000 } = {}) {
  if (!['auto', 'review', 'bootstrap'].includes(mode)) throw new Error('Mode must be auto, review or bootstrap.');
  const entries = await probeEntries(resolveRoutes(url, routes), { timeoutMs, requireSelf: Boolean(routes?.length) });
  if (mode === 'review') {
    if (!url) throw new Error('Review mode needs a preview URL to capture a baseline.');
    return { mode: 'review', entries, reason: 'Review mode was requested explicitly.' };
  }
  if (mode === 'bootstrap') {
    return { mode: 'bootstrap', entries, reason: 'Bootstrap mode was requested explicitly.' };
  }
  if (!url) return { mode: 'bootstrap', entries, reason: 'No preview URL is configured, so no rendered state can exist yet.' };
  const rendered = entries.filter(item => item.state === RENDERED);
  if (rendered.length) {
    const absent = entries.filter(item => item.state !== RENDERED);
    return {
      mode: 'review',
      entries,
      reason: absent.length
        ? `${rendered.length} of ${entries.length} entry routes render. Review those; start a separate bootstrap run for ${absent.map(item => item.url).join(', ')}.`
        : 'Every entry route renders.'
    };
  }
  if (entries.every(item => [MISSING, UNREACHABLE, EMPTY].includes(item.state))) {
    return { mode: 'bootstrap', entries, reason: `No entry route renders: ${entries.map(item => `${item.url} (${item.state})`).join(', ')}.` };
  }
  // Neither answer is safe here: calling it review would capture a baseline of the wrong page,
  // and calling it bootstrap would ask for a surface that may already exist. Say so instead.
  const undecided = entries.filter(item => [AMBIGUOUS, REDIRECTED].includes(item.state));
  throw new Error(`Cannot infer a mode. ${undecided.map(item => `${item.url}: ${item.detail}`).join(' ')} Set "mode" to review or bootstrap in the project config.`);
}
