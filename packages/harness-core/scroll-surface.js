// Runs in the page. Structural selectors describe observed DOM, never component source.
export function inspectScrollSurfaces() {
  const selector = element => {
    const parts = [];
    for (let node = element; node && node !== document.documentElement; node = node.parentElement) {
      if (node.id && document.querySelectorAll('#' + CSS.escape(node.id)).length === 1) {
        parts.unshift('#' + CSS.escape(node.id)); break;
      }
      const siblings = [...node.parentElement.children].filter(item => item.tagName === node.tagName);
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
    }
    return parts.join(' > ');
  };
  return [...document.querySelectorAll('body *')].filter(element => {
    const style = getComputedStyle(element);
    return ['auto', 'scroll'].includes(style.overflowY) && style.visibility !== 'hidden' &&
      element.clientHeight > 0 && element.clientWidth > 0 && element.scrollHeight > element.clientHeight + 2;
  }).map(element => ({selector: selector(element), top: element.scrollTop,
    scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, clientWidth: element.clientWidth}));
}

export function surfaceOffsets(surface) {
  if (!Number.isSafeInteger(surface.scrollHeight) || surface.scrollHeight > 100000 || surface.clientHeight < 100 ||
      surface.scrollHeight <= surface.clientHeight) throw Error('Scroll surface requires an explicit bounded plan.');
  const end = surface.scrollHeight - surface.clientHeight, step = Math.max(1, surface.clientHeight - 100), offsets = [];
  for (let top = 0; top < end; top += step) {
    if (offsets.length >= 99) throw Error('Scroll surface exceeds 100 segments; narrow the review explicitly.');
    offsets.push(top);
  }
  return [...offsets, end];
}

// Coverage of explicit pixel intervals only. This never establishes a whole-page
// or component-state pass, especially for virtualized and overlapping content.
export function scrollSurfaceCoverage(entries) {
  const groups = new Map();
  for (const entry of entries) {
    const planned = entry.plannedScrollSurface;
    if (!planned || entry.actions?.length) continue;
    const key = JSON.stringify([entry.start?.url,entry.configurationId,planned.selector]);
    if (!groups.has(key)) groups.set(key,{configurationId:entry.configurationId,url:entry.start?.url,selector:planned.selector,scrollHeight:planned.scrollHeight,clientHeight:planned.clientHeight,clientWidth:planned.clientWidth,intervals:[],missing:[],inconsistent:false});
    const group=groups.get(key);
    if (['scrollHeight','clientHeight','clientWidth'].some(field=>group[field]!==planned[field])) group.inconsistent=true;
    if(entry.reached && entry.screenshot && entry.scrollSurface?.status==='observed-segment'){
      const surface=entry.scrollSurface;
      try {assertSurfaceMeasurement(surface,planned);}
      catch {group.inconsistent=true;continue;}
      group.intervals.push({start:surface.top,end:Math.min(surface.scrollHeight,surface.top+surface.clientHeight),screenshot:entry.screenshot});
    }
  }
  return [...groups.values()].map(group=>{
    let end=0;group.intervals.sort((a,b)=>a.start-b.start);
    for(const interval of group.intervals){if(interval.start>end)group.missing.push({start:end,end:interval.start});end=Math.max(end,interval.end);}
    if(end<group.scrollHeight)group.missing.push({start:end,end:group.scrollHeight});
    return {...group,status:!group.inconsistent&&!group.missing.length?'planned-intervals-captured':'needs-evidence',limitation:'Geometric intervals only. Fixed/sticky descendants may obscure content; virtualized content, nested surfaces, component states and independent review remain separate.'};
  });
}

export async function measureSurface(page, declaration) {
  const locator = page.locator(declaration.selector);
  if (await locator.count() !== 1) throw Error('Scroll surface selector must match exactly one element.');
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
    const bounds = {x: rect.x + element.clientLeft, y: rect.y + element.clientTop, width: element.clientWidth, height: element.clientHeight};
    let visible = bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= innerWidth + 1 && bounds.y + bounds.height <= innerHeight + 1;
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      const p = parent.getBoundingClientRect(), css = getComputedStyle(parent);
      if (['auto','scroll','hidden','clip'].includes(css.overflowY) && (bounds.y < p.top - 1 || bounds.y + bounds.height > p.bottom + 1)) visible = false;
      if (['auto','scroll','hidden','clip'].includes(css.overflowX) && (bounds.x < p.left - 1 || bounds.x + bounds.width > p.right + 1)) visible = false;
    }
    // An unrelated overlay must not masquerade as captured surface content.
    for (const x of [.1,.5,.9]) for (const y of [.1,.5,.9]) {
      const hit = document.elementFromPoint(bounds.x + bounds.width*x, bounds.y + bounds.height*y);
      if (!hit || !element.contains(hit)) visible = false;
    }
    const images = [...element.querySelectorAll('img')].filter(img => {
      const r = img.getBoundingClientRect(), css = getComputedStyle(img);
      return r.width > 0 && r.height > 0 && css.visibility !== 'hidden' && r.bottom > bounds.y && r.top < bounds.y+bounds.height && r.right > bounds.x && r.left < bounds.x+bounds.width;
    });
    return {top: element.scrollTop, left: element.scrollLeft, scrollHeight: element.scrollHeight, scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight, clientWidth: element.clientWidth, overflowY: style.overflowY, bounds, visible,
      visibleImages: images.length, unloadedImages: images.filter(img => !img.complete || !img.naturalWidth).map(img => img.getAttribute('src')?.slice(0,300) || 'unknown-image')};
  });
}

export function assertSurfaceMeasurement(measurement, declaration) {
  if (!measurement.visible || !['auto','scroll'].includes(measurement.overflowY)) throw Error('Scroll surface is clipped, occluded or not user-scrollable.');
  if (measurement.scrollWidth > measurement.clientWidth + 1 || measurement.left !== 0) throw Error('Scroll surface has uncovered horizontal content; declare a separate horizontal review.');
  if (['scrollHeight','clientHeight','clientWidth'].some(key => measurement[key] !== declaration[key])) throw Error('Scroll surface dimensions changed; rediscover and confirm a fresh plan.');
  if (Math.abs(measurement.top - declaration.top) > 2) throw Error('Scroll surface did not reach the declared offset.');
  if (measurement.unloadedImages.length) throw Error('Visible scroll-surface images did not load: ' + measurement.unloadedImages.slice(0,5).join(', '));
}

export async function prepareSurface(page, declaration) {
  const locator = page.locator(declaration.selector);
  await locator.waitFor({state:'visible',timeout:10000});
  if (await locator.count() !== 1) throw Error('Scroll surface selector must match exactly one element.');
  await locator.evaluate((element, top) => element.scrollTo({top,behavior:'instant'}), declaration.top);
  let measurement;
  for (let attempt = 0; attempt < 30; attempt++) {
    await page.waitForTimeout(100);
    measurement = await measureSurface(page, declaration);
    if (!measurement.unloadedImages.length && Math.abs(measurement.top-declaration.top)<=2) break;
  }
  assertSurfaceMeasurement(measurement, declaration);
  return {selector: declaration.selector, ...measurement, status:'observed-segment',
    interval: {start: measurement.top, end: Math.min(measurement.scrollHeight, measurement.top+measurement.clientHeight)},
    limitations: ['One original viewport at the recorded offset. Fixed/sticky descendants may obscure content; no component-instance, virtualized-list completeness or whole-page approval is inferred.']};
}
